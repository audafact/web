import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { GUIDED_GEN_AI } from '../config/onboardingSessionConfig';

// Define AudioAsset interface for guest tracks
export interface AudioAsset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  file: string; // URL to bundled guest track
  type: 'wav' | 'mp3' | 'm4a';
  size: string;
  duration?: number;
  is_guest?: boolean;
}

// Guest randomization pool (used only for optional exploration after guided demo)
const GUEST_TRACKS: AudioAsset[] = [
  ...GUIDED_GEN_AI.map((track) => ({
    id: track.id,
    name: track.name,
    genre: 'gen-ai',
    bpm: track.bpm,
    file: track.file,
    type: track.type,
    size: 'Unknown',
    is_guest: true,
  })),
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
  /** Bundled /assets/library-inbox/* demo audio — only for anonymous users; always null when signed in. */
  currentGuestTrack: AudioAsset | null;
  isLoading: boolean;
  /** No-op with `null` when signed in. Returns the selected track for immediate use (avoids stale React state). */
  loadRandomGuestTrack: () => Promise<AudioAsset | null>;
  trackGuestEvent: (event: string, properties: any) => void;
  /** Empty when signed in so library UI always uses Supabase + Worker for QA parity with production. */
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
    if (!user) {
      // Track guest-specific events
      console.log(`Guest event: ${event}`, {
        ...properties,
        userTier: 'guest',
        isGuest: true,
        timestamp: Date.now()
      });
      // TODO: Integrate with analytics service
    }
  }, [user]);

  const loadRandomGuestTrack = useCallback(async (): Promise<AudioAsset | null> => {
    if (user) return null;

    setIsLoading(true);
    try {
      setAvailableGuestTracks(GUEST_TRACKS);

      const selected = selectRandom(GUEST_TRACKS);
      if (selected) {
        setCurrentGuestTrack(selected);
        trackGuestEvent('track_loaded', {
          trackId: selected.id,
          genre: selected.genre,
          bpm: selected.bpm
        });
        return selected;
      }
      return null;
    } catch (error) {
      console.error('Failed to load guest track:', error);
      return null;
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

  // Signed-in QA must use library + Worker (staging API), never bundled /assets/library-inbox URLs.
  useEffect(() => {
    if (!user) return;
    setCurrentGuestTrack(null);
    setAvailableGuestTracks([]);
  }, [user]);

  const value = {
    isGuestMode,
    isAuthenticated,
    currentGuestTrack: isGuestMode ? currentGuestTrack : null,
    isLoading,
    loadRandomGuestTrack,
    trackGuestEvent,
    guestTracks: isGuestMode ? availableGuestTracks : [],
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