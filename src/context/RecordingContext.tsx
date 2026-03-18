import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { DatabaseService } from '../services/databaseService';
import { getNumericLimitsForDbTier } from '../config/tierConfig';
import { Recording, Session } from '../types/music';
import { StorageService } from '../services/storageService';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';
import { ensureStereo, convertToWav, convertToMp3, downloadBlob } from '../lib/audioExport';
import { getSignedUrl } from '../lib/storage';
import { deleteByKey } from '../lib/storage';

interface RecordingEvent {
  timestamp: number;
  type: 'cue_trigger' | 'loop_play' | 'loop_stop' | 'volume_change' | 'speed_change' | 'filter_change';
  trackId: string;
  data: any;
}

interface RecordingSession {
  id: string;
  startTime: number;
  endTime?: number;
  events: RecordingEvent[];
  tracks: string[];
  duration: number;
  session_name?: string;
}

interface Performance {
  id: string;
  startTime: number;
  endTime?: number;
  events: RecordingEvent[];
  tracks: string[];
  duration: number;
  audioBlob?: Blob; // Add audio blob to performances
  databaseId?: string; // Database recording ID if saved to database
  fileKey?: string; // R2 key for playback when blob unavailable (e.g. after refresh)
}

interface AudioRecording {
  id: string;
  startTime: number;
  endTime?: number;
  audioBlob?: Blob;
  tracks: string[];
  duration: number;
  tempo: number;
  countInBeats: number;
  events: RecordingEvent[]; // Add events to audio recordings
}

interface RecordingContextValue {
  // Performance recording
  isRecordingPerformance: boolean;
  currentPerformance: Performance | null;
  performances: Performance[];
  startPerformanceRecording: (appAudioContext?: AudioContext) => void;
  stopPerformanceRecording: () => void;
  addRecordingEvent: (event: Omit<RecordingEvent, 'timestamp'>) => void;
  getRecordingDestination: () => MediaStreamAudioDestinationNode | null;
  
  // Audio recording
  isRecordingAudio: boolean;
  currentAudioRecording: AudioRecording | null;
  audioRecordings: AudioRecording[];
  startAudioRecording: (tempo: number, countInBeats?: number) => void;
  stopAudioRecording: () => void;
  
  // Sessions (state snapshots)
  savedSessions: RecordingSession[];
  saveCurrentState: (studioState: any) => void;
  
  // Management
  clearAll: () => void;
  exportPerformance: (performanceId: string, options?: { filename?: string; format: 'mp3' | 'wav' }) => void;
  exportByFileKey: (fileKey: string, filename: string, format: 'mp3' | 'wav', recordingId?: string) => Promise<void>;
  savePerformanceName: (performanceId: string, filename: string) => Promise<void>;
  updateRecordingName: (recordingId: string, filename: string) => Promise<void>;
  exportSession: (sessionId: string) => void;
  exportAudioRecording: (recordingId: string) => void;
  deletePerformance: (performanceId: string, options?: { fileKey?: string }) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  renameSession: (sessionId: string, newName: string) => Promise<void>;
  deleteAudioRecording: (recordingId: string) => Promise<void>;
  pendingExport: { performanceId: string; canSave: boolean } | null;
  clearPendingExport: () => void;
  pendingSession: { sessionId: string } | null;
  clearPendingSession: () => void;
  discardPerformance: (performanceId: string) => void;
  savedRecordings: Recording[];
  refreshSavedRecordings: () => Promise<void>;
  deleteSavedRecording: (recordingId: string, options?: { fileKey?: string }) => Promise<void>;
}

const RecordingContextInstance = createContext<RecordingContextValue | null>(null);

