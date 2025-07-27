import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

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
}

interface RecordingContextValue {
  // Performance recording
  isRecordingPerformance: boolean;
  currentPerformance: Performance | null;
  performances: Performance[];
  startPerformanceRecording: () => void;
  stopPerformanceRecording: () => void;
  addRecordingEvent: (event: Omit<RecordingEvent, 'timestamp'>) => void;
  
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

const RecordingContextInstance = createContext<RecordingContextValue | null>(null);

export const RecordingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Performance recording state
  const [isRecordingPerformance, setIsRecordingPerformance] = useState(false);
  const [currentPerformance, setCurrentPerformance] = useState<Performance | null>(null);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const performanceStartTimeRef = useRef<number>(0);
  
  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [currentAudioRecording, setCurrentAudioRecording] = useState<AudioRecording | null>(null);
  const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
  
  // Sessions state
  const [savedSessions, setSavedSessions] = useState<RecordingSession[]>([]);

  // Performance recording functions
  const startPerformanceRecording = useCallback(() => {
    const performanceId = `performance_${Date.now()}`;
    const startTime = Date.now();
    performanceStartTimeRef.current = startTime;
    
    const newPerformance: Performance = {
      id: performanceId,
      startTime,
      events: [],
      tracks: [],
      duration: 0
    };
    
    setCurrentPerformance(newPerformance);
    setIsRecordingPerformance(true);
    
    console.log('Performance recording started:', performanceId);
  }, []);

  const stopPerformanceRecording = useCallback(() => {
    if (!currentPerformance) return;
    
    const endTime = Date.now();
    const duration = endTime - currentPerformance.startTime;
    
    const completedPerformance: Performance = {
      ...currentPerformance,
      endTime,
      duration
    };
    
    setPerformances(prev => [completedPerformance, ...prev]);
    setCurrentPerformance(null);
    setIsRecordingPerformance(false);
    
    console.log('Performance recording stopped:', completedPerformance.id, 'Duration:', duration);
  }, [currentPerformance]);

  const addRecordingEvent = useCallback((event: Omit<RecordingEvent, 'timestamp'>) => {
    if (!isRecordingPerformance || !currentPerformance) return;
    
    const timestamp = Date.now() - performanceStartTimeRef.current;
    const newEvent: RecordingEvent = {
      ...event,
      timestamp
    };
    
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

  // Audio recording functions
  const startAudioRecording = useCallback((tempo: number, countInBeats: number = 4) => {
    const recordingId = `audio_${Date.now()}`;
    const startTime = Date.now();
    
    const newRecording: AudioRecording = {
      id: recordingId,
      startTime,
      tracks: [],
      duration: 0,
      tempo,
      countInBeats
    };
    
    setCurrentAudioRecording(newRecording);
    setIsRecordingAudio(true);
    
    // TODO: Implement count-in and actual audio recording
    console.log('Audio recording started:', recordingId, 'Tempo:', tempo, 'Count-in beats:', countInBeats);
  }, []);

  const stopAudioRecording = useCallback(() => {
    if (!currentAudioRecording) return;
    
    const endTime = Date.now();
    const duration = endTime - currentAudioRecording.startTime;
    
    const completedRecording: AudioRecording = {
      ...currentAudioRecording,
      endTime,
      duration
    };
    
    setAudioRecordings(prev => [completedRecording, ...prev]);
    setCurrentAudioRecording(null);
    setIsRecordingAudio(false);
    
    console.log('Audio recording stopped:', completedRecording.id, 'Duration:', duration);
  }, [currentAudioRecording]);

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
    
    console.log('Studio state saved:', sessionId);
  }, []);

  // Management functions
  const clearAll = useCallback(() => {
    setPerformances([]);
    setAudioRecordings([]);
    setSavedSessions([]);
  }, []);

  const exportPerformance = useCallback((performanceId: string) => {
    const performance = performances.find(p => p.id === performanceId);
    if (!performance) return;
    
    const dataStr = JSON.stringify(performance, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `audafact_performance_${performanceId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  const value: RecordingContextValue = {
    // Performance recording
    isRecordingPerformance,
    currentPerformance,
    performances,
    startPerformanceRecording,
    stopPerformanceRecording,
    addRecordingEvent,
    
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