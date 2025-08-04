import { useState, useEffect } from 'react';
import { LibraryTrack } from '../types/music';
import { trackEvent } from '../services/analyticsService';
import { useUserTier } from './useUserTier';

export const usePreviewAudio = () => {
  const [currentPreview, setCurrentPreview] = useState<{
    trackId: string;
    audio: HTMLAudioElement;
  } | null>(null);
  const { tier } = useUserTier();
  
  const startPreview = async (track: LibraryTrack) => {
    // Stop current preview
    if (currentPreview) {
      currentPreview.audio.pause();
      currentPreview.audio.currentTime = 0;
    }
    
    try {
      // Use the actual file import for preview (fallback to file if previewUrl doesn't work)
      const audioUrl = track.file;
      const audio = new Audio(audioUrl);
      audio.volume = 0.7;
      audio.loop = false;
      
      // Set up event listeners
      audio.addEventListener('ended', () => {
        setCurrentPreview(null);
      });
      
      audio.addEventListener('error', () => {
        console.error('Failed to load preview audio');
        setCurrentPreview(null);
      });
      
      await audio.play();
      setCurrentPreview({ trackId: track.id, audio });
      
      // Track preview event
      trackEvent('library_track_previewed', {
        trackId: track.id,
        genre: track.genre,
        bpm: track.bpm,
        userTier: tier.id
      });
      
    } catch (error) {
      console.error('Failed to start preview:', error);
    }
  };
  
  const stopPreview = () => {
    if (currentPreview) {
      currentPreview.audio.pause();
      currentPreview.audio.currentTime = 0;
      setCurrentPreview(null);
    }
  };
  
  const isPreviewing = (trackId: string) => {
    return currentPreview?.trackId === trackId;
  };
  
  const togglePreview = async (track: LibraryTrack) => {
    if (isPreviewing(track.id)) {
      stopPreview();
    } else {
      await startPreview(track);
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentPreview) {
        currentPreview.audio.pause();
      }
    };
  }, [currentPreview]);
  
  return {
    startPreview,
    stopPreview,
    isPreviewing,
    togglePreview,
    currentPreview
  };
}; 