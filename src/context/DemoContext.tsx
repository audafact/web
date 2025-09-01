import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

// Define AudioAsset interface for demo tracks
export interface AudioAsset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  file: string; // URL to bundled demo track
  type: 'wav' | 'mp3';
  size: string;
  duration?: number;
  is_demo?: boolean;
}

// Demo tracks for anonymous users
const DEMO_TRACKS: AudioAsset[] = [
  {
    id: 'underneath-the-moonlight-version-1',
    name: 'Underneath the Moonlight (Version 1)',
    genre: 'ambient',
    bpm: 120,
    file: '/src/assets/audio/underneath-the-moonlight-version-1.mp3',
    type: 'mp3',
    size: 'Unknown',
    is_demo: true
  },
  {
    id: 'break-the-chains-version-2',
    name: 'Break the Chains (Version 2)',
    genre: 'electronic',
    bpm: 128,
    file: '/src/assets/audio/break-the-chains-version-2.mp3',
    type: 'mp3',
    size: 'Unknown',
    is_demo: true
  },
  {
    id: 'break-the-chains-version-3',
    name: 'Break the Chains (Version 3)',
    genre: 'electronic',
    bpm: 128,
    file: '/src/assets/audio/break-the-chains-version-3.mp3',
    type: 'mp3',
    size: 'Unknown',
    is_demo: true
  },
  {
    id: 'groove-vibes-version-3',
    name: 'Groove Vibes (Version 3)',
    genre: 'electronic',
    bpm: 128,
    file: '/src/assets/audio/groove-vibes-version-3.mp3',
    type: 'mp3',
    size: 'Unknown',
    is_demo: true
  }
];

// Random selection helper preserving no-repeat behavior
const selectRandom = (tracks: AudioAsset[]): AudioAsset | null => {
  if (!tracks || tracks.length === 0) return null;
  const lastTrack = localStorage.getItem('lastDemoTrack');
  const pool = tracks.length > 1 ? tracks.filter(t => t.id !== lastTrack) : tracks;
  const selected = pool[Math.floor(Math.random() * pool.length)];
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
  const [availableDemoTracks, setAvailableDemoTracks] = useState<AudioAsset[]>([]);
  
  const isDemoMode = !user; // Only anonymous users get demo access
  const isAuthenticated = !!user;

  const trackDemoEvent = useCallback((event: string, properties: any) => {
    if (isDemoMode) {
      // Track demo-specific events
      console.log(`Demo event: ${event}`, {
        ...properties,
        userTier: 'demo',
        isDemo: true,
        timestamp: Date.now()
      });
      // TODO: Integrate with analytics service
    }
  }, [isDemoMode]);

  const loadRandomDemoTrack = useCallback(async () => {
    if (user) return; // Don't load demo tracks for authenticated users
    
    setIsLoading(true);
    try {
      // Set available demo tracks
      setAvailableDemoTracks(DEMO_TRACKS);

      const selected = selectRandom(DEMO_TRACKS);
      if (selected) {
        setCurrentDemoTrack(selected);
        trackDemoEvent('track_loaded', {
          trackId: selected.id,
          genre: selected.genre,
          bpm: selected.bpm
        });
      }
    } catch (error) {
      console.error('Failed to load demo track:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, trackDemoEvent]);
  
  // Preload demo tracks for anonymous users
  useEffect(() => {
    if (!isDemoMode) return;
    
    if (!currentDemoTrack && availableDemoTracks.length === 0) {
      loadRandomDemoTrack();
    }
  }, [isDemoMode, currentDemoTrack, availableDemoTracks.length, loadRandomDemoTrack]);

  const value = {
    isDemoMode,
    isAuthenticated,
    currentDemoTrack,
    isLoading,
    loadRandomDemoTrack,
    trackDemoEvent,
    demoTracks: availableDemoTracks
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