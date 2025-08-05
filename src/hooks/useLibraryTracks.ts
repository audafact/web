import { useState, useEffect } from 'react';
import { LibraryTrack } from '../types/music';
import { LibraryService } from '../services/libraryService';
import { useUserTier } from './useUserTier';

export interface UseLibraryTracksReturn {
  tracks: LibraryTrack[];
  isLoading: boolean;
  error: string | null;
  rotationInfo: { weekNumber: number; trackCount: number } | null;
  refreshTracks: () => Promise<void>;
  getTracksByGenre: (genre: string) => LibraryTrack[];
  getAvailableGenres: () => string[];
}

export const useLibraryTracks = (): UseLibraryTracksReturn => {
  const { tier } = useUserTier();
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotationInfo, setRotationInfo] = useState<{ weekNumber: number; trackCount: number } | null>(null);

  const loadTracks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [tracksData, rotationData] = await Promise.all([
        LibraryService.getLibraryTracks(tier.id),
        LibraryService.getCurrentRotationInfo()
      ]);
      
      setTracks(tracksData);
      setRotationInfo(rotationData);
    } catch (err) {
      console.error('Error loading library tracks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tracks');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTracks = async () => {
    await loadTracks();
  };

  const getTracksByGenre = (genre: string): LibraryTrack[] => {
    return tracks.filter(track => track.genre === genre);
  };

  const getAvailableGenres = (): string[] => {
    return [...new Set(tracks.map(track => track.genre))];
  };

  // Load tracks when tier changes
  useEffect(() => {
    loadTracks();
  }, [tier.id]);

  return {
    tracks,
    isLoading,
    error,
    rotationInfo,
    refreshTracks,
    getTracksByGenre,
    getAvailableGenres
  };
}; 