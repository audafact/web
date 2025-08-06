import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { DatabaseService } from '../services/databaseService';
import { StorageService } from '../services/storageService';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabase';

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
}

interface Performance {
  id: string;
  startTime: number;
  endTime?: number;
  events: RecordingEvent[];
  tracks: string[];
  duration: number;
  audioBlob?: Blob; // Add audio blob to performances
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
  exportPerformance: (performanceId: string) => void;
  exportSession: (sessionId: string) => void;
  exportAudioRecording: (recordingId: string) => void;
  deletePerformance: (performanceId: string) => void;
  deleteSession: (sessionId: string) => void;
  deleteAudioRecording: (recordingId: string) => void;
}

// Helper function to convert AudioBuffer to WAV format
const convertToWav = async (audioBuffer: AudioBuffer): Promise<Blob | null> => {
  try {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    
    // Create WAV header
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  } catch (error) {
    console.error('Error converting to WAV:', error);
    return null;
  }
};

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
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          

          
          // Convert to WAV format for better compatibility
          const wavBlob = await convertToWav(audioBuffer);
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
        
        // Save recording to database if user is authenticated
        if (user?.id && finalAudioBlob) {
          try {
            // First, ensure user record exists in the users table
            const { data: existingUser, error: userError } = await supabase
              .from('users')
              .select('id')
              .eq('id', user.id)
              .single();
            
            if (userError && userError.code === 'PGRST116') {
              // User doesn't exist, create them
              const { error: createUserError } = await supabase
                .from('users')
                .insert({
                  id: user.id,
                  access_tier: 'free'
                });
              
              if (createUserError) {
                console.error('Failed to create user record:', createUserError);
                return;
              }
            } else if (userError) {
              console.error('Error checking user record:', userError);
              return;
            }
            
            // Create a session for the recording first
            const sessionRecord = await DatabaseService.createSession({
              user_id: user.id,
              session_name: `Performance ${new Date().toLocaleString()}`,
              track_ids: [], // Empty array for now - track_ids should be UUIDs, not track names
              cuepoints: performanceEventsRef.current.filter(e => e.type === 'cue_trigger').map(e => e.data),
              loop_regions: performanceEventsRef.current.filter(e => e.type === 'loop_play').map(e => e.data),
              mode: 'loop'
            });
            
            if (!sessionRecord) {
              console.error('Failed to create session for recording');
              return;
            }
            
            // Create database record directly without storage upload for now
            const recordingRecord = await DatabaseService.createRecording({
              user_id: user.id,
              session_id: sessionRecord.id,
              recording_url: `local://recording_${Date.now()}.wav`, // Placeholder URL
              length: duration / 1000, // Convert to seconds
              notes: `Performance recording with ${performanceEventsRef.current.length} events`
            });
            
            // Dispatch event to notify that recording was saved
            window.dispatchEvent(new CustomEvent('recordingSaved', {
              detail: { userId: user.id, recordingCount: 1 }
            }));
          } catch (error) {
            console.error('Failed to save recording to database:', error);
            // Don't fail the recording if database save fails
          }
        }
        
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
  const saveCurrentState = useCallback((studioState: any) => {
    const sessionId = `session_${Date.now()}`;
    const currentTime = Date.now();
    
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
      duration: 0
    };
    
    setSavedSessions(prev => [stateSession, ...prev]);
    

  }, []);

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

  const exportPerformance = useCallback((performanceId: string) => {
    const performance = performances.find(p => p.id === performanceId);
    if (!performance) return;
    
    // Export performance data (without audio blob)
    const { audioBlob, ...performanceData } = performance;
    const dataStr = JSON.stringify(performanceData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `audafact_performance_${performanceId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Export audio if it exists
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioLink = document.createElement('a');
      audioLink.href = audioUrl;
      
      // Determine file extension based on MIME type
      let extension = 'webm';
      if (audioBlob.type.includes('mp4')) {
        extension = 'm4a'; // Use .m4a for audio MP4 files
      } else if (audioBlob.type.includes('wav')) {
        extension = 'wav';
      } else if (audioBlob.type.includes('ogg')) {
        extension = 'ogg';
      } else if (audioBlob.type.includes('opus')) {
        extension = 'opus';
      }
      

      
      audioLink.download = `audafact_performance_${performanceId}.${extension}`;
      document.body.appendChild(audioLink);
      audioLink.click();
      document.body.removeChild(audioLink);
      URL.revokeObjectURL(audioUrl);
    }
  }, [performances]);

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

  const deletePerformance = useCallback((performanceId: string) => {
    setPerformances(prev => prev.filter(p => p.id !== performanceId));
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  const deleteAudioRecording = useCallback((recordingId: string) => {
    setAudioRecordings(prev => prev.filter(r => r.id !== recordingId));
  }, []);

  const getRecordingDestination = useCallback(() => {
    return recordingDestinationRef.current;
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
    exportSession,
    exportAudioRecording,
    deletePerformance,
    deleteSession,
    deleteAudioRecording
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