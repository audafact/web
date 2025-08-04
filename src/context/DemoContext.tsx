import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

// Import preloaded audio files
import secretsOfTheHeart from '../assets/audio/Secrets of the Heart.mp3';
import ronDrums from '../assets/audio/RON-drums.wav';
import rhythmRevealed from '../assets/audio/The Rhythm Revealed(Drums).wav';
import unveiledDesires from '../assets/audio/Unveiled Desires.wav';

// Define AudioAsset interface for demo tracks
export interface AudioAsset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  file: string;
  type: 'wav' | 'mp3';
  size: string;
  duration?: number;
}

// Demo tracks configuration
const demoTracks: AudioAsset[] = [
  { 
    id: 'ron-drums', 
    name: 'RON Drums',
    genre: 'drum-n-bass', 
    bpm: 140,
    file: ronDrums,
    type: 'wav',
    size: '5.5MB'
  },
  { 
    id: 'secrets-of-the-heart', 
    name: 'Secrets of the Heart',
    genre: 'ambient', 
    bpm: 120,
    file: secretsOfTheHeart,
    type: 'mp3',
    size: '775KB'
  },
  { 
    id: 'rhythm-revealed', 
    name: 'The Rhythm Revealed (Drums)',
    genre: 'house', 
    bpm: 128,
    file: rhythmRevealed,
    type: 'wav',
    size: '5.5MB'
  },
  { 
    id: 'unveiled-desires', 
    name: 'Unveiled Desires',
    genre: 'techno', 
    bpm: 135,
    file: unveiledDesires,
    type: 'wav',
    size: '6.0MB'
  }
];

// Random selection with genre rotation
const selectDemoTrack = (): AudioAsset => {
  const lastTrack = localStorage.getItem('lastDemoTrack');
  const availableTracks = demoTracks.filter(t => t.id !== lastTrack);
  const selected = availableTracks[Math.floor(Math.random() * availableTracks.length)];
  localStorage.setItem('lastDemoTrack', selected.id);
  return selected;
};

interface DemoContextType {
  isDemoMode: boolean;
  isAuthenticated: boolean;
  currentDemoTrack: AudioAsset | null;
  isLoading: boolean;
  loadRandomDemoTrack: () => void;
  trackDemoEvent: (event: string, properties: any) => void;
  demoTracks: AudioAsset[];
}

const DemoContext = createContext<DemoContextType | null>(null);

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentDemoTrack, setCurrentDemoTrack] = useState<AudioAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const isDemoMode = !user;
  const isAuthenticated = !!user;
  
  const loadRandomDemoTrack = useCallback(async () => {
    setIsLoading(true);
    try {
      const track = selectDemoTrack();
      setCurrentDemoTrack(track);
      
      // Track analytics event
      trackDemoEvent('track_loaded', { 
        trackId: track.id, 
        genre: track.genre, 
        bpm: track.bpm 
      });
      
    } catch (error) {
      console.error('Failed to load demo track:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const trackDemoEvent = useCallback((event: string, properties: any) => {
    if (isDemoMode) {
      // Track demo-specific events
      console.log(`Demo event: ${event}`, {
        ...properties,
        userTier: 'guest',
        isDemo: true,
        timestamp: Date.now()
      });
      
      // TODO: Integrate with analytics service
      // analytics.track(`demo_${event}`, {
      //   ...properties,
      //   userTier: 'guest',
      //   isDemo: true
      // });
    }
  }, [isDemoMode]);
  
  // Auto-load demo track when entering demo mode
  useEffect(() => {
    if (isDemoMode && !currentDemoTrack) {
      loadRandomDemoTrack();
    }
  }, [isDemoMode, currentDemoTrack, loadRandomDemoTrack]);
  
  const value = {
    isDemoMode,
    isAuthenticated,
    currentDemoTrack,
    isLoading,
    loadRandomDemoTrack,
    trackDemoEvent,
    demoTracks
  };
  
  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within DemoProvider');
  }
  return context;
};

// Hook for demo mode detection
export const useDemoMode = () => {
  const { user } = useAuth();
  const isDemoMode = !user;
  
  return {
    isDemoMode,
    isAuthenticated: !!user
  };
}; 