import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Define AudioAsset interface for bundled tracks
export interface BundledAudioAsset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  file: string;
  type: 'wav' | 'mp3';
  size: string;
  duration?: number;
}

// Bundled tracks for anonymous users
const BUNDLED_TRACKS: BundledAudioAsset[] = [
  {
    id: 'underneath-the-moonlight-version-1',
    name: 'Underneath the Moonlight (Version 1)',
    genre: 'ambient',
    bpm: 120,
    file: '/src/assets/audio/underneath-the-moonlight-version-1.mp3',
    type: 'mp3',
    size: 'Unknown'
  },
  {
    id: 'break-the-chains-version-2',
    name: 'Break the Chains (Version 2)',
    genre: 'electronic',
    bpm: 128,
    file: '/src/assets/audio/break-the-chains-version-2.mp3',
    type: 'mp3',
    size: 'Unknown'
  },
  {
    id: 'break-the-chains-version-3',
    name: 'Break the Chains (Version 3)',
    genre: 'electronic',
    bpm: 128,
    file: '/src/assets/audio/break-the-chains-version-3.mp3',
    type: 'mp3',
    size: 'Unknown'
  },
  {
    id: 'groove-vibes-version-3',
    name: 'Groove Vibes (Version 3)',
    genre: 'electronic',
    bpm: 128,
    file: '/src/assets/audio/groove-vibes-version-3.mp3',
    type: 'mp3',
    size: 'Unknown'
  }
];

// Random selection helper preserving no-repeat behavior
const selectRandom = (tracks: BundledAudioAsset[]): BundledAudioAsset | null => {
  if (!tracks || tracks.length === 0) return null;
  const lastTrack = localStorage.getItem('lastBundledTrack');
  const pool = tracks.length > 1 ? tracks.filter(t => t.id !== lastTrack) : tracks;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  localStorage.setItem('lastBundledTrack', selected.id);
  return selected;
};

interface GuestContextType {
  isGuestMode: boolean;
  currentBundledTrack: BundledAudioAsset | null;
  isLoading: boolean;
  loadRandomBundledTrack: () => void;
  trackGuestEvent: (event: string, properties: any) => void;
  bundledTracks: BundledAudioAsset[];
}

const GuestContext = createContext<GuestContextType | null>(null);

export const GuestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentBundledTrack, setCurrentBundledTrack] = useState<BundledAudioAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableBundledTracks, setAvailableBundledTracks] = useState<BundledAudioAsset[]>([]);

  const trackGuestEvent = useCallback((event: string, properties: any) => {
    // Track guest-specific events
    console.log(`Guest event: ${event}`, {
      ...properties,
      userTier: 'guest',
      isGuest: true,
      timestamp: Date.now()
    });
    // TODO: Integrate with analytics service
  }, []);

  const loadRandomBundledTrack = useCallback(async () => {
    setIsLoading(true);
    try {
      // Set available bundled tracks
      setAvailableBundledTracks(BUNDLED_TRACKS);

      const selected = selectRandom(BUNDLED_TRACKS);
      if (selected) {
        setCurrentBundledTrack(selected);
        trackGuestEvent('track_loaded', {
          trackId: selected.id,
          genre: selected.genre,
          bpm: selected.bpm
        });
      }
    } catch (error) {
      console.error('Failed to load bundled track:', error);
    } finally {
      setIsLoading(false);
    }
  }, [trackGuestEvent]);
  
  // Preload bundled tracks but don't auto-select on refresh
  useEffect(() => {
    const preload = async () => {
      try {
        if (!availableBundledTracks || availableBundledTracks.length === 0) {
          setAvailableBundledTracks(BUNDLED_TRACKS);
        }
        if (!currentBundledTrack) {
          await loadRandomBundledTrack();
        }
      } catch (e) {
        console.error('Failed to preload bundled tracks:', e);
      }
    };
    preload();
  }, []);

  const value = {
    isGuestMode: true,
    currentBundledTrack,
    isLoading,
    loadRandomBundledTrack,
    trackGuestEvent,
    bundledTracks: availableBundledTracks
  };
  
  return (
    <GuestContext.Provider value={value}>
      {children}
    </GuestContext.Provider>
  );
};

export const useGuest = () => {
  const context = useContext(GuestContext);
  if (!context) {
    throw new Error('useGuest must be used within GuestProvider');
  }
  return context;
};
