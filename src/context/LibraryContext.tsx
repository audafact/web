import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { LibraryService } from '../services/libraryService';
import { LibraryTrack } from '../types/music';

// Define AudioAsset interface for library tracks
export interface AudioAsset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  fileKey: string;
  type: 'wav' | 'mp3';
  size: string;
  duration?: number;
  is_demo?: boolean;
}

// Random selection helper preserving no-repeat behavior
const selectRandom = (tracks: AudioAsset[]): AudioAsset | null => {
  if (!tracks || tracks.length === 0) return null;
  const lastTrack = localStorage.getItem('lastLibraryTrack');
  const pool = tracks.length > 1 ? tracks.filter(t => t.id !== lastTrack) : tracks;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  localStorage.setItem('lastLibraryTrack', selected.id);
  return selected;
};

interface LibraryContextType {
  isLibraryMode: boolean;
  isAuthenticated: boolean;
  currentLibraryTrack: AudioAsset | null;
  isLoading: boolean;
  loadRandomLibraryTrack: () => void;
  trackLibraryEvent: (event: string, properties: any) => void;
  libraryTracks: AudioAsset[];
  userTier: 'free' | 'pro';
}

const LibraryContext = createContext<LibraryContextType | null>(null);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentLibraryTrack, setCurrentLibraryTrack] = useState<AudioAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableLibraryTracks, setAvailableLibraryTracks] = useState<AudioAsset[]>([]);
  const [userTier, setUserTier] = useState<'free' | 'pro'>('free');
  
  const isLibraryMode = !!user; // Only authenticated users get library access
  const isAuthenticated = !!user;

  const trackLibraryEvent = useCallback((event: string, properties: any) => {
    if (isLibraryMode) {
      // Track library-specific events
      console.log(`Library event: ${event}`, {
        ...properties,
        userTier,
        isLibrary: true,
        timestamp: Date.now()
      });
      // TODO: Integrate with analytics service
    }
  }, [isLibraryMode, userTier]);

  const loadRandomLibraryTrack = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Get tracks based on user tier
      const tracks = await LibraryService.getLibraryTracks(userTier);
      
      if (tracks && tracks.length > 0) {
        // Transform LibraryTrack to AudioAsset
        const audioAssets: AudioAsset[] = tracks.map(track => ({
          id: track.id,
          name: track.name,
          genre: track.genre,
          bpm: track.bpm,
          fileKey: track.fileKey,
          type: track.type,
          size: track.size,
          duration: track.duration,
          is_demo: false
        }));
        
        setAvailableLibraryTracks(audioAssets);
        
        const selected = selectRandom(audioAssets);
        if (selected) {
          setCurrentLibraryTrack(selected);
          trackLibraryEvent('track_loaded', {
            trackId: selected.id,
            genre: selected.genre,
            bpm: selected.bpm
          });
        }
      } else {
        console.log('No library tracks available for user tier:', userTier);
        setAvailableLibraryTracks([]);
        setCurrentLibraryTrack(null);
      }
    } catch (error) {
      console.error('Failed to load library track:', error);
      setAvailableLibraryTracks([]);
      setCurrentLibraryTrack(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, userTier, trackLibraryEvent]);

  // Determine user tier and load tracks
  useEffect(() => {
    if (!user) return;
    
    // TODO: This should come from user profile or subscription service
    // For now, assume all authenticated users are 'free' until we implement tier detection
    const tier = 'free'; // This should be fetched from user profile
    setUserTier(tier);
    
    // Load tracks for the user
    loadRandomLibraryTrack();
  }, [user, loadRandomLibraryTrack]);
  
  // Preload library tracks for authenticated users
  useEffect(() => {
    if (!isLibraryMode) return;
    
    if (!currentLibraryTrack && availableLibraryTracks.length === 0) {
      loadRandomLibraryTrack();
    }
  }, [isLibraryMode, currentLibraryTrack, availableLibraryTracks.length, loadRandomLibraryTrack]);

  const value = {
    isLibraryMode,
    isAuthenticated,
    currentLibraryTrack,
    isLoading,
    loadRandomLibraryTrack,
    trackLibraryEvent,
    libraryTracks: availableLibraryTracks,
    userTier
  };
  
  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within LibraryProvider');
  }
  return context;
};

// Hook for library mode detection
export const useLibraryMode = () => {
  const { user } = useAuth();
  const isLibraryMode = !!user;
  
  return {
    isLibraryMode,
    isAuthenticated: !!user
  };
}; 