import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

// Define AudioAsset interface for guest tracks
export interface AudioAsset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  file: string; // URL to bundled guest track
  type: 'wav' | 'mp3';
  size: string;
  duration?: number;
  is_guest?: boolean;
}

// Guest tracks for anonymous users
const GUEST_TRACKS: AudioAsset[] = [
  {
    id: 'hearts-are-golden',
    name: 'Hearts Are Golden',
    genre: 'ambient',
    bpm: 120,
    file: '/assets/library-inbox/hearts-are-golden.mp3',
    type: 'mp3',
    size: 'Unknown',
    is_guest: true
  },
  {
    id: 'break-the-chains-version-1',
    name: 'Break the Chains (Version 1)',
    genre: 'electronic',
    bpm: 128,
    file: '/assets/library-inbox/break-the-chains-version-1.mp3',
    type: 'mp3',
    size: 'Unknown',
    is_guest: true
  },
  {
    id: 'feel-the-rhythm-now-version-1',
    name: 'Feel the Rhythm Now (Version 1)',
    genre: 'electronic',
    bpm: 128,
    file: '/assets/library-inbox/feel-the-rhythm-now-version-1.mp3',
    type: 'mp3',
    size: 'Unknown',
    is_guest: true
  },
  {
    id: 'groove-vibes-version-3',
    name: 'Groove Vibes (Version 3)',
    genre: 'electronic',
    bpm: 128,
    file: '/assets/library-inbox/groove-vibes-version-3.mp3',
    type: 'mp3',
    size: 'Unknown',
    is_guest: true
  }
];

// Random selection helper preserving no-repeat behavior
const selectRandom = (tracks: AudioAsset[]): AudioAsset | null => {
  if (!tracks || tracks.length === 0) return null;
  const lastTrack = localStorage.getItem('lastGuestTrack');
  const pool = tracks.length > 1 ? tracks.filter(t => t.id !== lastTrack) : tracks;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  localStorage.setItem('lastGuestTrack', selected.id);
  return selected;
};

interface GuestContextType {
  isGuestMode: boolean;
  isAuthenticated: boolean;
  currentGuestTrack: AudioAsset | null;
  isLoading: boolean;
  loadRandomGuestTrack: () => void;
  trackGuestEvent: (event: string, properties: any) => void;
  guestTracks: AudioAsset[];
}

const GuestContext = createContext<GuestContextType | null>(null);

export const GuestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentGuestTrack, setCurrentGuestTrack] = useState<AudioAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableGuestTracks, setAvailableGuestTracks] = useState<AudioAsset[]>([]);
  
  const isGuestMode = !user; // Only anonymous users get guest access
  const isAuthenticated = !!user;

  const trackGuestEvent = useCallback((event: string, properties: any) => {
    if (isGuestMode) {
      // Track guest-specific events
      console.log(`Guest event: ${event}`, {
        ...properties,
        userTier: 'guest',
        isGuest: true,
        timestamp: Date.now()
      });
      // TODO: Integrate with analytics service
    }
  }, [isGuestMode]);

  const loadRandomGuestTrack = useCallback(async () => {
    if (user) return; // Don't load guest tracks for authenticated users
    
    setIsLoading(true);
    try {
      // Set available guest tracks
      setAvailableGuestTracks(GUEST_TRACKS);

      const selected = selectRandom(GUEST_TRACKS);
      if (selected) {
        setCurrentGuestTrack(selected);
        trackGuestEvent('track_loaded', {
          trackId: selected.id,
          genre: selected.genre,
          bpm: selected.bpm
        });
      }
    } catch (error) {
      console.error('Failed to load guest track:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, trackGuestEvent]);
  
  // Preload guest tracks for anonymous users
  useEffect(() => {
    if (!isGuestMode) return;
    
    if (!currentGuestTrack && availableGuestTracks.length === 0) {
      loadRandomGuestTrack();
    }
  }, [isGuestMode, currentGuestTrack, availableGuestTracks.length, loadRandomGuestTrack]);

  const value = {
    isGuestMode,
    isAuthenticated,
    currentGuestTrack,
    isLoading,
    loadRandomGuestTrack,
    trackGuestEvent,
    guestTracks: availableGuestTracks
  };
  
  return (
    <GuestContext.Provider value={value}>
      {children}
    </GuestContext.Provider>
  );
};

export const useGuest = () => {
  const context = useContext(GuestContext);
  console.log('useGuest', context);
  if (!context) {
    throw new Error('useGuest must be used within GuestProvider');
  }
  return context;
};