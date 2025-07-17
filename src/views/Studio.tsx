import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioContext } from '../context/AudioContext';
import WaveformDisplay from '../components/WaveformDisplay';
import TrackControls from '../components/TrackControls';
import ModeSelector from '../components/ModeSelector';
import TempoControls from '../components/TempoControls';
import TimeSignatureControls from '../components/TimeSignatureControls';
import { TimeSignature } from '../types/music';

// Import preloaded audio files
import secretsOfTheHeart from '../assets/audio/Secrets of the Heart.mp3';
import ronDrums from '../assets/audio/RON-drums.wav';
import rhythmRevealed from '../assets/audio/The Rhythm Revealed(Drums).wav';
import unveiledDesires from '../assets/audio/Unveiled Desires.wav';

// Define available audio assets
const audioAssets: AudioAsset[] = [
  {
    id: 'ron-drums',
    name: 'RON Drums',
    file: ronDrums,
    type: 'wav',
    size: '5.5MB'
  },
  {
    id: 'secrets-of-the-heart',
    name: 'Secrets of the Heart',
    file: secretsOfTheHeart,
    type: 'mp3',
    size: '775KB'
  },
  {
    id: 'rhythm-revealed',
    name: 'The Rhythm Revealed (Drums)',
    file: rhythmRevealed,
    type: 'wav',
    size: '5.5MB'
  },
  {
    id: 'unveiled-desires',
    name: 'Unveiled Desires',
    file: unveiledDesires,
    type: 'wav',
    size: '6.0MB'
  }
];

// Define a Track type
interface Track {
  id: string;
  file: File;
  buffer: AudioBuffer;
  mode: 'preview' | 'loop' | 'cue';
  loopStart: number;
  loopEnd: number;
  cuePoints: number[];
  tempo: number;
  timeSignature: TimeSignature;
  firstMeasureTime: number;
  showMeasures: boolean;
}

// Define AudioAsset interface for library
interface AudioAsset {
  id: string;
  name: string;
  file: string;
  type: 'wav' | 'mp3';
  size: string;
  duration?: number;
}

