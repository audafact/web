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

interface RecordingContextValue {
  isRecording: boolean;
  currentSession: RecordingSession | null;
  recordedSessions: RecordingSession[];
  startRecording: () => void;
  stopRecording: () => void;
  addRecordingEvent: (event: Omit<RecordingEvent, 'timestamp'>) => void;
  clearRecordings: () => void;
  exportRecording: (sessionId: string) => void;
  deleteRecording: (sessionId: string) => void;
}

const RecordingContextInstance = createContext<RecordingContextValue | null>(null);

export const RecordingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentSession, setCurrentSession] = useState<RecordingSession | null>(null);
  const [recordedSessions, setRecordedSessions] = useState<RecordingSession[]>([]);
  const recordingStartTimeRef = useRef<number>(0);

  const startRecording = useCallback(() => {
    const sessionId = `recording_${Date.now()}`;
    const startTime = Date.now();
    recordingStartTimeRef.current = startTime;
    
    const newSession: RecordingSession = {
      id: sessionId,
      startTime,
      events: [],
      tracks: [],
      duration: 0
    };
    
    setCurrentSession(newSession);
    setIsRecording(true);
    
    console.log('Recording started:', sessionId);
  }, []);

  const stopRecording = useCallback(() => {
    if (!currentSession) return;
    
    const endTime = Date.now();
    const duration = endTime - currentSession.startTime;
    
    const completedSession: RecordingSession = {
      ...currentSession,
      endTime,
      duration
    };
    
    setRecordedSessions(prev => [completedSession, ...prev]);
    setCurrentSession(null);
    setIsRecording(false);
    
    console.log('Recording stopped:', completedSession.id, 'Duration:', duration);
  }, [currentSession]);

  const addRecordingEvent = useCallback((event: Omit<RecordingEvent, 'timestamp'>) => {
    if (!isRecording || !currentSession) return;
    
    const timestamp = Date.now() - recordingStartTimeRef.current;
    const newEvent: RecordingEvent = {
      ...event,
      timestamp
    };
    
    setCurrentSession(prev => {
      if (!prev) return null;
      
      // Add track to session if not already included
      const tracks = prev.tracks.includes(event.trackId) 
        ? prev.tracks 
        : [...prev.tracks, event.trackId];
      
      return {
        ...prev,
        events: [...prev.events, newEvent],
        tracks
      };
    });
  }, [isRecording, currentSession]);

  const clearRecordings = useCallback(() => {
    setRecordedSessions([]);
  }, []);

  const exportRecording = useCallback((sessionId: string) => {
    const session = recordedSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const dataStr = JSON.stringify(session, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `audafact_recording_${sessionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [recordedSessions]);

  const deleteRecording = useCallback((sessionId: string) => {
    setRecordedSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  const value: RecordingContextValue = {
    isRecording,
    currentSession,
    recordedSessions,
    startRecording,
    stopRecording,
    addRecordingEvent,
    clearRecordings,
    exportRecording,
    deleteRecording
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