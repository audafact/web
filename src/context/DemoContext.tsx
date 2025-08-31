import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

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

// Demo tracks now come from the database (guest rotation)

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
  const isDemoMode = !user;
  const isAuthenticated = !!user;

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
    }
  }, [isDemoMode]);

  const loadRandomDemoTrack = useCallback(async () => {
    setIsLoading(true);
    try {
      // Use bundled demo tracks instead of database tracks
      const bundledTracks = [
        {
          id: 'underneath-the-moonlight-version-1',
          name: 'Underneath the Moonlight (Version 1)',
          genre: 'ambient',
          bpm: 120,
          file: '/src/assets/audio/underneath-the-moonlight-version-1.mp3',
          type: 'mp3' as const,
          size: 'Unknown'
        },
        {
          id: 'break-the-chains-version-2',
          name: 'Break the Chains (Version 2)',
          genre: 'electronic',
          bpm: 128,
          file: '/src/assets/audio/break-the-chains-version-2.mp3',
          type: 'mp3' as const,
          size: 'Unknown'
        },
        {
          id: 'break-the-chains-version-3',
          name: 'Break the Chains (Version 3)',
          genre: 'electronic',
          bpm: 128,
          file: '/src/assets/audio/break-the-chains-version-3.mp3',
          type: 'mp3' as const,
          size: 'Unknown'
        },
        {
          id: 'groove-vibes-version-3',
          name: 'Groove Vibes (Version 3)',
          genre: 'electronic',
          bpm: 128,
          file: '/src/assets/audio/groove-vibes-version-3.mp3',
          type: 'mp3' as const,
          size: 'Unknown'
        }
      ];

      // Set available demo tracks to bundled tracks
      setAvailableDemoTracks(bundledTracks);

      const selected = selectRandom(bundledTracks);
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
  }, [trackDemoEvent]);
  
  // Preload bundled demo tracks but don't auto-select on refresh
  useEffect(() => {
    const preload = async () => {
      if (!isDemoMode) return;
      try {
        if (!availableDemoTracks || availableDemoTracks.length === 0) {
          // Use bundled demo tracks instead of database tracks
          const bundledTracks = [
            {
              id: 'underneath-the-moonlight-version-1',
              name: 'Underneath the Moonlight (Version 1)',
              genre: 'ambient',
              bpm: 120,
              file: '/src/assets/audio/underneath-the-moonlight-version-1.mp3',
              type: 'mp3' as const,
              size: 'Unknown'
            },
            {
              id: 'break-the-chains-version-2',
              name: 'Break the Chains (Version 2)',
              genre: 'electronic',
              bpm: 128,
              file: '/src/assets/audio/break-the-chains-version-2.mp3',
              type: 'mp3' as const,
              size: 'Unknown'
            },
            {
              id: 'break-the-chains-version-3',
              name: 'Break the Chains (Version 3)',
              genre: 'electronic',
              bpm: 128,
              file: '/src/assets/audio/break-the-chains-version-3.mp3',
              type: 'mp3' as const,
              size: 'Unknown'
            },
            {
              id: 'groove-vibes-version-3',
              name: 'Groove Vibes (Version 3)',
              genre: 'electronic',
              bpm: 128,
              file: '/src/assets/audio/groove-vibes-version-3.mp3',
              type: 'mp3' as const,
              size: 'Unknown'
          }
          ];
          setAvailableDemoTracks(bundledTracks);
        }
        if (!currentDemoTrack) {
          await loadRandomDemoTrack();
        }
      } catch (e) {
        console.error('Failed to preload bundled demo tracks:', e);
      }
    };
    preload();
  }, [isDemoMode]);

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