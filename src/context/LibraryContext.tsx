import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useUser } from '../hooks/useUser';
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
  const { tier, libraryTracks, loading: userLoading } = useUser();
  const [currentLibraryTrack, setCurrentLibraryTrack] = useState<AudioAsset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableLibraryTracks, setAvailableLibraryTracks] = useState<AudioAsset[]>([]);
  
  const isLibraryMode = !!user; // Only authenticated users get library access
  const isAuthenticated = !!user;
  const userTier = tier.id as 'free' | 'pro';

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

  const loadRandomLibraryTrack = useCallback(() => {
    if (!user || !libraryTracks || libraryTracks.length === 0) return;
    
    setIsLoading(true);
    try {
      // Transform LibraryTrack to AudioAsset using LibraryService
      const audioAssets: AudioAsset[] = LibraryService.transformToAudioAssets(libraryTracks).map(asset => ({
        ...asset,
        genre: libraryTracks.find(t => t.id === asset.id)?.genre || 'Unknown',
        bpm: libraryTracks.find(t => t.id === asset.id)?.bpm || 0,
        duration: libraryTracks.find(t => t.id === asset.id)?.duration || 0,
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
    } catch (error) {
      console.error('Failed to load library track:', error);
      setAvailableLibraryTracks([]);
      setCurrentLibraryTrack(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, libraryTracks, trackLibraryEvent]);

  // Load tracks when library tracks are available from useUser hook
  useEffect(() => {
    if (!user || userLoading) return;
    
    if (libraryTracks && libraryTracks.length > 0) {
      loadRandomLibraryTrack();
    } else {
      console.log('No library tracks available for user tier:', userTier);
      setAvailableLibraryTracks([]);
      setCurrentLibraryTrack(null);
    }
  }, [user, libraryTracks, userLoading, loadRandomLibraryTrack, userTier]);
  
  // Preload library tracks for authenticated users
  useEffect(() => {
    if (!isLibraryMode) return;
    
    if (!currentLibraryTrack && availableLibraryTracks.length === 0 && !userLoading) {
      loadRandomLibraryTrack();
    }
  }, [isLibraryMode, currentLibraryTrack, availableLibraryTracks.length, loadRandomLibraryTrack, userLoading]);

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