const Studio = () => {
  const { audioContext, initializeAudio, resumeAudioContext } = useAudioContext();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAudioInitialized, setIsAudioInitialized] = useState<boolean>(false);
  const [loopPlayhead, setLoopPlayhead] = useState(0);
  const [samplePlayhead, setSamplePlayhead] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedCueTrackId, setSelectedCueTrackId] = useState<string | null>(null);
  const [playbackTimes, setPlaybackTimes] = useState<{ [key: string]: number }>({});
  const [zoomLevels, setZoomLevels] = useState<{ [key: string]: number }>({});
  const [playbackSpeeds, setPlaybackSpeeds] = useState<{ [key: string]: number }>({});
  const [volume, setVolume] = useState<{ [key: string]: number }>({});
  // Add lastUsedVolume state
  const [lastUsedVolume, setLastUsedVolume] = useState<number>(1);
  const lastUsedVolumeRef = useRef(lastUsedVolume);
  useEffect(() => {
    lastUsedVolumeRef.current = lastUsedVolume;
  }, [lastUsedVolume]);
  const [showMeasures, setShowMeasures] = useState<{ [key: string]: boolean }>({});
  // Add state for showing cue thumbs
  const [showCueThumbs, setShowCueThumbs] = useState<{ [key: string]: boolean }>({});
  // Add playback state tracking
  const [playbackStates, setPlaybackStates] = useState<{ [key: string]: boolean }>({});
  // Add accordion state for collapsible controls
  const [expandedControls, setExpandedControls] = useState<{ [key: string]: boolean }>({});
  
  // Track navigation state
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  
  // Add track functionality state
  const [isAddingTrack, setIsAddingTrack] = useState<boolean>(false);
  const [addTrackAnimation, setAddTrackAnimation] = useState<boolean>(false);
  const [canAddTrack, setCanAddTrack] = useState<boolean>(false);
  const [showAddTrackGesture, setShowAddTrackGesture] = useState<boolean>(false);
  
  // Separate loading states
  const [isTrackLoading, setIsTrackLoading] = useState<boolean>(false);
  const [isWaveformLoading, setIsWaveformLoading] = useState<boolean>(false);

  // --- Utility functions for localStorage ---
  const saveCuePointsToLocal = (trackId: string, cuePoints: number[]) => {
    localStorage.setItem(`cuePoints-${trackId}`, JSON.stringify(cuePoints));
  };
  const loadCuePointsFromLocal = (trackId: string): number[] | null => {
    const saved = localStorage.getItem(`cuePoints-${trackId}`);
    return saved ? JSON.parse(saved) : null;
  };
  const removeCuePointsFromLocal = (trackId: string) => {
    localStorage.removeItem(`cuePoints-${trackId}`);
  };

  // --- PATCH: Settings persistence ---
  const saveTrackSettingsToLocal = (trackId: string, settings: any) => {
    localStorage.setItem(`trackSettings-${trackId}`, JSON.stringify(settings));
  };
  const loadTrackSettingsFromLocal = (trackId: string): any | null => {
    const saved = localStorage.getItem(`trackSettings-${trackId}`);
    return saved ? JSON.parse(saved) : null;
  };
  const removeTrackSettingsFromLocal = (trackId: string) => {
    localStorage.removeItem(`trackSettings-${trackId}`);
  };
  const saveSelectedCueTrackIdToLocal = (trackId: string | null) => {
    if (trackId) {
      localStorage.setItem('selectedCueTrackId', trackId);
    } else {
      localStorage.removeItem('selectedCueTrackId');
    }
  };
  const loadSelectedCueTrackIdFromLocal = (): string | null => {
    return localStorage.getItem('selectedCueTrackId');
  };

  // --- PATCH: Load settings on mount ---
  useEffect(() => {
    // Load selected cue track id
    const selected = loadSelectedCueTrackIdFromLocal();
    if (selected) setSelectedCueTrackId(selected);
  }, []);

  // Monitor tracks to determine if we can add a new track
  useEffect(() => {
    if (tracks.length === 0) {
      setCanAddTrack(false);
      return;
    }
    
    // Check if the top track (first in array) is in preview mode
    const topTrack = tracks[0];
    const hasPreviewTrack = topTrack && topTrack.mode === 'preview';
    
    // Can add track if there's no preview track or if the top track is not in preview mode
    setCanAddTrack(!hasPreviewTrack);
  }, [tracks]);

  // Load a random track on component mount
  useEffect(() => {
    const loadRandomTrack = async () => {
      try {
        setIsTrackLoading(true);
        setIsWaveformLoading(true);
        setError(null);
        
        // Select a random asset
        const randomIndex = Math.floor(Math.random() * audioAssets.length);
        const asset = audioAssets[randomIndex];
        
        // Use existing audio context if available
        let context = audioContext;

        if (!context) {
          try {
            context = await initializeAudio();
            setIsAudioInitialized(true);
          } catch (initError) {
            console.error('Error initializing audio context:', initError);
            throw new Error('Unable to initialize audio. Please try again or check your browser settings.');
          }
        } else if (context.state === 'suspended') {
          try {
            await context.resume();
          } catch (resumeError) {
            console.error('Failed to resume audio context:', resumeError);
            throw new Error('Browser blocked audio playback. Please try again.');
          }
        }

        if (!context) {
          throw new Error('Audio initialization failed. Please try again.');
        }
        
        // Fetch the audio file from the asset
        const response = await fetch(asset.file);
        const blob = await response.blob();
        const file = new File([blob], `${asset.name}.${asset.type}`, { type: `audio/${asset.type}` });
        
        // Load the audio file into buffer
        const buffer = await loadAudioBuffer(file, context);
        
        // Generate track ID
        const trackId = asset.id;
        
        // Try to load settings from localStorage
        const settings = loadTrackSettingsFromLocal(trackId) || {};
        
        const newTrack: Track = {
          id: trackId,
          file,
          buffer,
          mode: settings.mode || 'preview', // Default to preview mode
          loopStart: settings.loopStart || 0,
          loopEnd: settings.loopEnd || buffer.duration,
          cuePoints: settings.cuePoints || Array.from({ length: 10 }, (_, i) => 
            buffer.duration * (i / 10)
          ),
          tempo: settings.tempo || 120,
          timeSignature: settings.timeSignature || { numerator: 4, denominator: 4 },
          firstMeasureTime: settings.firstMeasureTime || 0,
          showMeasures: settings.showMeasures || false
        };
        
        setTracks([newTrack]);
        setCurrentTrackIndex(randomIndex);
        setShowMeasures(prev => ({ ...prev, [trackId]: !!settings.showMeasures }));
        setShowCueThumbs(prev => ({ ...prev, [trackId]: !!settings.showCueThumbs }));
        setZoomLevels(prev => ({ ...prev, [trackId]: settings.zoomLevel || 1 }));
        // Reset playback speed but keep volume
        setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
        // Set volume based on mode
        const trackVolume = newTrack.mode === 'preview' 
          ? lastUsedVolumeRef.current 
          : (typeof settings.volume === 'number' ? settings.volume : lastUsedVolumeRef.current);
        setVolume(prev => ({ ...prev, [trackId]: trackVolume }));
        setExpandedControls(prev => ({ ...prev, [trackId]: false }));
        
        // Track loading is complete
        setIsTrackLoading(false);
        
        // Waveform loading will be handled by the WaveformDisplay component
        // We'll set a small delay to simulate waveform loading
        setTimeout(() => {
          setIsWaveformLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error loading random track:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        setError(`Error loading track: ${errorMessage}`);
        setIsTrackLoading(false);
        setIsWaveformLoading(false);
      }
    };

    loadRandomTrack();
  }, [audioContext, initializeAudio]);

  // Keyboard navigation for track switching
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePreviousTrack();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNextTrack();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [tracks, currentTrackIndex]);

  // Touch/swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTrackLoading || isWaveformLoading) return; // Disable during loading
    
    // Prevent browser navigation gestures from the start
    e.preventDefault();
    
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
    setIsSwiping(false);
    setSwipeDirection(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isTrackLoading || isWaveformLoading) return; // Disable during loading
    if (touchStartX === null || touchStartY === null) return;
    
    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    setTouchEndX(currentX);
    setTouchEndY(currentY);
    
    const deltaX = Math.abs(touchStartX - currentX);
    const deltaY = Math.abs(touchStartY - currentY);
    
    // Check for vertical swipe down gesture for add track
    const rawDeltaY = touchStartY - currentY; // Negative means finger moved down
    const isVerticalSwipeDown = deltaY > 50 && deltaY > deltaX * 2 && rawDeltaY < 0 && deltaX < 50;
    
    // Prevent browser navigation gestures early if this looks like horizontal movement
    const potentialHorizontalMovement = deltaX > 20 && deltaX > deltaY;
    if (potentialHorizontalMovement) {
      e.preventDefault();
    }
    
    // Show add track gesture indicator if valid gesture and can add track
    if (isVerticalSwipeDown && canAddTrack && !isAddingTrack) {
      setShowAddTrackGesture(true);
      e.preventDefault(); // Prevent browser pulldown gestures
    } else {
      setShowAddTrackGesture(false);
    }
    
    // More strict horizontal swipe detection:
    // 1. Horizontal movement must be at least 100px
    // 2. Horizontal movement must be at least 3x larger than vertical
    // 3. Vertical movement must be less than 50px to avoid accidental triggers
    const isHorizontalSwipe = deltaX > 100 && deltaX > deltaY * 3 && deltaY < 50;
    
    if (isHorizontalSwipe) {
      setIsSwiping(true);
      setSwipeDirection((touchStartX - currentX) > 0 ? 'left' : 'right');
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isTrackLoading || isWaveformLoading) return; // Disable during loading
    if (touchStartX === null || touchEndX === null || touchStartY === null || touchEndY === null) return;
    
    // Prevent any browser navigation
    e.preventDefault();
    
    const deltaX = touchStartX - touchEndX;
    const deltaY = touchStartY - touchEndY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    // Strict horizontal swipe validation:
    // 1. Horizontal movement must be at least 100px
    // 2. Horizontal movement must be at least 3x larger than vertical
    // 3. Vertical movement must be less than 50px
    const isValidHorizontalSwipe = absDeltaX > 100 && absDeltaX > absDeltaY * 3 && absDeltaY < 50;
    
    // Strict vertical swipe validation for add track:
    // 1. Vertical movement must be at least 100px
    // 2. Vertical movement must be at least 3x larger than horizontal
    // 3. Horizontal movement must be less than 50px
    // 4. Must be a downward swipe (negative deltaY means finger moved down)
    const isValidVerticalSwipe = absDeltaY > 100 && absDeltaY > absDeltaX * 3 && absDeltaX < 50;
    
    if (isValidHorizontalSwipe) {
      if (deltaX > 0) {
        // Swiped left (finger moved left) - next track
        handleNextTrack();
      } else {
        // Swiped right (finger moved right) - previous track
        handlePreviousTrack();
      }
    } else if (isValidVerticalSwipe && deltaY < 0) {
      // Swiped down (finger moved down) - add track
      if (canAddTrack && !isAddingTrack) {
        addNewTrack();
      }
    }
    
    // Reset touch state
    setTouchStartX(null);
    setTouchEndX(null);
    setTouchStartY(null);
    setTouchEndY(null);
    setIsSwiping(false);
    setSwipeDirection(null);
    setShowAddTrackGesture(false);
  };

  // Mouse wheel handler for track navigation and adding tracks
  const handleWheel = (e: React.WheelEvent) => {
    if (isTrackLoading || isWaveformLoading) return; // Disable during loading
    
    const absDeltaX = Math.abs(e.deltaX);
    const absDeltaY = Math.abs(e.deltaY);
    

    
    // Handle horizontal trackpad gestures for track navigation
    const isHorizontalGesture = absDeltaX > absDeltaY && absDeltaX > 10;
    
    // Handle vertical trackpad gestures for adding tracks
    // Relaxed thresholds: lower minimum movement, allow more horizontal drift
    const isVerticalGesture = absDeltaY > absDeltaX && absDeltaY > 10 && absDeltaX < 25;
    
    if (isHorizontalGesture) {
      // Prevent default only for horizontal gestures
      e.preventDefault();
      
      if (e.deltaX > 0) {
        // Scrolling right - next track
        handleNextTrack();
      } else if (e.deltaX < 0) {
        // Scrolling left - previous track
        handlePreviousTrack();
      }
    } else if (isVerticalGesture && e.deltaY < 0 && canAddTrack && !isAddingTrack) {
      // Scrolling down - add track (negative deltaY = down)
      e.preventDefault();
      addNewTrack();
    }
    // For other gestures, allow normal scrolling to pass through
  };

  // Track navigation functions
  const handleNextTrack = useCallback(async () => {
    if (isTrackLoading || isWaveformLoading) return; // Disable during loading
    if (tracks.length === 0) return;
    
    const nextIndex = (currentTrackIndex + 1) % audioAssets.length;
    await loadTrackByIndex(nextIndex);
  }, [tracks.length, currentTrackIndex, isTrackLoading, isWaveformLoading]);

  const handlePreviousTrack = useCallback(async () => {
    if (isTrackLoading || isWaveformLoading) return; // Disable during loading
    if (tracks.length === 0) return;
    
    const prevIndex = currentTrackIndex === 0 ? audioAssets.length - 1 : currentTrackIndex -1;
    await loadTrackByIndex(prevIndex);
  }, [tracks.length, currentTrackIndex, isTrackLoading, isWaveformLoading]);

  const loadTrackByIndex = async (index: number) => {
    try {
      setIsTrackLoading(true);
      setIsWaveformLoading(true);
      setError(null);
      
      const asset = audioAssets[index];
      
      // Use existing audio context if available
      let context = audioContext;

      if (!context) {
        try {
          context = await initializeAudio();
          setIsAudioInitialized(true);
        } catch (initError) {
          console.error('Error initializing audio context:', initError);
          throw new Error('Unable to initialize audio. Please try again or check your browser settings.');
        }
      } else if (context.state === 'suspended') {
        try {
          await context.resume();
        } catch (resumeError) {
          console.error('Failed to resume audio context:', resumeError);
          throw new Error('Browser blocked audio playback. Please try again.');
        }
      }

      if (!context) {
        throw new Error('Audio initialization failed. Please try again.');
      }
      
      // Fetch the audio file from the asset
      const response = await fetch(asset.file);
      const blob = await response.blob();
      const file = new File([blob], `${asset.name}.${asset.type}`, { type: `audio/${asset.type}` });
      
      // Load the audio file into buffer
      const buffer = await loadAudioBuffer(file, context);
      
      // Generate track ID
      const trackId = asset.id;
      
      // Try to load settings from localStorage
      const settings = loadTrackSettingsFromLocal(trackId) || {};
      
      const newTrack: Track = {
        id: trackId,
        file,
        buffer,
        mode: settings.mode || 'preview', // Default to preview mode
        loopStart: settings.loopStart || 0,
        loopEnd: settings.loopEnd || buffer.duration,
        cuePoints: settings.cuePoints || Array.from({ length: 10 }, (_, i) => 
          buffer.duration * (i / 10)
        ),
        tempo: settings.tempo || 120,
        timeSignature: settings.timeSignature || { numerator: 4, denominator: 4 },
        firstMeasureTime: settings.firstMeasureTime || 0,
        showMeasures: settings.showMeasures || false
      };
      
      setTracks([newTrack]);
      setCurrentTrackIndex(index);
      setShowMeasures(prev => ({ ...prev, [trackId]: !!settings.showMeasures }));
      setShowCueThumbs(prev => ({ ...prev, [trackId]: !!settings.showCueThumbs }));
      setZoomLevels(prev => ({ ...prev, [trackId]: settings.zoomLevel || 1 }));
      // Reset playback speed but keep volume
      setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
      // Set volume based on mode
      const trackVolume = newTrack.mode === 'preview' 
        ? lastUsedVolumeRef.current 
        : (typeof settings.volume === 'number' ? settings.volume : lastUsedVolumeRef.current);
      setVolume(prev => ({ ...prev, [trackId]: trackVolume }));
      setExpandedControls(prev => ({ ...prev, [trackId]: false }));
      
      // Track loading is complete
      setIsTrackLoading(false);
      
      // Waveform loading will be handled by the WaveformDisplay component
      // We'll set a small delay to simulate waveform loading
      setTimeout(() => {
        setIsWaveformLoading(false);
      }, 500);
    
    } catch (error) {
      console.error('Error loading track by index:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(`Error loading track: ${errorMessage}`);
      setIsTrackLoading(false);
      setIsWaveformLoading(false);
    }
  };

  // Add new track function
  const addNewTrack = async () => {
    if (!canAddTrack || isAddingTrack) return;
    
    try {
      setIsAddingTrack(true);
      setAddTrackAnimation(true);
      setError(null);
      
      // Select a random asset that's different from existing tracks
      const existingAssetIds = tracks.map(track => track.id);
      const availableAssets = audioAssets.filter(asset => !existingAssetIds.includes(asset.id));
      
      // If all assets are used, allow duplicates but with different IDs
      let selectedAsset;
      if (availableAssets.length > 0) {
        selectedAsset = availableAssets[Math.floor(Math.random() * availableAssets.length)];
      } else {
        selectedAsset = audioAssets[Math.floor(Math.random() * audioAssets.length)];
      }
      
      // Use existing audio context
      let context = audioContext;
      if (!context) {
        context = await initializeAudio();
        setIsAudioInitialized(true);
      } else if (context.state === 'suspended') {
        await context.resume();
      }

      if (!context) {
        throw new Error('Audio initialization failed. Please try again.');
      }
      
      // Fetch the audio file from the asset
      const response = await fetch(selectedAsset.file);
      const blob = await response.blob();
      const file = new File([blob], `${selectedAsset.name}.${selectedAsset.type}`, { type: `audio/${selectedAsset.type}` });
      
      // Load the audio file into buffer
      const buffer = await loadAudioBuffer(file, context);
      
      // Generate unique track ID
      const timestamp = Date.now();
      const trackId = `${selectedAsset.id}-${timestamp}`;
      
      const newTrack: Track = {
        id: trackId,
        file,
        buffer,
        mode: 'preview', // New tracks always start as preview
        loopStart: 0,
        loopEnd: buffer.duration,
        cuePoints: Array.from({ length: 10 }, (_, i) => 
          buffer.duration * (i / 10)
        ),
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        firstMeasureTime: 0,
        showMeasures: false
      };
      
      // Update existing tracks: force non-preview modes for tracks that will be pushed down
      const updatedExistingTracks = tracks.map(track => {
        if (track.mode === 'preview') {
          // Change preview tracks to loop mode when pushed down
          return { ...track, mode: 'loop' as const };
        }
        return track;
      });
      
      // Add new track to the beginning of the array (top of stack)
      setTracks([newTrack, ...updatedExistingTracks]);
      
      // Initialize states for the new track
      setShowMeasures(prev => ({ ...prev, [trackId]: false }));
      setShowCueThumbs(prev => ({ ...prev, [trackId]: false }));
      setZoomLevels(prev => ({ ...prev, [trackId]: 1 }));
      setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
      setVolume(prev => ({ ...prev, [trackId]: lastUsedVolumeRef.current }));
      setExpandedControls(prev => ({ ...prev, [trackId]: false }));
      
      // Animation delay
      setTimeout(() => {
        setAddTrackAnimation(false);
        setIsAddingTrack(false);
      }, 500);
      
    } catch (error) {
      console.error('Error adding new track:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(`Error adding track: ${errorMessage}`);
      setIsAddingTrack(false);
      setAddTrackAnimation(false);
    }
  };

  // Remove track function
  const removeTrack = (trackId: string) => {
    if (tracks.length <= 1) return; // Don't allow removing the last track
    
    setTracks(prev => {
      const filtered = prev.filter(track => track.id !== trackId);
      
      // If we removed the top track and there are remaining tracks,
      // make sure the new top track can be preview mode
      if (filtered.length > 0 && prev[0]?.id === trackId) {
        // The track that was second is now first, allow it to be preview if desired
        // (User can change mode manually)
      }
      
      return filtered;
    });
    
    // Clean up track-specific states
    setShowMeasures(prev => {
      const { [trackId]: removed, ...rest } = prev;
      return rest;
    });
    setShowCueThumbs(prev => {
      const { [trackId]: removed, ...rest } = prev;
      return rest;
    });
    setZoomLevels(prev => {
      const { [trackId]: removed, ...rest } = prev;
      return rest;
    });
    setPlaybackSpeeds(prev => {
      const { [trackId]: removed, ...rest } = prev;
      return rest;
    });
    setVolume(prev => {
      const { [trackId]: removed, ...rest } = prev;
      return rest;
    });
    setExpandedControls(prev => {
      const { [trackId]: removed, ...rest } = prev;
      return rest;
    });
    
    // Clean up selected cue track if it was removed
    if (selectedCueTrackId === trackId) {
      setSelectedCueTrackId(null);
    }
    
    // Clean up localStorage
    removeTrackSettingsFromLocal(trackId);
    removeCuePointsFromLocal(trackId);
  };

  // Persist all track settings to localStorage when they change
  useEffect(() => {
    tracks.forEach(track => {
      if (!track) return;
      const settings: any = {
        mode: track.mode,
        loopStart: track.loopStart,
        loopEnd: track.loopEnd,
        tempo: track.tempo,
        timeSignature: track.timeSignature,
        firstMeasureTime: track.firstMeasureTime,
        showMeasures: showMeasures[track.id] || false,
        showCueThumbs: showCueThumbs[track.id] || false,
        zoomLevel: zoomLevels[track.id] || 1,
        playbackSpeed: playbackSpeeds[track.id] || 1   };
      
      // Only save volume for loop and cue tracks
      if (track.mode !== 'preview') {
        settings.volume = volume[track.id] || 1    }
      
      saveTrackSettingsToLocal(track.id, settings);
    });
  }, [tracks, showMeasures, showCueThumbs, zoomLevels, playbackSpeeds, volume]);

  // Persist selected cue track id
  useEffect(() => {
    saveSelectedCueTrackIdToLocal(selectedCueTrackId);
  }, [selectedCueTrackId]);

  const loadAudioBuffer = async (file: File, context: AudioContext): Promise<AudioBuffer> => {
    if (!context) throw new Error('Audio context not initialized');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          if (!e.target) {
            reject(new Error('Failed to read file. Please try again.'));
            return;
          }
          
          const arrayBuffer = e.target.result as ArrayBuffer;
          if (!arrayBuffer) {
            reject(new Error('Failed to read file. Please try again.'));
            return;
          }
          
          try {
            const decodedBuffer = await context.decodeAudioData(arrayBuffer);
            resolve(decodedBuffer);
          } catch (decodeError) {
            console.error('Failed to decode audio data:', decodeError);
            reject(new Error('Unable to decode audio file. The file might be corrupted or in an unsupported format. Please try a different file.'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(new Error('Error reading file. Please try again.'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  };

  const handleLoopPointsChange = (trackId: string, start: number, end: number) => {
    if (!tracks) return;
    
    setTracks(prev => 
      prev.map(track => 
        track && track.id === trackId 
          ? { ...track, loopStart: start, loopEnd: end } 
          : track
      )
    );
  };
  
  const handleCuePointChange = (trackId: string, index: number, time: number) => {
    if (!tracks) return;
    
    setTracks(prev => 
      prev.map(track => {
        if (!track || track.id !== trackId) return track;
        const duration = track.buffer?.duration || 0;
        // Clamp cue point to just before the end
        const epsilon = 0.01;
        const clampedTime = Math.max(0, Math.min(time, duration - epsilon));
        const newCuePoints = [...track.cuePoints];
        newCuePoints[index] = clampedTime;
        // Save to localStorage
        saveCuePointsToLocal(trackId, newCuePoints);
        // Save settings
        const settings = loadTrackSettingsFromLocal(trackId) || {};
        saveTrackSettingsToLocal(trackId, { ...settings, cuePoints: newCuePoints });
        return { ...track, cuePoints: newCuePoints };
      })
    );
  };
  
  const handleModeChange = (trackId: string, mode: 'preview' | 'loop' | 'cue') => {
    if (!tracks) return;
    
    // Enforce rule: only the top track (first in array) can be in preview mode
    if (mode === 'preview') {
      const trackIndex = tracks.findIndex(track => track.id === trackId);
      if (trackIndex !== 0) {
        // Non-top tracks cannot be preview mode
        console.warn('Only the top track can be in preview mode');
        return;
      }
    }
    
    setTracks(prev => 
      prev.map(track => 
        track && track.id === trackId ? { ...track, mode } : track
      )
    );
    
    // Handle state transitions when switching modes
    if (mode === 'loop') {
      // If switching to loop mode, clear cue track selection and hide cue thumbs
      if (selectedCueTrackId === trackId) {
        setSelectedCueTrackId(null);
      }
      setShowCueThumbs(prev => ({ ...prev, [trackId]: false }));
    } else if (mode === 'cue') {
      // If switching to cue mode, show cue thumbs by default
      setShowCueThumbs(prev => ({ ...prev, [trackId]: true }));
      
      // Auto-select this track if no cue track is currently selected
      if (!selectedCueTrackId) {
        setSelectedCueTrackId(trackId);
      }
    } else if (mode === 'preview') {
      // If switching to preview mode, clear cue track selection and hide cue thumbs
      if (selectedCueTrackId === trackId) {
        setSelectedCueTrackId(null);
      }
      setShowCueThumbs(prev => ({ ...prev, [trackId]: false }));
    }
  };

  // Add a function to handle play requests and ensure audio context is running
  const ensureAudioBeforeAction = async (callback: () => void) => {
    try {
      if (!isAudioInitialized) {
        await initializeAudio();
        setIsAudioInitialized(true);
      } else if (audioContext?.state === 'suspended') {
        await resumeAudioContext();
      }
      callback();
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      setError('Failed to initialize audio context. Please try again.');
    }
  };

  // Add this function to handle track selection
  const handleTrackSelect = (trackId: string) => {
    setSelectedCueTrackId(prevId => prevId === trackId ? null : trackId);
  };

  // Add handler for playback time updates
  const handlePlaybackTimeChange = (trackId: string, time: number) => {
    setPlaybackTimes(prev => ({
      ...prev,
      [trackId]: time
    }));
  };

  // Zoom functions
  const handleZoomIn = (trackId: string) => {
    setZoomLevels(prev => {
      const currentZoom = prev[trackId] || 1;
      const newZoom = Math.min(currentZoom * 2, 8);
      return { ...prev, [trackId]: newZoom };
    });
  };

  const handleZoomOut = (trackId: string) => {
    setZoomLevels(prev => {
      const currentZoom = prev[trackId] || 1;
      const newZoom = Math.max(currentZoom / 2, 1);
      return { ...prev, [trackId]: newZoom };
    });
  };

  const handleResetZoom = (trackId: string) => {
    setZoomLevels(prev => ({ ...prev, [trackId]: 1 }));
  };

  // Handle tempo changes
  const handleTempoChange = (trackId: string, tempo: number) => {
    setTracks(prev => 
      prev.map(track => 
        track.id === trackId ? { ...track, tempo } : track
      )
    );
  };

  // Handle playback speed changes
  const handleSpeedChange = (trackId: string, speed: number) => {
    setPlaybackSpeeds(prev => ({
      ...prev,
      [trackId]: speed
    }));
  };

  // Handle playback state changes
  const handlePlaybackStateChange = (trackId: string, isPlaying: boolean) => {
    setPlaybackStates(prev => ({
      ...prev,
      [trackId]: isPlaying
    }));
  };

  // Handle manual playhead position changes from waveform
  const handlePlayheadChange = (trackId: string, time: number) => {
    // Update the playback time for the track so TrackControls knows the new position
    setPlaybackTimes(prev => ({
      ...prev,
      [trackId]: time
    }));
    
    // Also update the appropriate playhead state
    const track = tracks.find(t => t.id === trackId);
    if (track?.mode === 'loop') {
      setLoopPlayhead(time);
    } else {
      setSamplePlayhead(time);
    }
  };

  // Handle time signature changes
  const handleTimeSignatureChange = (trackId: string, timeSignature: TimeSignature) => {
    setTracks(prev => 
      prev.map(track => 
        track.id === trackId ? { ...track, timeSignature } : track
      )
    );
  };

  // Handle first measure time changes
  const handleFirstMeasureChange = (trackId: string, time: number) => {
    setTracks(prev => 
      prev.map(track => 
        track.id === trackId ? { ...track, firstMeasureTime: time } : track
      )
    );
  };

  // Handle measure display toggle
  const handleToggleMeasures = (trackId: string) => {
    setShowMeasures(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  };

  // Add handler for toggling cue thumbs
  const handleToggleCueThumbs = (trackId: string) => {
    setShowCueThumbs(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  };

  // Add handler for volume changes
  const handleVolumeChange = (trackId: string, newVolume: number) => {
    setVolume(prev => ({ ...prev, [trackId]: newVolume }));
    
    // Update lastUsedVolume only for preview tracks
    const track = tracks.find(t => t.id === trackId);
    if (track?.mode === 'preview') {
      setLastUsedVolume(newVolume);
    }
  };

  // Add handler for toggling accordion controls
  const handleToggleControls = (trackId: string) => {
    setExpandedControls(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg border p-8 text-center">
          <h1 className="text-2xl font-medium text-gray-900 mb-4">
            Loading TrackStitch Studio
          </h1>
          <p className="text-gray-600 mb-8">
            Loading audio track...
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <h1 className="text-2xl font-medium text-red-900 mb-4">
            Error Loading Track
          </h1>
          <p className="text-red-600 mb-8">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No tracks state
  if (tracks.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg border p-8 text-center">
          <h1 className="text-2xl font-medium text-gray-900">
            No Track Loaded
          </h1>
          <p className="text-gray-600">
            No track is currently loaded. Please refresh the page to load a random track.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Load Random Track
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="max-w-6xl mx-auto p-4 lg:p-6 space-y-6 relative"
      style={{ 
        overscrollBehaviorX: 'none'
      }}
    >
      {/* Add Track Gesture Indicator */}
      {showAddTrackGesture && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-green-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">Release to add track</span>
          </div>
        </div>
      )}
              {/* Render all tracks */}
        {tracks.map((track, index) => (
          <div 
            key={track.id} 
            className={`rounded-lg border bg-white overflow-hidden transition-all duration-300 ${
              index === 0 
                ? 'border-blue-200 shadow-md' // Top track styling
                : 'border-gray-200 shadow-sm' // Lower tracks styling
            }`}
            style={{
              transform: isAddingTrack && index > 0 ? 'translateY(10px)' : 'translateY(0)',
              ...(index === 0 && { touchAction: 'pan-y pinch-zoom' })
            }}
            // Only add gesture handlers to the first track
            {...(index === 0 && {
              onWheel: handleWheel,
              onTouchStart: handleTouchStart,
              onTouchMove: handleTouchMove,
              onTouchEnd: handleTouchEnd
            })}
          >
          {/* Add Track and Navigation Controls - Only show on first track */}
          {index === 0 && (
            <div 
              className="flex items-center justify-between bg-gray-50 border-b border-gray-200 py-1 px-2"
            >
              <button
                onClick={handlePreviousTrack}
                disabled={isTrackLoading || isWaveformLoading}
                className={`p-2 rounded-full transition-all duration-200 ${
                  isTrackLoading || isWaveformLoading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white shadow-sm'
                }`}
                title="Previous Track (Left Arrow)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Add Track Button */}
              <button
                onClick={addNewTrack}
                disabled={!canAddTrack || isAddingTrack || isTrackLoading || isWaveformLoading}
                className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                  !canAddTrack || isAddingTrack || isTrackLoading || isWaveformLoading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-green-600 hover:text-green-700 hover:bg-white shadow-sm'
                } ${addTrackAnimation ? 'animate-pulse' : ''}`}
                title={canAddTrack ? 'Add New Track' : 'Change current track mode to enable adding tracks'}
              >
                <svg className="w-4 h-4 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                {isAddingTrack && (
                  <span className="text-xs mt-1">Adding...</span>
                )}
              </button>
              
              <button
                onClick={handleNextTrack}
                disabled={isTrackLoading || isWaveformLoading}
                className={`p-2 rounded-full transition-all duration-200 ${
                  isTrackLoading || isWaveformLoading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white shadow-sm'
                }`}
                title="Next Track (Right Arrow)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
          {/* Consolidated Track Header */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex flex-col gap-3">
              {/* Top Row: Title, Mode Switch, and File Info */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Left side: Title and Mode Switch */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {/* Track Position Indicator */}
                    {tracks.length > 1 && (
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        index === 0 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                    )}
                    
                                        <h2 className={`text-lg font-medium truncate ${
                      track.mode === 'loop' ? 'text-indigo-600' : 
                      track.mode === 'cue' ? 'text-red-500' : 'text-blue-600'
                    }`}>
                      {track.mode === 'loop' ? 'Loop Track' : 
                       track.mode === 'cue' ? 'Sample Track' : 'Preview Track'
                      }
                      </h2>
                    
                    {/* Remove Track Button - only show if multiple tracks */}
                    {tracks.length > 1 && (
                      <button
                        onClick={() => removeTrack(track.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
                        title="Remove Track"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                
                {/* Compact Mode Switch */}
                <div className="flex items-center bg-white rounded-md p-0.5 border">
                  {/* Only show Preview button for the top track */}
                  {tracks.findIndex(t => t.id === track.id) === 0 ? (
                    <button
                      onClick={() => handleModeChange(track.id, 'preview')}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'preview'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Preview
                    </button>
                  ) : (
                    <span 
                      className="px-2 py-1 text-xs font-medium text-gray-400 cursor-not-allowed"
                      title="Preview mode only available for top track"
                    >
                      Preview
                    </span>
                  )}
                  <button
                    onClick={() => handleModeChange(track.id, 'loop')}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      track.mode === 'loop'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Loop
                  </button>
                  <button
                    onClick={() => handleModeChange(track.id, 'cue')}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      track.mode === 'cue'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Chop
                  </button>
                </div>

                {/* Cue Track Selection Indicator */}
                {track.mode === 'cue' && (
                  <button
                    onClick={() => handleTrackSelect(track.id)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                      track.id === selectedCueTrackId
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 border border-gray-300'
                    }`}
                    title={track.id === selectedCueTrackId ? 'This track is selected for cue triggering' : 'Click to select this track for cue triggering'}
                  >
                    {track.id === selectedCueTrackId ? (
                      <>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Active for Cues
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                        Select for Cues
                      </>
                    )}
                  </button>
                )}
              </div>
                
                {/* Right side: File name and controls */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="truncate max-w-32 sm:max-w-48" title={track.file.name}>
                    {track.file.name}
                  </span>
                  
                  {/* Compact Zoom Controls */}
                  <div className="flex items-center bg-white rounded border">
                    <button
                      onClick={() => handleZoomOut(track.id)}
                      disabled={(zoomLevels[track.id] || 1) <= 1}
                      className="p-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Zoom Out"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => handleResetZoom(track.id)}
                      className="px-1.5 py-1 text-xs border-x hover:bg-gray-100"
                      title="Reset Zoom"
                    >
                      {(zoomLevels[track.id] || 1) === 1 ? '1x' : `${(zoomLevels[track.id] || 1).toFixed(1)}x`}
                    </button>
                    
                    <button
                      onClick={() => handleZoomIn(track.id)}
                      disabled={(zoomLevels[track.id] || 1) >= 8}
                      className="p-1 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Zoom In"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Display Options and Controls Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Display Options */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleToggleMeasures(track.id)}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      showMeasures[track.id]
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {showMeasures[track.id] ? 'Hide Measures' : 'Show Measures'}
                  </button>
                  
                  {track.mode === 'cue' && (
                    <button
                      onClick={() => handleToggleCueThumbs(track.id)}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        showCueThumbs[track.id]
                          ? 'bg-red-100 text-red-700 border border-red-300'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {showCueThumbs[track.id] ? 'Hide Cue Thumbs' : 'Show Cue Thumbs'}
                    </button>
                  )}

                  {showMeasures[track.id] && (
                    <div className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded border">
                      First measure: {track.firstMeasureTime.toFixed(2)}s
                    </div>
                  )}
                </div>

                {/* Controls Toggle */}
                <button
                  onClick={() => handleToggleControls(track.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  <span>Controls</span>
                  <svg 
                    className={`w-3 h-3 transition-transform ${expandedControls[track.id] ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Controls Row */}
          {expandedControls[track.id] && (
            <div className="p-4 border-b bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tempo Controls */}
                <div className="space-y-2">
                  <TempoControls
                    trackId={track.id}
                    initialTempo={track.tempo}
                    onTempoChange={handleTempoChange}
                    playbackSpeed={playbackSpeeds[track.id] || 1}
                    onSpeedChange={handleSpeedChange}
                  />
                </div>

                {/* Time Signature Controls */}
                <div className="space-y-2">
                  <TimeSignatureControls
                    timeSignature={track.timeSignature}
                    onTimeSignatureChange={(timeSignature) => handleTimeSignatureChange(track.id, timeSignature)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Waveform Display */}
          <div className="bg-gray-50 relative" style={{ height: '140px' }}>
            {isWaveformLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading waveform...</p>
                </div>
              </div>
            ) : (
              <WaveformDisplay
                audioFile={track.file}
                mode={track.mode}
                audioContext={audioContext}
                loopStart={track.loopStart}
                loopEnd={track.loopEnd}
                cuePoints={track.cuePoints}
                onLoopPointsChange={(start, end) => handleLoopPointsChange(track.id, start, end)}
                onCuePointChange={(index, time) => handleCuePointChange(track.id, index, time)}
                playhead={track.mode === 'loop' ? loopPlayhead : samplePlayhead}
                playbackTime={playbackTimes[track.id] || 0}
                zoomLevel={zoomLevels[track.id] || 1}
                onZoomIn={() => handleZoomIn(track.id)}
                onZoomOut={() => handleZoomOut(track.id)}
                onResetZoom={() => handleResetZoom(track.id)}
                trackId={track.id}
                showMeasures={showMeasures[track.id]}
                tempo={track.tempo}
                timeSignature={track.timeSignature}
                firstMeasureTime={track.firstMeasureTime}
                onFirstMeasureChange={(time) => handleFirstMeasureChange(track.id, time)}
                onTimeSignatureChange={(timeSignature) => handleTimeSignatureChange(track.id, timeSignature)}
                showCueThumbs={showCueThumbs[track.id]}
                volume={volume[track.id] || 1}
                onVolumeChange={(newVolume) => handleVolumeChange(track.id, newVolume)}
                isPlaying={playbackStates[track.id] || false}
                onPlayheadChange={(time) => handlePlayheadChange(track.id, time)}
              />
            )}
          </div>

          {/* Track Controls */}
          <div className="p-4 relative z-10 bg-white">
            <TrackControls
              key={`controls-${track.id}`}
              mode={track.mode}
              audioContext={audioContext}
              audioBuffer={track.buffer}
              loopStart={track.loopStart}
              loopEnd={track.loopEnd}
              cuePoints={track.cuePoints}
              onLoopPointsChange={(start, end) => handleLoopPointsChange(track.id, start, end)}
              onCuePointChange={(index, time) => handleCuePointChange(track.id, index, time)}
              ensureAudio={ensureAudioBeforeAction}
              trackColor={track.mode === 'loop' ? 'indigo' : track.mode === 'cue' ? 'red' : 'blue'}
              setPlayhead={track.mode === 'loop' ? setLoopPlayhead : setSamplePlayhead}
              isSelected={track.id === selectedCueTrackId}
              onSelect={() => handleTrackSelect(track.id)}
              onPlaybackTimeChange={(time) => handlePlaybackTimeChange(track.id, time)}
              onSpeedChange={(speed) => handleSpeedChange(track.id, speed)}
              trackTempo={track.tempo}
              volume={volume[track.id] || 1}
              onVolumeChange={(newVolume) => handleVolumeChange(track.id, newVolume)}
              playbackSpeed={playbackSpeeds[track.id] || 1}
              onPlaybackStateChange={(isPlaying: boolean) => handlePlaybackStateChange(track.id, isPlaying)}
              playbackTime={playbackTimes[track.id] || 0}
              disabled={isWaveformLoading}
            />

            {track.mode === 'cue' && track.id === selectedCueTrackId && (
              <div className="mt-3 bg-blue-50 p-2 rounded text-blue-700 text-xs">
                Press keyboard keys 1-0 to trigger cue points
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Studio; 