export const RecordingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // Performance recording state
  const [isRecordingPerformance, setIsRecordingPerformance] = useState(false);
  const [currentPerformance, setCurrentPerformance] = useState<Performance | null>(null);
  const [performances, setPerformances] = useState<Performance[]>(() => {
    const saved = localStorage.getItem('audafact_performances');
    return saved ? JSON.parse(saved) : [];
  });
  const performanceStartTimeRef = useRef<number>(0);
  
  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [currentAudioRecording, setCurrentAudioRecording] = useState<AudioRecording | null>(null);
  const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>(() => {
    const saved = localStorage.getItem('audafact_audioRecordings');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Sessions state
  const [savedSessions, setSavedSessions] = useState<RecordingSession[]>(() => {
    const saved = localStorage.getItem('audafact_savedSessions');
    return saved ? JSON.parse(saved) : [];
  });

  // MediaRecorder ref for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const performanceEventsRef = useRef<RecordingEvent[]>([]);
  const performanceTracksRef = useRef<string[]>([]);
  const audioCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const [pendingExport, setPendingExport] = useState<{ performanceId: string; canSave: boolean } | null>(null);
  const [pendingSession, setPendingSession] = useState<{ sessionId: string } | null>(null);
  const [savedRecordings, setSavedRecordings] = useState<Recording[]>([]);

  const refreshSavedRecordings = useCallback(async () => {
    if (!user?.id) {
      setSavedRecordings([]);
      return;
    }
    try {
      const recordings = await DatabaseService.getUserRecordings(user.id);
      setSavedRecordings(recordings);
    } catch (error) {
      console.error('Failed to load saved recordings:', error);
      setSavedRecordings([]);
    }
  }, [user?.id]);

  // Load saved recordings on mount and when user changes
  useEffect(() => {
    refreshSavedRecordings();
  }, [refreshSavedRecordings]);

  // Hydrate savedSessions from DB when user logs in (merge DB + local)
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    (async () => {
      try {
        const dbSessions = await DatabaseService.getUserSessions(user.id);
        if (!mounted) return;
        const dbAsRecording: RecordingSession[] = dbSessions.map((s: Session) => ({
          id: s.id,
          startTime: s.created_at ? new Date(s.created_at).getTime() : Date.now(),
          events: [{ timestamp: 0, type: 'cue_trigger' as const, trackId: 'studio', data: s.full_state ?? {} }],
          tracks: s.full_state?.tracks?.map((t: { id: string }) => t.id) ?? s.track_ids ?? [],
          duration: 0,
          session_name: s.session_name
        }));
        setSavedSessions(prev => {
          const dbIds = new Set(dbAsRecording.map(x => x.id));
          const localOnly = prev.filter(p => !dbIds.has(p.id));
          return [...dbAsRecording, ...localOnly];
        });
      } catch (err) {
        console.error('Error hydrating sessions from DB:', err);
      }
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  // Refresh saved recordings when a new one is saved
  useEffect(() => {
    const handler = () => refreshSavedRecordings();
    window.addEventListener('recordingSaved', handler);
    return () => window.removeEventListener('recordingSaved', handler);
  }, [refreshSavedRecordings]);

  // Persist data to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('audafact_performances', JSON.stringify(performances));
  }, [performances]);

  useEffect(() => {
    localStorage.setItem('audafact_audioRecordings', JSON.stringify(audioRecordings));
  }, [audioRecordings]);

  useEffect(() => {
    localStorage.setItem('audafact_savedSessions', JSON.stringify(savedSessions));
  }, [savedSessions]);

  // Combined recording functions
  const startPerformanceRecording = useCallback(async (appAudioContext?: AudioContext) => {
    try {
      const performanceId = `performance_${Date.now()}`;
      const startTime = Date.now();
      performanceStartTimeRef.current = startTime;
      
      if (!appAudioContext) {
        console.error('No audio context provided for recording');
        alert('Audio context is required for recording. Please ensure audio is initialized.');
        return;
      }
      
      // Create a MediaStreamDestination to capture audio from the app
      const destination = appAudioContext.createMediaStreamDestination();
      recordingDestinationRef.current = destination;
      
      // Create MediaRecorder with the captured audio stream
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2')) {
        mimeType = 'audio/mp4;codecs=mp4a.40.2';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      

      
      const mediaRecorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
      
      // Add error handling for MediaRecorder
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      audioStreamRef.current = destination.stream;
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      

      
      mediaRecorder.onstop = async () => {
        const originalBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        
        // Convert to WAV format for better compatibility
        let finalAudioBlob = originalBlob;
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const arrayBuffer = await originalBlob.arrayBuffer();
          let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBuffer = ensureStereo(audioBuffer);
          const wavBlob = convertToWav(audioBuffer);
          if (wavBlob) {
            finalAudioBlob = wavBlob;
          }
        } catch (error) {
          console.warn('Failed to convert audio format, using original:', error);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const completedPerformance: Performance = {
          id: performanceId,
          startTime,
          endTime,
          duration,
          events: performanceEventsRef.current,
          tracks: performanceTracksRef.current,
          audioBlob: finalAudioBlob
        };
        
        setPerformances(prev => [completedPerformance, ...prev]);
        setCurrentPerformance(null);
        setIsRecordingPerformance(false);

        let canSave = true;
        if (user?.id && finalAudioBlob) {
          try {
            const { data: existingUser, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('id', user.id)
              .single();

            if (userError && userError.code === 'PGRST116') {
              const { error: createUserError } = await supabase
                .from('users')
                .insert({ id: user.id, access_tier: 'free' });
              if (createUserError) console.error('Failed to create user record:', createUserError);
            } else if (userError) {
              console.error('Error checking user record:', userError);
            }

            const { count: recordingCount, error: countError } = await supabase
              .from('recordings')
              .select('id', { count: 'exact' })
              .eq('user_id', user.id);

            if (!countError) {
              const currentRecordingCount = recordingCount || 0;
              const { data: userData, error: userTierError } = await supabase
                .from('users')
                .select('access_tier')
                .eq('id', user.id)
                .single();
              const rawTier = userTierError ? 'free' : (userData?.access_tier || 'free');
              const normalized =
                rawTier === 'pro' || rawTier === 'enterprise'
                  ? 'pro'
                  : rawTier === 'starter'
                    ? 'starter'
                    : 'free';
              const maxRecordings = getNumericLimitsForDbTier(normalized).maxRecordings;
              canSave = currentRecordingCount < maxRecordings;

              if (canSave) {
                const notes = `Performance recording with ${performanceEventsRef.current.length} events`;
                let recordingRecord: Awaited<ReturnType<typeof DatabaseService.createRecording>> = null;
                let r2Key: string | undefined;

                try {
                  const r2Result = await StorageService.uploadRecordingBlob(
                    finalAudioBlob,
                    user.id,
                    undefined,
                    notes
                  );

                  if (r2Result) {
                    r2Key = r2Result.key;
                    recordingRecord = await DatabaseService.createRecording({
                      user_id: user.id,
                      session_id: undefined,
                      recording_url: `https://media.audafact.com/${r2Result.key}`,
                      length: duration / 1000,
                      notes,
                      file_key: r2Result.key,
                      content_hash: r2Result.content_hash,
                      size_bytes: r2Result.size_bytes,
                      content_type: r2Result.content_type,
                      original_name: r2Result.original_name
                    });
                  }
                } catch (uploadError) {
                  console.warn('R2 upload failed, falling back to local:', uploadError);
                }

                if (!recordingRecord) {
                  recordingRecord = await DatabaseService.createRecording({
                    user_id: user.id,
                    session_id: undefined,
                    recording_url: `local://recording_${Date.now()}.wav`,
                    length: duration / 1000,
                    notes
                  });
                }

                if (recordingRecord) {
                  const fileKey = r2Key;
                  setPerformances(prev => prev.map(p =>
                    p.id === performanceId
                      ? { ...p, databaseId: recordingRecord!.id, ...(fileKey && { fileKey }) }
                      : p
                  ));
                  window.dispatchEvent(new CustomEvent('recordingSaved', {
                    detail: { userId: user.id, recordingCount: 1 }
                  }));
                }
              }
            }
          } catch (error) {
            console.error('Failed to save recording to database:', error);
            canSave = false;
          }
        }
        setPendingExport({ performanceId, canSave });
        window.dispatchEvent(new CustomEvent('recordingCompleted'));

        // Clear refs and stop audio monitoring
        mediaRecorderRef.current = null;
        audioStreamRef.current = null;
        recordingDestinationRef.current = null;
        
        // Stop audio level monitoring
        if (audioCheckIntervalRef.current) {
          clearTimeout(audioCheckIntervalRef.current);
          audioCheckIntervalRef.current = null;
        }
        

      };
      
      const newPerformance: Performance = {
        id: performanceId,
        startTime,
        events: [],
        tracks: [],
        duration: 0
      };
      
      // Initialize refs for tracking events and tracks
      performanceEventsRef.current = [];
      performanceTracksRef.current = [];
      
      setCurrentPerformance(newPerformance);
      setIsRecordingPerformance(true);
      
      // Start recording
      mediaRecorder.start();
    } catch (error) {
      console.error('Failed to start performance recording:', error);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  }, [currentPerformance]);

  const stopPerformanceRecording = useCallback(() => {
    if (!currentPerformance || !mediaRecorderRef.current) return;
    
    try {
      // Stop the MediaRecorder
      mediaRecorderRef.current.stop();
      
      // Stop the audio stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      
      mediaRecorderRef.current = null;
      

    } catch (error) {
      console.error('Error stopping performance recording:', error);
    }
  }, [currentPerformance]);

  const addRecordingEvent = useCallback((event: Omit<RecordingEvent, 'timestamp'>) => {
    if (!isRecordingPerformance || !currentPerformance) {
      return;
    }
    
    const timestamp = Date.now() - performanceStartTimeRef.current;
    const newEvent: RecordingEvent = {
      ...event,
      timestamp
    };
    
    // Update refs immediately
    performanceEventsRef.current = [...performanceEventsRef.current, newEvent];
    if (!performanceTracksRef.current.includes(event.trackId)) {
      performanceTracksRef.current = [...performanceTracksRef.current, event.trackId];
    }
    

    
    setCurrentPerformance(prev => {
      if (!prev) return null;
      
      // Add track to performance if not already included
      const tracks = prev.tracks.includes(event.trackId) 
        ? prev.tracks 
        : [...prev.tracks, event.trackId];
      
      return {
        ...prev,
        events: [...prev.events, newEvent],
        tracks
      };
    });
  }, [isRecordingPerformance, currentPerformance]);

    // Audio recording functions (deprecated - now combined with performance recording)
  const startAudioRecording = useCallback(async (tempo: number, countInBeats: number = 4) => {
    console.warn('startAudioRecording is deprecated. Use startPerformanceRecording instead.');
    await startPerformanceRecording();
  }, [startPerformanceRecording]);

  const stopAudioRecording = useCallback(() => {
    console.warn('stopAudioRecording is deprecated. Use stopPerformanceRecording instead.');
    stopPerformanceRecording();
  }, [stopPerformanceRecording]);

  // Session functions
  const saveCurrentState = useCallback(async (studioState: any) => {
    const sessionId = `session_${Date.now()}`;
    const currentTime = Date.now();
    
    const sessionName = `Studio Session ${new Date().toLocaleString()}`;
    const stateSession: RecordingSession = {
      id: sessionId,
      startTime: currentTime,
      endTime: currentTime,
      events: [{
        timestamp: 0,
        type: 'cue_trigger', // Using a dummy type for state snapshots
        trackId: 'studio',
        data: studioState
      }],
      tracks: studioState.tracks?.map((track: any) => track.id) || [],
      duration: 0,
      session_name: sessionName
    };
    
    // Save to local state immediately for UI responsiveness
    setSavedSessions(prev => [stateSession, ...prev]);
    
    // If user is authenticated, save to database
    if (user?.id) {
      try {
        // Check if user can save more sessions
        const { count: sessionCount, error: countError } = await supabase
          .from('sessions')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id);
        
        if (countError) {
          console.error('Error checking session count:', countError);
          return;
        }
        
        const currentSessionCount = sessionCount || 0;
        
        // Get user's access tier from database
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('access_tier')
          .eq('id', user.id)
          .single();
        
        const rawTier = userError ? 'free' : (userData?.access_tier || 'free');
        const normalized =
          rawTier === 'pro' || rawTier === 'enterprise'
            ? 'pro'
            : rawTier === 'starter'
              ? 'starter'
              : 'free';
        const maxSessions = getNumericLimitsForDbTier(normalized).maxSessions;
        
        if (currentSessionCount >= maxSessions) {
          console.warn('User has reached session limit');
          // Remove from local state since it couldn't be saved to database
          setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
          return;
        }
        
        // Helper function to check if a string is a valid UUID
        const isValidUUID = (str: string): boolean => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return uuidRegex.test(str);
        };

        // Filter track IDs to only include valid UUIDs (uploaded tracks)
        const validTrackIds = studioState.tracks
          ?.map((track: any) => track.id)
          .filter((id: string) => isValidUUID(id)) || [];

        // Save to database (full_state contains complete restore data; legacy columns kept for compatibility)
        const dbSession = await DatabaseService.createSession({
          user_id: user.id,
          session_name: sessionName,
          track_ids: validTrackIds,
          cuepoints: studioState.tracks?.map((track: any) => ({ trackId: track.id, cuePoints: track.cuePoints || [] })) || [],
          loop_regions: studioState.tracks?.map((track: any) => ({
            trackId: track.id,
            start: track.loopStart,
            end: track.loopEnd
          })).filter((region: any) => region.start !== undefined && region.end !== undefined) || [],
          mode: 'loop',
          full_state: studioState
        });
        
        if (dbSession) {
          // Update local session with database ID and name
          setSavedSessions(prev => prev.map(s => 
            s.id === sessionId ? { ...s, id: dbSession.id, session_name: dbSession.session_name } : s
          ));
          setPendingSession({ sessionId: dbSession.id });
          window.dispatchEvent(new CustomEvent('sessionSaved', {
            detail: { userId: user.id, sessionCount: currentSessionCount + 1 }
          }));
        } else {
          console.error('Failed to save session to database');
          // Remove from local state since it couldn't be saved to database
          setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
        }
      } catch (error) {
        console.error('Error saving session to database:', error);
        // Remove from local state since it couldn't be saved to database
        setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
      }
    }
  }, [user]);

  // Management functions
  const clearAll = useCallback(() => {
    setPerformances([]);
    setAudioRecordings([]);
    setSavedSessions([]);
    // Also clear from localStorage
    localStorage.removeItem('audafact_performances');
    localStorage.removeItem('audafact_audioRecordings');
    localStorage.removeItem('audafact_savedSessions');
  }, []);

  const exportPerformance = useCallback(async (performanceId: string, options?: { filename?: string; format?: 'mp3' | 'wav' }) => {
    const performance = performances.find(p => p.id === performanceId);
    if (!performance) return;
    
    const format = options?.format ?? 'wav';
    const baseFilename = options?.filename ?? `audafact_recording_${new Date().toISOString().slice(0, 16).replace('T', '_')}`;
    const extension = format === 'mp3' ? 'mp3' : 'wav';
    const filename = baseFilename.endsWith(`.${extension}`) ? baseFilename : `${baseFilename}.${extension}`;
    
    const audioBlob = performance.audioBlob;
    if (!audioBlob) return;
    
    try {
      let blobToDownload = audioBlob;
      if (format === 'mp3') {
        blobToDownload = await convertToMp3(audioBlob);
      } else {
        // Ensure .wav extension - blob is already WAV from recording
        if (!audioBlob.type.includes('wav')) {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const arrayBuffer = await audioBlob.arrayBuffer();
          let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          audioBuffer = ensureStereo(audioBuffer);
          const wavBlob = convertToWav(audioBuffer);
          if (wavBlob) blobToDownload = wavBlob;
        }
      }
      downloadBlob(blobToDownload, filename);

      // Persist custom filename to DB when recording was saved
      if (performance.databaseId && user?.id) {
        await DatabaseService.updateRecordingOriginalName(performance.databaseId, user.id, filename);
        refreshSavedRecordings();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [performances, user?.id, refreshSavedRecordings]);

  const exportByFileKey = useCallback(async (fileKey: string, filename: string, format: 'mp3' | 'wav', recordingId?: string) => {
    try {
      const url = await getSignedUrl(fileKey);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const audioBlob = await res.blob();

      let blobToDownload: Blob;
      if (format === 'mp3') {
        blobToDownload = await convertToMp3(audioBlob);
      } else {
        if (!audioBlob.type.includes('wav')) {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const wavBlob = convertToWav(ensureStereo(audioBuffer));
          blobToDownload = wavBlob ?? audioBlob;
        } else {
          blobToDownload = audioBlob;
        }
      }
      downloadBlob(blobToDownload, filename);

      if (recordingId && user?.id) {
        await DatabaseService.updateRecordingOriginalName(recordingId, user.id, filename);
        refreshSavedRecordings();
      }
    } catch (error) {
      console.error('Export by fileKey failed:', error);
      throw error;
    }
  }, [user?.id, refreshSavedRecordings]);

  const savePerformanceName = useCallback(async (performanceId: string, filename: string) => {
    const performance = performances.find(p => p.id === performanceId);
    if (!performance?.databaseId || !user?.id) return;
    await DatabaseService.updateRecordingOriginalName(performance.databaseId, user.id, filename);
    refreshSavedRecordings();
  }, [performances, user?.id, refreshSavedRecordings]);

  const updateRecordingName = useCallback(async (recordingId: string, filename: string) => {
    if (!user?.id) return;
    await DatabaseService.updateRecordingOriginalName(recordingId, user.id, filename);
    refreshSavedRecordings();
  }, [user?.id, refreshSavedRecordings]);

  const exportSession = useCallback((sessionId: string) => {
    const session = savedSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const dataStr = JSON.stringify(session, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `audafact_session_${sessionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [savedSessions]);

  const exportAudioRecording = useCallback((recordingId: string) => {
    const recording = audioRecordings.find(r => r.id === recordingId);
    if (!recording || !recording.audioBlob) return;
    
    const url = URL.createObjectURL(recording.audioBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `audafact_recording_${recordingId}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [audioRecordings]);

  const deletePerformance = useCallback(async (performanceId: string, options?: { fileKey?: string }) => {
    // Find the performance to get its database ID
    const performance = performances.find(p => p.id === performanceId);
    const fileKey = options?.fileKey ?? performance?.fileKey;

    // Remove from local state immediately for UI responsiveness
    setPerformances(prev => prev.filter(p => p.id !== performanceId));

    // If performance has a database ID and user is authenticated, delete from storage then database
    if (performance?.databaseId && user?.id) {
      try {
        // Delete from R2 storage first (match upload flow)
        if (fileKey) {
          try {
            await deleteByKey(fileKey);
          } catch (storageError) {
            console.warn('Failed to delete from storage (continuing anyway):', storageError);
          }
        }
        const success = await DatabaseService.deleteRecording(performance.databaseId, user.id);
        if (success) refreshSavedRecordings();
        else console.error('Failed to delete recording from database');
      } catch (error) {
        console.error('Error deleting recording from database:', error);
      }
    }
  }, [performances, user, refreshSavedRecordings]);

  const deleteSavedRecording = useCallback(async (recordingId: string, options?: { fileKey?: string }) => {
    if (!user?.id) return;
    try {
      // Delete from R2 storage first (match upload flow)
      if (options?.fileKey) {
        try {
          await deleteByKey(options.fileKey);
        } catch (storageError) {
          console.warn('Failed to delete from storage (continuing anyway):', storageError);
        }
      }
      const success = await DatabaseService.deleteRecording(recordingId, user.id);
      if (success) await refreshSavedRecordings();
      else console.error('Failed to delete recording from database');
    } catch (error) {
      console.error('Error deleting recording from database:', error);
    }
  }, [user?.id, refreshSavedRecordings]);

  const deleteSession = useCallback(async (sessionId: string) => {
    // Remove from local state immediately for UI responsiveness
    setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
    
    // If user is authenticated, delete from database
    if (user?.id) {
      try {
        const success = await DatabaseService.deleteSession(sessionId, user.id);
        if (!success) {
          console.error('Failed to delete session from database');
        }
      } catch (error) {
        console.error('Error deleting session from database:', error);
      }
    } else {
      // Guest or not authenticated: still add locally and prompt for name
      setPendingSession({ sessionId });
    }
  }, [user]);

  const renameSession = useCallback(async (sessionId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setSavedSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, session_name: trimmed } : s
    ));

    const isValidUUID = (str: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

    if (user?.id && isValidUUID(sessionId)) {
      try {
        const updated = await DatabaseService.updateSession(sessionId, user.id, { session_name: trimmed });
        if (!updated) {
          console.error('Failed to rename session in database');
        }
      } catch (error) {
        console.error('Error renaming session in database:', error);
      }
    }
  }, [user]);

  const deleteAudioRecording = useCallback(async (recordingId: string) => {
    // Remove from local state immediately for UI responsiveness
    setAudioRecordings(prev => prev.filter(r => r.id !== recordingId));
    
    // If user is authenticated, delete from database
    if (user?.id) {
      try {
        const success = await DatabaseService.deleteRecording(recordingId, user.id);
        if (!success) {
          console.error('Failed to delete recording from database');
          // Could add error handling here (e.g., show toast, restore to local state)
        }
      } catch (error) {
        console.error('Error deleting recording from database:', error);
        // Could add error handling here
      }
    }
  }, [user]);

  const getRecordingDestination = useCallback(() => {
    return recordingDestinationRef.current;
  }, []);

  const clearPendingExport = useCallback(() => {
    setPendingExport(null);
  }, []);

  const clearPendingSession = useCallback(() => {
    setPendingSession(null);
  }, []);

  const discardPerformance = useCallback((performanceId: string) => {
    setPerformances(prev => prev.filter(p => p.id !== performanceId));
  }, []);

  const value: RecordingContextValue = {
    // Performance recording
    isRecordingPerformance,
    currentPerformance,
    performances,
    startPerformanceRecording,
    stopPerformanceRecording,
    addRecordingEvent,
    getRecordingDestination,
    
    // Audio recording
    isRecordingAudio,
    currentAudioRecording,
    audioRecordings,
    startAudioRecording,
    stopAudioRecording,
    
    // Sessions
    savedSessions,
    saveCurrentState,
    
    // Management
    clearAll,
    exportPerformance,
    exportByFileKey,
    savePerformanceName,
    updateRecordingName,
    exportSession,
    exportAudioRecording,
    deletePerformance,
    deleteSession,
    renameSession,
    deleteAudioRecording,
    pendingExport,
    clearPendingExport,
    pendingSession,
    clearPendingSession,
    discardPerformance,
    savedRecordings,
    refreshSavedRecordings,
    deleteSavedRecording
  };

  return (
    <RecordingContextInstance.Provider value={value}>
      {children}
    </RecordingContextInstance.Provider>
  );
};

export const useRecording = (): RecordingContextValue => {
  const context = useContext(RecordingContextInstance);
  if (!context) {
    throw new Error('useRecording must be used within a RecordingProvider');
  }
  return context;
}; 