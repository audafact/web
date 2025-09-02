import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAudioContext } from '../context/AudioContext';
import { useSidePanel } from '../context/SidePanelContext';
import { useRecording } from '../context/RecordingContext';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';

import { useAccessControl } from '../hooks/useAccessControl';
import { useSignupModal } from '../hooks/useSignupModal';
import { useOnboarding } from '../hooks/useOnboarding';
import { createOnboardingSteps, createQuickOnboardingSteps } from '../config/onboardingConfig';
import { UpgradePrompt } from '../components/UpgradePrompt';
import WaveformDisplay from '../components/WaveformDisplay';
import TrackControls from '../components/TrackControls';
// import ModeSelector from '../components/ModeSelector';
import TempoControls from '../components/TempoControls';
import TimeSignatureControls from '../components/TimeSignatureControls';
import RecordingControls from '../components/RecordingControls';
import SidePanel from '../components/SidePanel';
import SignupModal from '../components/SignupModal';
import DemoModeIndicator from '../components/DemoModeIndicator';
// import DemoTrackInfo from '../components/DemoTrackInfo';
// import NextTrackButton from '../components/NextTrackButton';
import OnboardingWalkthrough from '../components/OnboardingWalkthrough';
import HelpButton from '../components/HelpButton';
import HelpModal from '../components/HelpModal';
// import { AccessService } from '../services/accessService';
import { TimeSignature, UserTrack } from '../types/music';
import { useUser } from '../hooks/useUser';
import { LibraryService } from '../services/libraryService';
import { signFile } from '../lib/api';

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
  fileKey: string;
  type: 'wav' | 'mp3';
  size: string;
  duration?: number;
  is_demo?: boolean;
}



const Studio = () => {
  const { audioContext, initializeAudio, resumeAudioContext } = useAudioContext();
  const { isOpen: isSidePanelOpen, toggleSidePanel } = useSidePanel();
  const { addRecordingEvent, saveCurrentState, isRecordingPerformance, getRecordingDestination } = useRecording();
  const { loading: authLoading } = useAuth();
  const { isDemoMode, currentDemoTrack, loadRandomDemoTrack, isLoading: isDemoLoading, trackDemoEvent } = useDemo();

  const { modalState, closeSignupModal } = useSignupModal();
  const { canPerformAction, getUpgradeMessage } = useAccessControl();
  const { user, libraryTracks, loading: userLoading } = useUser();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAudioInitialized, setIsAudioInitialized] = useState<boolean>(false);
  // Unified list of assets available for navigation (Supabase library only)
  const [availableAssets, setAvailableAssets] = useState<AudioAsset[]>([]);
  
  // Ref to prevent multiple track loads
  const hasLoadedTrack = useRef(false);

  // Onboarding handlers
  const onboardingHandlers = {
    onPlayTrack: () => {
      // Trigger play on the first track if available
      if (tracks.length > 0) {
        const firstTrack = tracks[0];
        // This will be handled by the TrackControls component
      }
    },
    onNextTrack: () => {
      handleNextTrack();
    },
    onPreviousTrack: () => {
      handlePreviousTrack();
    },
    onToggleSidePanel: () => {
      toggleSidePanel();
    },
    onSwitchToLoopMode: () => {
      if (tracks.length > 0) {
        handleModeChange(tracks[0].id, 'loop');
      }
    },
    onSwitchToCueMode: () => {
      if (tracks.length > 0) {
        handleModeChange(tracks[0].id, 'cue');
      }
    },
    onToggleControls: () => {
      if (tracks.length > 0) {
        handleToggleControls(tracks[0].id);
      }
    },
    onAdjustVolume: () => {
      // Volume adjustment will be handled by the TrackControls component
    },
    onSetLoopPoints: () => {
      // Loop point setting will be handled by the WaveformDisplay component
    },
    onTriggerCue: () => {
      // Cue triggering will be handled by keyboard events
    }
  };

  // Create onboarding steps
  const onboardingSteps = createOnboardingSteps(onboardingHandlers);
  const quickOnboardingSteps = createQuickOnboardingSteps(onboardingHandlers);

  // Initialize onboarding
  const isAnonymousUser = !user && !authLoading;
  const onboarding = useOnboarding(onboardingSteps, isAnonymousUser);
  const [needsUserInteraction, setNeedsUserInteraction] = useState<boolean>(false);
  const [isInitializingAudio, setIsInitializingAudio] = useState<boolean>(false);
  const [isManuallyAddingTrack, setIsManuallyAddingTrack] = useState<boolean>(false);
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
  
  // Store seek functions for each track
  const seekFunctionRefs = useRef<{ [key: string]: React.MutableRefObject<((seekTime: number) => void) | null> }>({});
  
  // Get or create seek function ref for a track
  const getSeekFunctionRef = useCallback((trackId: string) => {
    if (!seekFunctionRefs.current[trackId]) {
      seekFunctionRefs.current[trackId] = { current: null };
    }
    return seekFunctionRefs.current[trackId];
  }, []);
  
  // Filter state
  const [lowpassFreqs, setLowpassFreqs] = useState<{ [key: string]: number }>({});
  const [highpassFreqs, setHighpassFreqs] = useState<{ [key: string]: number }>({});
  const [filterEnabled, setFilterEnabled] = useState<{ [key: string]: boolean }>({});
  
  // Track navigation state
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);
  // const [isSwiping, setIsSwiping] = useState<boolean>(false);
  // const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isWaveformScrolling, setIsWaveformScrolling] = useState<boolean>(false);
  
  // Add track functionality state
  const [isAddingTrack, setIsAddingTrack] = useState<boolean>(false);
  const [addTrackAnimation, setAddTrackAnimation] = useState<boolean>(false);
  const [canAddTrack, setCanAddTrack] = useState<boolean>(false);
  const [showAddTrackGesture, setShowAddTrackGesture] = useState<boolean>(false);
  const [lastGestureTime, setLastGestureTime] = useState<number>(0);
  const [isGestureProcessing, setIsGestureProcessing] = useState<boolean>(false);
  const lastProcessedGestureRef = useRef<string>('');
  
  // Separate loading states
  const [isTrackLoading, setIsTrackLoading] = useState<boolean>(false);
  const [trackLoadRetryCount, setTrackLoadRetryCount] = useState<number>(0);

  // Add drag and drop state
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragData, setDragData] = useState<{ type: string; name: string; id: string } | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState<{
    show: boolean;
    message: string;
    feature: string;
  }>({ show: false, message: '', feature: '' });
  


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

  // Note: We're not implementing localStorage persistence for studio tracks
  // because:
  // 1. Library tracks are already available in assets/audio directory
  // 2. User-uploaded tracks are persisted in the sidebar's "My Tracks" section
  // 3. Audio files are too large for localStorage (causes QuotaExceededError)
  // 
  // Instead, users can re-add tracks from the sidebar when needed

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







  // Load library tracks for studio
  useEffect(() => {
    if (isDemoMode) {
      // For demo mode, use bundled tracks from DemoContext

      setAvailableAssets([]); // No need to load additional assets in demo mode
    } else if (user && libraryTracks.length > 0) {
      // Use library tracks from useUser hook
      const mapped: AudioAsset[] = LibraryService.transformToAudioAssets(libraryTracks);
      setAvailableAssets(mapped);
    } else if (user) {
      // User is logged in but no library tracks yet (still loading)

      setAvailableAssets([]);
    } else {
      // Anonymous users (not demo mode, not logged in) - no assets needed

      setAvailableAssets([]);
    }
  }, [libraryTracks, isDemoMode, user]);

  // Load a random track on component mount
  const loadRandomTrack = useCallback(async () => {
      try {
        setIsTrackLoading(true);
        setError(null);
        
                 // In demo mode, use the DemoContext's current track
         if (isDemoMode && currentDemoTrack) {
          
          // Use existing audio context if available
          let context = audioContext;
          if (!context) {
            try {
              context = await initializeAudio();
              setIsAudioInitialized(true);
            } catch (initError) {
              console.error('Error initializing audio context:', initError);
              setNeedsUserInteraction(true);
              setIsTrackLoading(false);
              // Don't return - let the user interaction handler retry
              return;
            }
          }
          
          // Check if audio context is suspended and needs user interaction
          if (context.state === 'suspended') {
            setNeedsUserInteraction(true);
            setIsTrackLoading(false);
            return;
          }

                     // Fetch the bundled track from DemoContext
           const response = await fetch(currentDemoTrack.file);
           const blob = await response.blob();
           const file = new File([blob], `${currentDemoTrack.name}.${currentDemoTrack.type}`, { 
             type: `audio/${currentDemoTrack.type}` 
           });
           
           // Load the audio file into buffer
           const buffer = await loadAudioBuffer(file, context);
           
           // Create track using DemoContext metadata
           const newTrack: Track = {
             id: currentDemoTrack.id,
             file,
             buffer,
             mode: 'preview',
             loopStart: 0,
             loopEnd: buffer.duration,
             cuePoints: Array.from({ length: 10 }, (_, i) => 
               buffer.duration * (i / 10)
             ),
             tempo: currentDemoTrack.bpm || 120,
             timeSignature: { numerator: 4, denominator: 4 },
             firstMeasureTime: 0,
             showMeasures: false
           };
          
          setTracks([newTrack]);
          setCurrentTrackIndex(0);
          setIsTrackLoading(false);
          
          // Track demo event
          trackDemoEvent('session_started', { 
            trackId: currentDemoTrack.id,
            timestamp: Date.now()
          });
          
          return;
        }
        
        // For authenticated users, use the existing logic
        // Select a random asset from available assets
        if (!availableAssets || availableAssets.length === 0) {
          throw new Error('No library tracks available yet. Please wait for tracks to load from the library or check your connection.');
        }
        
        const randomIndex = Math.floor(Math.random() * availableAssets.length);
        const asset = availableAssets[randomIndex];

        
        // Use existing audio context if available
        let context = audioContext;
        if (!context) {
          try {
            context = await initializeAudio();
            setIsAudioInitialized(true);
          } catch (initError) {
            console.error('Error initializing audio context:', initError);
            setNeedsUserInteraction(true);
            setIsTrackLoading(false);
            return;
          }
        }

        if (!context) {
          setNeedsUserInteraction(true);
          setIsTrackLoading(false);
          return;
        }
        
        // Get signed URL from Worker API
        const audioUrl = await signFile(asset.fileKey);
        
        // Fetch the audio file
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const file = new File([blob], `${asset.name}.${asset.type}`, { type: `audio/${asset.type}` });
        
        // Load the audio file into buffer
        const buffer = await loadAudioBuffer(file, context);
        
        // Generate track ID
        const trackId = asset.id;
        const settings = loadTrackSettingsFromLocal(trackId) || {};
        
        const newTrack: Track = {
          id: trackId,
          file,
          buffer,
          mode: settings.mode || 'preview',
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
        setCurrentTrackIndex(0);
        setShowMeasures(prev => ({ ...prev, [trackId]: !!settings.showMeasures }));
        setShowCueThumbs(prev => ({ ...prev, [trackId]: !!settings.showCueThumbs }));
        setZoomLevels(prev => ({ ...prev, [trackId]: settings.zoomLevel || 1 }));
        setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
        const trackVolume = newTrack.mode === 'preview' 
          ? lastUsedVolumeRef.current 
          : (typeof settings.volume === 'number' ? settings.volume : lastUsedVolumeRef.current);
        setVolume(prev => ({ ...prev, [trackId]: trackVolume }));
        setExpandedControls(prev => ({ ...prev, [trackId]: false }));
        
        // Reset retry count on successful load
        setTrackLoadRetryCount(0);
        setIsTrackLoading(false);
      } catch (error) {
        console.error('❌ Error loading random track:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        setIsTrackLoading(false);
        
        // Increment retry count and prevent infinite retry loop
        const newRetryCount = trackLoadRetryCount + 1;
        setTrackLoadRetryCount(newRetryCount);
        
        if (newRetryCount >= 3) {
          setError('Unable to load tracks after multiple attempts. Please check your connection and try again.');
        } else if (error instanceof Error && error.message.includes('Failed to fetch')) {
          setError(`Connection error (attempt ${newRetryCount}/3). Please check your connection and try again.`);
        } else {
          setError(`Error loading track: ${errorMessage}`);
        }
      }
    }, [audioContext, initializeAudio, isDemoMode, currentDemoTrack, availableAssets, user, trackDemoEvent]);

    useEffect(() => {
      if (tracks.length === 0 && !isManuallyAddingTrack && !isTrackLoading && !error && trackLoadRetryCount < 3) {
        // Don't automatically load tracks - wait for user interaction
        // This prevents AudioContext initialization issues
      }
    }, [tracks.length, isManuallyAddingTrack, isDemoMode, availableAssets, user, isTrackLoading, loadRandomTrack, error, trackLoadRetryCount]);

  // Keyboard navigation for track switching
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Handle help modal
      if (event.key === '?') {
        event.preventDefault();
        setShowHelpModal(true);
        return;
      }

      // Zoom shortcuts: z=zoom in, x=zoom out, c=reset (affects first track)
      if (tracks.length > 0) {
        const activeTrackId = tracks[0].id;
        if (event.key === 'z' || event.key === 'Z') {
          event.preventDefault();
          handleZoomIn(activeTrackId);
          return;
        } else if (event.key === 'x' || event.key === 'X') {
          event.preventDefault();
          handleZoomOut(activeTrackId);
          return;
        } else if (event.key === 'c' || event.key === 'C') {
          event.preventDefault();
          handleResetZoom(activeTrackId);
          return;
        }
      }

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

        // Handle demo track changes
      useEffect(() => {
        if (isDemoMode && currentDemoTrack && audioContext && tracks.length > 0) {
          // If the currently loaded track already matches the bundled track, do nothing
          if (tracks[0]?.id === currentDemoTrack.id) return;
          
          // In demo mode, we don't need to update tracks since we're using bundled tracks
          // Just log the demo event and keep the current track

          trackDemoEvent('next_track', { 
            fromTrackId: tracks[0]?.id,
            toTrackId: currentDemoTrack.id
          });
        }
      }, [isDemoMode, currentDemoTrack, audioContext, tracks.length, trackDemoEvent]);

  // Reset the hasLoadedTrack flag when tracks are cleared
  useEffect(() => {
    if (tracks.length === 0) {
      hasLoadedTrack.current = false;
    }
  }, [tracks.length]);

  // Touch/swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTrackLoading || isWaveformScrolling) return; // Disable during loading or waveform scrolling
    
    // Prevent multiple touch starts
    if (touchStartX !== null) return; // Already tracking a touch
    
    // Check if the touch target is within a waveform container
    const target = e.target as Element;
    const isWaveformTouch = target.closest('.audafact-waveform-bg') !== null;
    
    if (isWaveformTouch) return; // Don't handle swipe gestures on waveform
    
    // Check if the touch target is within track controls or consolidated header
    const isTrackControlsTouch = target.closest('.audafact-card.p-4.space-y-4') !== null;
    const isConsolidatedHeaderTouch = target.closest('.p-4.border-b.bg-audafact-surface-2') !== null;
    
    if (isTrackControlsTouch || isConsolidatedHeaderTouch) return; // Don't handle swipe gestures on track controls or header
    
    // Only allow swipe gestures in the navigation controls area
    const isNavigationControlsTouch = target.closest('.flex.items-center.justify-between.bg-audafact-surface-2.border-b.border-audafact-divider.py-1.px-2') !== null;
    
    if (!isNavigationControlsTouch) return; // Only handle swipe gestures in navigation controls
    
    // Prevent browser navigation gestures from the start
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isTrackLoading || isWaveformScrolling) return; // Disable during loading or waveform scrolling
    if (touchStartX === null || touchStartY === null) return;
    
    // Check if the touch target is within a waveform container
    const target = e.target as Element;
    const isWaveformTouch = target.closest('.audafact-waveform-bg') !== null;
    
    if (isWaveformTouch) return; // Don't handle swipe gestures on waveform
    
    // Check if the touch target is within track controls or consolidated header
    const isTrackControlsTouch = target.closest('.audafact-card.p-4.space-y-4') !== null;
    const isConsolidatedHeaderTouch = target.closest('.p-4.border-b.bg-audafact-surface-2') !== null;
    
    if (isTrackControlsTouch || isConsolidatedHeaderTouch) return; // Don't handle swipe gestures on track controls or header
    
    // Only allow swipe gestures in the navigation controls area
    const isNavigationControlsTouch = target.closest('.flex.items-center.justify-between.bg-audafact-surface-2.border-b.border-audafact-divider.py-1.px-2') !== null;
    
    if (!isNavigationControlsTouch) return; // Only handle swipe gestures in navigation controls
    
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
    
    // Show add track gesture indicator if valid gesture and can add track - disabled in demo mode
    if (isVerticalSwipeDown && canAddTrack && !isAddingTrack && !isDemoMode) {
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
      // Horizontal swipe in progress
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isTrackLoading || isWaveformScrolling) return; // Disable during loading or waveform scrolling
    if (touchStartX === null || touchEndX === null || touchStartY === null || touchEndY === null) return;
    
    // Prevent multiple touch ends
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    // Check if the touch target is within a waveform container
    const target = e.target as Element;
    const isWaveformTouch = target.closest('.audafact-waveform-bg') !== null;
    
    if (isWaveformTouch) return; // Don't handle swipe gestures on waveform
    
    // Check if the touch target is within track controls or consolidated header
    const isTrackControlsTouch = target.closest('.audafact-card.p-4.space-y-4') !== null;
    const isConsolidatedHeaderTouch = target.closest('.p-4.border-b.bg-audafact-surface-2') !== null;
    
    if (isTrackControlsTouch || isConsolidatedHeaderTouch) return; // Don't handle swipe gestures on track controls or header
    
    // Only allow swipe gestures in the navigation controls area
    const isNavigationControlsTouch = target.closest('.flex.items-center.justify-between.bg-audafact-surface-2.border-b.border-audafact-divider.py-1.px-2') !== null;
    
    if (!isNavigationControlsTouch) return; // Only handle swipe gestures in navigation controls
    
    // Prevent any browser navigation
    e.preventDefault();
    
    const deltaX = touchStartX - touchEndX;
    const deltaY = touchStartY - touchEndY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    // Strict horizontal swipe validation:
    // 1. Horizontal movement must be at least 120px (increased from 100px)
    // 2. Horizontal movement must be at least 4x larger than vertical (increased from 3x)
    // 3. Vertical movement must be less than 40px (decreased from 50px)
    const isValidHorizontalSwipe = absDeltaX > 120 && absDeltaX > absDeltaY * 4 && absDeltaY < 40;
    
    // Strict vertical swipe validation for add track:
    // 1. Vertical movement must be at least 100px
    // 2. Vertical movement must be at least 3x larger than horizontal
    // 3. Horizontal movement must be less than 50px
    // 4. Must be a downward swipe (negative deltaY means finger moved down)
    const isValidVerticalSwipe = absDeltaY > 100 && absDeltaY > absDeltaX * 3 && absDeltaX < 50;
    
    // Prevent multiple gesture processing
    if (isGestureProcessing) {
      // Reset touch state and ignore this gesture
      setTouchStartX(null);
      setTouchEndX(null);
      setTouchStartY(null);
      setTouchEndY(null);
      setShowAddTrackGesture(false);
      return;
    }
    
    // Debounce gestures to prevent rapid successive triggers
    const now = Date.now();
    const timeSinceLastGesture = now - lastGestureTime;
    const minGestureInterval = 800; // Increased to 800ms between gestures
    
    if (timeSinceLastGesture < minGestureInterval) {
      // Reset touch state and ignore this gesture
      setTouchStartX(null);
      setTouchEndX(null);
      setTouchStartY(null);
      setTouchEndY(null);
      setShowAddTrackGesture(false);
      return;
    }
    
    if (isValidHorizontalSwipe) {
      const gestureType = deltaX > 0 ? 'swipe-left' : 'swipe-right';
      const gestureKey = `${gestureType}-${now}`;
      
      // Prevent duplicate gestures
      if (lastProcessedGestureRef.current === gestureKey) {
        return;
      }
      
      setLastGestureTime(now);
      setIsGestureProcessing(true);
      lastProcessedGestureRef.current = gestureKey;
      
      if (deltaX > 0) {
        // Swiped left (finger moved left) - next track
        handleNextTrack();
      } else {
        // Swiped right (finger moved right) - previous track
        handlePreviousTrack();
      }
      // Reset gesture processing flag after a delay
      setTimeout(() => {
        setIsGestureProcessing(false);
        lastProcessedGestureRef.current = '';
      }, 1000);
    } else if (isValidVerticalSwipe && deltaY < 0) {
      // Swiped down (finger moved down) - add track - disabled in demo mode
      if (canAddTrack && !isAddingTrack && !isDemoMode) {
        const gestureKey = `swipe-down-${now}`;
        
        // Prevent duplicate gestures
        if (lastProcessedGestureRef.current === gestureKey) {
          return;
        }
        
        setLastGestureTime(now);
        setIsGestureProcessing(true);
        lastProcessedGestureRef.current = gestureKey;
        addNewTrack();
        // Reset gesture processing flag after a delay
        setTimeout(() => {
          setIsGestureProcessing(false);
          lastProcessedGestureRef.current = '';
        }, 1000);
      }
    }
    
    // Reset touch state
    setTouchStartX(null);
    setTouchEndX(null);
    setTouchStartY(null);
    setTouchEndY(null);
    setShowAddTrackGesture(false);
  };

  // Mouse wheel handler for track navigation and adding tracks
  const handleWheel = (e: React.WheelEvent) => {
    if (isTrackLoading || isWaveformScrolling) return; // Disable during loading or waveform scrolling
    
    // Prevent multiple gesture processing (same protection as touch handlers)
    if (isGestureProcessing) {
      e.preventDefault();
      return;
    }
    
    // Debounce wheel gestures to prevent rapid successive triggers
    const now = Date.now();
    const timeSinceLastGesture = now - lastGestureTime;
    const minGestureInterval = 800; // Same as touch handlers
    
    if (timeSinceLastGesture < minGestureInterval) {
      e.preventDefault();
      return;
    }
    
    // Check if the wheel event target is within a waveform container
    const target = e.target as Element;
    const isWaveformWheel = target.closest('.audafact-waveform-bg') !== null;
    
    if (isWaveformWheel) return; // Don't handle wheel gestures on waveform
    
    // Check if the wheel event target is within track controls or consolidated header
    const isTrackControlsWheel = target.closest('.p-4.relative.z-10.bg-audafact-surface-1') !== null;
    const isConsolidatedHeaderWheel = target.closest('.p-4.border-b.bg-audafact-surface-2') !== null;
    
    if (isTrackControlsWheel || isConsolidatedHeaderWheel) return; // Don't handle wheel gestures on track controls or header
    
    // Only allow wheel gestures in the navigation controls area
    const isNavigationControlsWheel = target.closest('.flex.items-center.justify-between.bg-audafact-surface-2.border-b.border-audafact-divider') !== null;
    
    if (!isNavigationControlsWheel) return; // Only handle wheel gestures in navigation controls
    
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
        
        setLastGestureTime(now);
        setIsGestureProcessing(true);
        
        if (e.deltaX > 0) {
        // Scrolling right - next track
        handleNextTrack();
      } else if (e.deltaX < 0) {
        // Scrolling left - previous track
        handlePreviousTrack();
      }
      
      // Reset gesture processing flag after a delay
      setTimeout(() => setIsGestureProcessing(false), 1000);
    } else if (isVerticalGesture && e.deltaY < 0 && canAddTrack && !isAddingTrack && !isDemoMode) {
      // Scrolling down - add track (negative deltaY = down) - disabled in demo mode
      e.preventDefault();
      setLastGestureTime(now);
      setIsGestureProcessing(true);
      addNewTrack();
      // Reset gesture processing flag after a delay
      setTimeout(() => setIsGestureProcessing(false), 1000);
    }
    // For other gestures, allow normal scrolling to pass through
  };

  // Track navigation functions
  const handleNextTrack = useCallback(async () => {
    if (isTrackLoading || isDemoLoading) return; // Disable during loading
    if (tracks.length === 0) return;
    
         if (isDemoMode) {
       // In demo mode, load next bundled track
       loadRandomDemoTrack();
            } else {
          // Normal mode - cycle through available assets
          const assets = availableAssets || [];
          const nextIndex = (currentTrackIndex + 1) % assets.length;
          await loadTrackByIndex(nextIndex, true); // true = only update first track
        }
  }, [tracks.length, currentTrackIndex, isTrackLoading, isDemoLoading, isDemoMode, loadRandomDemoTrack, availableAssets]);

  const handlePreviousTrack = useCallback(async () => {
    if (isTrackLoading || isDemoLoading) return; // Disable during loading
    if (tracks.length === 0) return;
    
    if (isDemoMode) {
      // In demo mode, load next bundled track (since we don't have previous bundled track concept)
      loadRandomDemoTrack();
    } else {
      // Normal mode - cycle through available assets
      const assets = availableAssets || [];
      const prevIndex = currentTrackIndex === 0 ? assets.length - 1 : currentTrackIndex - 1;
      await loadTrackByIndex(prevIndex, true); // true = only update first track
    }
  }, [tracks.length, currentTrackIndex, isTrackLoading, isDemoLoading, isDemoMode, loadRandomDemoTrack, availableAssets]);

  const loadTrackByIndex = async (index: number, onlyUpdateFirstTrack: boolean = false) => {
    try {
      setIsTrackLoading(true);

      setError(null);
      
      const assets = availableAssets || [];
      const safeIndex = ((index % assets.length) + assets.length) % assets.length;
      const asset = assets[safeIndex];
      
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
      
      // Get signed URL from Worker API using fileKey
      let signedUrl: string;
      try {
        if (!asset.fileKey) {
          throw new Error('Asset fileKey is missing');
        }
        signedUrl = await signFile(asset.fileKey);
      } catch (error) {
        console.error('Failed to get signed URL for asset:', error);
        throw new Error('Failed to access audio file. Please try again.');
      }

      // Fetch the audio file using the signed URL
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const file = new File([blob], `${asset.name}.${asset.type}`, { type: `audio/${asset.type}` });
      
      // Load the audio file into buffer
      const buffer = await loadAudioBuffer(file, context);
      
      // Generate track ID - preserve existing first track ID if only updating first track
      let trackId;
      if (onlyUpdateFirstTrack && tracks.length > 0) {
        trackId = tracks[0].id; // Keep the existing first track's ID
      } else {
        trackId = asset.id; // Use asset ID for new tracks
      }
      
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
      
      if (onlyUpdateFirstTrack && tracks.length > 0) {
        // Only update the first track, preserve other tracks
        setTracks(prevTracks => {
          const updatedTracks = [...prevTracks];
          // Update the first track in place to preserve React's reference
          updatedTracks[0] = {
            ...updatedTracks[0], // Keep existing properties
            ...newTrack, // Override with new track data
            id: updatedTracks[0].id // Ensure we keep the original ID
          };
          return updatedTracks;
        });
      } else {
        // Replace all tracks (original behavior)
        setTracks([newTrack]);
      }
      setCurrentTrackIndex(safeIndex);
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
      
      // Start onboarding when loading track via "Load Random Track" button for all users
      if (onboarding.shouldShowOnboarding()) {
        // Small delay to ensure UI is fully rendered
        setTimeout(() => {
          onboarding.startOnboarding();
        }, 1000);
      }
      
      // Track loading is complete
      setIsTrackLoading(false);
      
      // Waveform loading will be handled by the WaveformDisplay component
      
    
    } catch (error) {
      console.error('Error loading track by index:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(`Error loading track: ${errorMessage}`);
              setIsTrackLoading(false);
    }
  };

  // Add new track function
  const addNewTrack = async () => {
    if (!canAddTrack || isAddingTrack) return;
    
    // Demo mode doesn't support adding tracks
    if (isDemoMode) {

      return;
    }
    
    try {
      setIsAddingTrack(true);
      setAddTrackAnimation(true);
      setError(null);
      
      // Select a random asset that's different from existing tracks
      const assets = availableAssets || [];
      if (assets.length === 0) {
        throw new Error('No library tracks available. Please wait for tracks to load from the library.');
      }
      
      const existingAssetIds = tracks.map(track => track.id);
      const unusedAssets = assets.filter(asset => !existingAssetIds.includes(asset.id));
      
      // If all assets are used, allow duplicates but with different IDs
      let selectedAsset;
      if (unusedAssets.length > 0) {
        selectedAsset = unusedAssets[Math.floor(Math.random() * unusedAssets.length)];
      } else {
        selectedAsset = assets[Math.floor(Math.random() * assets.length)];
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
      
      // Get signed URL from Worker API using fileKey
      let signedUrl: string;
      try {
        if (!selectedAsset.fileKey) {
          throw new Error('Asset fileKey is missing');
        }
        signedUrl = await signFile(selectedAsset.fileKey);
      } catch (error) {
        console.error('Failed to get signed URL for asset:', error);
        throw new Error('Failed to access audio file. Please try again.');
      }

      // Fetch the audio file using the signed URL
      const response = await fetch(signedUrl);
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
    
    // Find the track to be removed
    const trackToRemove = tracks.find(track => track.id === trackId);
    if (!trackToRemove) return; // Track not found
    
    // Don't allow removing tracks in preview mode
    if (trackToRemove.mode === 'preview') {
      console.warn('Cannot remove track in preview mode');
      return;
    }
    
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
      prev.map(track => {
        if (!track || track.id !== trackId) return track;
        // When switching to cue mode, auto-generate default cue points if none exist
        if (mode === 'cue' && (!track.cuePoints || track.cuePoints.length === 0)) {
          const duration = track.buffer?.duration || 0;
          const autoCues = Array.from({ length: 10 }, (_, i) => duration * (i / 10));
          // persist cue points
          const settings = loadTrackSettingsFromLocal(trackId) || {};
          saveTrackSettingsToLocal(trackId, { ...settings, cuePoints: autoCues });
          saveCuePointsToLocal(trackId, autoCues);
          return { ...track, mode, cuePoints: autoCues };
        }
        return { ...track, mode };
      })
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
      
      // Always auto-select this track when switching to Chop mode
      setSelectedCueTrackId(trackId);
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

  // Handle waveform scroll state changes
  const handleWaveformScrollStateChange = (trackId: string, isScrolling: boolean) => {
    // Only track scroll state for the first track (where swipe gestures are active)
    if (tracks.length > 0 && trackId === tracks[0]?.id) {
      setIsWaveformScrolling(isScrolling);
    }
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
    const track = tracks.find(t => t.id === trackId);
    const isTrackPlaying = playbackStates[trackId] || false;
    

    
    if (isTrackPlaying) {
      // If track is playing, use the direct seek function
      const seekFunctionRef = seekFunctionRefs.current[trackId];
      if (seekFunctionRef?.current) {
        seekFunctionRef.current(time);
      }
    } else {
      // If track is not playing, update playback time normally
      setPlaybackTimes(prev => ({
        ...prev,
        [trackId]: time
      }));
      
      // Also update the appropriate playhead state
      if (track?.mode === 'loop') {
        setLoopPlayhead(time);
      } else {
        setSamplePlayhead(time);
      }
    }
  };

  // Drag and drop handlers for SidePanel tracks and file drops
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we're dragging over the SidePanel area (only when SidePanel is open)
    const target = e.target as Element;
    const isInSidePanel = isSidePanelOpen && target.closest('[data-sidepanel]') !== null;
    
    if (isInSidePanel) {
      // Don't show drag indicator when over SidePanel
      setIsDragOver(false);
      setDragData(null);
      return;
    }
    
    // Check if this is a track drag from SidePanel or file drop from computer
    const hasSidePanelData = e.dataTransfer.types.includes('text/plain');
    const hasFiles = e.dataTransfer.types.includes('Files');

    if (hasSidePanelData || hasFiles) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
      
      // Set drag data for file drops immediately
      if (hasFiles && !dragData) {
        setDragData({
          type: 'file',
          name: 'Audio file',
          id: `file-${Date.now()}`
        });
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we're dragging over the SidePanel area (only when SidePanel is open)
    const target = e.target as Element;
    const isInSidePanel = isSidePanelOpen && target.closest('[data-sidepanel]') !== null;
    
    if (isInSidePanel) {
      // Don't show drag indicator when over SidePanel
      setIsDragOver(false);
      setDragData(null);
      return;
    }
    
    // Check if this is a track drag from SidePanel or file drop from computer
    const hasSidePanelData = e.dataTransfer.types.includes('text/plain') && e.dataTransfer.types.includes('application/json');
    const hasFiles = e.dataTransfer.types.includes('Files');
    
    if (hasSidePanelData || hasFiles) {
      setIsDragOver(true);
      
      // Try to get the drag data for better visual feedback (SidePanel tracks)
      if (hasSidePanelData) {
        try {
          const jsonData = e.dataTransfer.getData('application/json');
          if (jsonData) {
            const parsed = JSON.parse(jsonData);
            setDragData(parsed);
          }
        } catch (error) {
          // Ignore errors, we'll still show the basic drag indicator
        }
      }
      
      // Set drag data for file drops
      if (hasFiles) {
        setDragData({
          type: 'file',
          name: 'Audio file',
          id: `file-${Date.now()}`
        });
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only clear drag state if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setDragTarget(null);
      setDragData(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if the drop occurred within the SidePanel area (only when SidePanel is open)
    const target = e.target as Element;
    const isInSidePanel = isSidePanelOpen && target.closest('[data-sidepanel]') !== null;
    
    if (isInSidePanel) {
      // Ignore drops in the SidePanel area
      setIsDragOver(false);
      setDragTarget(null);
      setDragData(null);
      return;
    }
    
    setIsDragOver(false);
    setDragTarget(null);
    setDragData(null);
    
    try {
      // Check if this is a file drop from computer
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        
        // Validate file type
        const validAudioTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aac', 'audio/ogg', 'audio/flac'];
        const isValidAudioFile = validAudioTypes.includes(file.type) || 
          file.name.toLowerCase().endsWith('.wav') || 
          file.name.toLowerCase().endsWith('.mp3') || 
          file.name.toLowerCase().endsWith('.m4a') || 
          file.name.toLowerCase().endsWith('.aac') || 
          file.name.toLowerCase().endsWith('.ogg') || 
          file.name.toLowerCase().endsWith('.flac');
        
        if (!isValidAudioFile) {
          setError('Please drop a valid audio file (WAV, MP3, M4A, AAC, OGG, or FLAC)');
          return;
        }
        
        // Add the dropped file as a track
        await handleUploadTrack(file, 'preview');
        return;
      }
      
      // Handle SidePanel track drops
      const trackId = e.dataTransfer.getData('text/plain');
      if (!trackId) return;
      
      // Get the detailed track data from the JSON payload
      let trackData = null;
      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) {
          trackData = JSON.parse(jsonData);
        }
      } catch (error) {
        console.warn('Failed to parse track data:', error);
      }
      
      // Find the asset in the available assets list
      const assets = availableAssets || [];
      const asset = assets.find(a => a.id === trackId);
      
      if (asset) {
        // Add from library - use the new fileKey-based approach
        if (trackData?.file) {
          // We have fileKey from the drag payload, use it directly

          await handleAddFromLibrary(asset, 'preview');
        } else {
          // Fallback to existing method
          await handleAddFromLibrary(asset, 'preview');
        }
        return;
      }
      
      // If not found in library, it might be a user track
      // User tracks are now managed through Supabase and the SidePanel
      console.warn('Track not found for drop:', trackId);
    } catch (error) {
      console.error('Error handling drop:', error);
      setError('Failed to add dropped track. Please try again.');
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

  // Handle volume changes
  const handleVolumeChange = (trackId: string, newVolume: number) => {
    setVolume(prev => ({ ...prev, [trackId]: newVolume }));
    setLastUsedVolume(newVolume);
  };

  // Handle filter changes
  const handleLowpassFreqChange = (trackId: string, freq: number) => {
    setLowpassFreqs(prev => ({ ...prev, [trackId]: freq }));
  };

  const handleHighpassFreqChange = (trackId: string, freq: number) => {
    setHighpassFreqs(prev => ({ ...prev, [trackId]: freq }));
  };

  const handleFilterEnabledChange = (trackId: string, enabled: boolean) => {
    setFilterEnabled(prev => ({ ...prev, [trackId]: enabled }));
  };

  // Handle save current studio state
  const handleSaveCurrentState = async () => {
    // Check session save limits
    const canSaveSession = await canPerformAction('save_session');
    if (!canSaveSession) {
      setShowUpgradePrompt({
        show: true,
        message: getUpgradeMessage('save_session'),
        feature: 'Session Save'
      });
      return;
    }

    const studioState = {
      tracks: tracks.map(track => ({
        id: track.id,
        name: track.file.name,
        mode: track.mode,
        loopStart: track.loopStart,
        loopEnd: track.loopEnd,
        cuePoints: track.cuePoints,
        tempo: track.tempo,
        timeSignature: track.timeSignature,
        firstMeasureTime: track.firstMeasureTime,
        showMeasures: showMeasures[track.id] || false,
        showCueThumbs: showCueThumbs[track.id] || false,
        zoomLevel: zoomLevels[track.id] || 1,
        playbackSpeed: playbackSpeeds[track.id] || 1,
        volume: volume[track.id] || 1,
        lowpassFreq: lowpassFreqs[track.id] || 20000,
        highpassFreq: highpassFreqs[track.id] || 20,
        filterEnabled: filterEnabled[track.id] || false
      })),
      selectedCueTrackId,
      timestamp: Date.now()
    };
    
    await saveCurrentState(studioState);
  };

  // Add handler for toggling accordion controls
  const handleToggleControls = (trackId: string) => {
    setExpandedControls(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  };

  // SidePanel handlers
  const handleUploadTrack = async (file: File, trackType: 'preview' | 'loop' | 'cue' = 'preview') => {
    try {
      setIsManuallyAddingTrack(true);
      setIsLoading(true);
      setError(null);
      
      // Use existing audio context if available
      let context = audioContext;
      if (!context) {
        context = await initializeAudio();
        setIsAudioInitialized(true);
      } else if (context.state === 'suspended') {
        await resumeAudioContext();
      }

      // Load the audio buffer
      const buffer = await loadAudioBuffer(file, context);
      
      // Create a new track
      const newTrack: Track = {
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file: file,
        buffer: buffer,
        mode: trackType,
        loopStart: 0,
        loopEnd: buffer.duration,
        cuePoints: [],
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        firstMeasureTime: 0,
        showMeasures: false
      };

      // Add the track to the beginning of the tracks array
      setTracks(prev => {
        const updatedTracks = [newTrack, ...prev];
        
        // If the new track is in preview mode and there's an existing preview track, change it to cue mode
        if (trackType === 'preview' && prev.length > 0 && prev[0].mode === 'preview') {
          updatedTracks[1] = { ...prev[0], mode: 'cue' };
        }
        
        return updatedTracks;
      });
      
      // Initialize default values for the new track
      setPlaybackTimes(prev => ({ ...prev, [newTrack.id]: 0 }));
      setZoomLevels(prev => ({ ...prev, [newTrack.id]: 1 }));
      setPlaybackSpeeds(prev => ({ ...prev, [newTrack.id]: 1 }));
      setVolume(prev => ({ ...prev, [newTrack.id]: lastUsedVolumeRef.current }));
      setShowMeasures(prev => ({ ...prev, [newTrack.id]: false }));
      setShowCueThumbs(prev => ({ ...prev, [newTrack.id]: false }));
      setPlaybackStates(prev => ({ ...prev, [newTrack.id]: false }));
      setExpandedControls(prev => ({ ...prev, [newTrack.id]: false }));
      
      // Initialize filter state
      setLowpassFreqs(prev => ({ ...prev, [newTrack.id]: 20000 }));
      setHighpassFreqs(prev => ({ ...prev, [newTrack.id]: 20 }));
      setFilterEnabled(prev => ({ ...prev, [newTrack.id]: false }));
      
      // Set a small delay to simulate waveform loading
      setTimeout(() => {
        // setIsWaveformLoading(false); // This line was removed
      }, 500);
      
    } catch (error) {
      console.error('Error uploading track:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload track');
    } finally {
      setIsLoading(false);
      setIsManuallyAddingTrack(false);
      // setIsWaveformLoading(false); // This line was removed
    }
  };

  const handleAddFromLibrary = async (asset: AudioAsset, trackType: 'preview' | 'loop' | 'cue' = 'preview') => {
    try {
      setIsManuallyAddingTrack(true);
      setIsLoading(true);
      setError(null);
      
      // No longer need to track individual user library usage
      
      // Use existing audio context if available
      let context = audioContext;
      if (!context) {
        context = await initializeAudio();
        setIsAudioInitialized(true);
      } else if (context.state === 'suspended') {
        await resumeAudioContext();
      }

      // Get signed URL from Worker API using fileKey
      let signedUrl: string;
      try {
        signedUrl = await signFile(asset.fileKey);
      } catch (error) {
        console.error('Failed to get signed URL for asset:', error);
        throw new Error('Failed to access audio file. Please try again.');
      }

      // Fetch the audio file using the signed URL
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.status}`);
      }
      
      const blob = await response.blob();
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      
      // Create a File object from the blob
      const file = new File([blob], `${asset.name}.${asset.type}`, { type: `audio/${asset.type}` });
      
      // Create a new track
      const newTrack: Track = {
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file: file,
        buffer: buffer,
        mode: trackType,
        loopStart: 0,
        loopEnd: buffer.duration,
        cuePoints: [],
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        firstMeasureTime: 0,
        showMeasures: false
      };

      // Add the track to the beginning of the tracks array
      setTracks(prev => {
        const updatedTracks = [newTrack, ...prev];
        
        // If the new track is in preview mode and there's an existing preview track, change it to cue mode
        if (trackType === 'preview' && prev.length > 0 && prev[0].mode === 'preview') {
          updatedTracks[1] = { ...prev[0], mode: 'cue' };
        }
        
        return updatedTracks;
      });
      
      // Initialize default values for the new track
      setPlaybackTimes(prev => ({ ...prev, [newTrack.id]: 0 }));
      setZoomLevels(prev => ({ ...prev, [newTrack.id]: 1 }));
      setPlaybackSpeeds(prev => ({ ...prev, [newTrack.id]: 1 }));
      setVolume(prev => ({ ...prev, [newTrack.id]: lastUsedVolumeRef.current }));
      setShowMeasures(prev => ({ ...prev, [newTrack.id]: false }));
      setShowCueThumbs(prev => ({ ...prev, [newTrack.id]: false }));
      setPlaybackStates(prev => ({ ...prev, [newTrack.id]: false }));
      setExpandedControls(prev => ({ ...prev, [newTrack.id]: false }));
      
      // Initialize filter state
      setLowpassFreqs(prev => ({ ...prev, [newTrack.id]: 20000 }));
      setHighpassFreqs(prev => ({ ...prev, [newTrack.id]: 20 }));
      setFilterEnabled(prev => ({ ...prev, [newTrack.id]: false }));
      
      // Set a small delay to simulate waveform loading
      setTimeout(() => {
        // setIsWaveformLoading(false); // This line was removed
      }, 500);
      
    } catch (error) {
      console.error('Error adding from library:', error);
      setError(error instanceof Error ? error.message : 'Failed to add track from library');
    } finally {
      setIsLoading(false);
      setIsManuallyAddingTrack(false);
      // setIsWaveformLoading(false); // This line was removed
    }
  };

  const handleAddUserTrack = async (userTrack: UserTrack, trackType: 'preview' | 'loop' | 'cue' = 'preview') => {
    if (!userTrack.file) {
      setError('File not available for this track');
      return;
    }

    try {
      setIsManuallyAddingTrack(true);
      setIsLoading(true);
      setError(null);
      
      // Use existing audio context if available
      let context = audioContext;
      if (!context) {
        context = await initializeAudio();
        setIsAudioInitialized(true);
      } else if (context.state === 'suspended') {
        await resumeAudioContext();
      }

      // Load the audio buffer from the user track's file
      const buffer = await loadAudioBuffer(userTrack.file, context);
      
      // Create a new track
      const newTrack: Track = {
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file: userTrack.file,
        buffer: buffer,
        mode: trackType,
        loopStart: 0,
        loopEnd: buffer.duration,
        cuePoints: [],
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        firstMeasureTime: 0,
        showMeasures: false
      };

      // Add the track to the beginning of the tracks array
      setTracks(prev => {
        const updatedTracks = [newTrack, ...prev];
        
        // If the new track is in preview mode and there's an existing preview track, change it to cue mode
        if (trackType === 'preview' && prev.length > 0 && prev[0].mode === 'preview') {
          updatedTracks[1] = { ...prev[0], mode: 'cue' };
        }
        
        return updatedTracks;
      });
      
      // Initialize default values for the new track
      setPlaybackTimes(prev => ({ ...prev, [newTrack.id]: 0 }));
      setZoomLevels(prev => ({ ...prev, [newTrack.id]: 1 }));
      setPlaybackSpeeds(prev => ({ ...prev, [newTrack.id]: 1 }));
      setVolume(prev => ({ ...prev, [newTrack.id]: lastUsedVolumeRef.current }));
      setShowMeasures(prev => ({ ...prev, [newTrack.id]: false }));
      setShowCueThumbs(prev => ({ ...prev, [newTrack.id]: false }));
      setPlaybackStates(prev => ({ ...prev, [newTrack.id]: false }));
      setExpandedControls(prev => ({ ...prev, [newTrack.id]: false }));
      
      // Initialize filter state
      setLowpassFreqs(prev => ({ ...prev, [newTrack.id]: 20000 }));
      setHighpassFreqs(prev => ({ ...prev, [newTrack.id]: 20 }));
      setFilterEnabled(prev => ({ ...prev, [newTrack.id]: false }));
      
      // Set a small delay to simulate waveform loading
      setTimeout(() => {
        // setIsWaveformLoading(false); // This line was removed
      }, 500);
      
    } catch (error) {
      console.error('Error adding user track:', error);
      setError(error instanceof Error ? error.message : 'Failed to add user track');
    } finally {
      setIsLoading(false);
      setIsManuallyAddingTrack(false);
      // setIsWaveformLoading(false); // This line was removed
    }
  };


  const handleUserInteraction = useCallback(async () => {
    if (needsUserInteraction && audioContext) {
      try {
        await resumeAudioContext();
        setNeedsUserInteraction(false);
        // Retry loading the track after audio context is resumed
        if (isDemoMode && currentDemoTrack && tracks.length === 0) {
          loadRandomTrack();
        }
      } catch (error) {
        console.error('Failed to resume audio context:', error);
      }
    }
  }, [needsUserInteraction, audioContext, resumeAudioContext, isDemoMode, currentDemoTrack, tracks.length, loadRandomTrack]);

  // Add this useEffect to handle user interactions:
  useEffect(() => {
    const handleClick = () => handleUserInteraction();
    const handleKeyDown = () => handleUserInteraction();
    
    if (needsUserInteraction) {
      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [needsUserInteraction, handleUserInteraction]);

  const handleInitializeAudio = async () => {
    try {
      setNeedsUserInteraction(false);
      setIsInitializingAudio(true);
      setError(null);
      
      const context = await initializeAudio();
      setIsAudioInitialized(true);
      
      if (isDemoMode) {
        // For demo mode, use DemoContext bundled tracks
        if (!currentDemoTrack) {
          // Load a bundled track first if none is loaded
          await loadRandomDemoTrack();
          if (!currentDemoTrack) {
            throw new Error('Failed to load bundled track. Please try again.');
          }
        }
        

        
        // Fetch the bundled track from DemoContext
        const response = await fetch(currentDemoTrack.file);
        const blob = await response.blob();
        const file = new File([blob], `${currentDemoTrack.name}.${currentDemoTrack.type}`, { 
          type: `audio/${currentDemoTrack.type}` 
        });
        
        const buffer = await loadAudioBuffer(file, context);
        const trackId = currentDemoTrack.id;
        
        const newTrack: Track = {
          id: trackId,
          file,
          buffer,
          mode: 'preview',
          loopStart: 0,
          loopEnd: buffer.duration,
          cuePoints: Array.from({ length: 10 }, (_, i) => 
            buffer.duration * (i / 10)
          ),
          tempo: currentDemoTrack.bpm || 120,
          timeSignature: { numerator: 4, denominator: 4 },
          firstMeasureTime: 0,
          showMeasures: false
        };
        
        setTracks([newTrack]);
        setCurrentTrackIndex(0);
        setShowMeasures(prev => ({ ...prev, [trackId]: false }));
        setShowCueThumbs(prev => ({ ...prev, [trackId]: false }));
        setZoomLevels(prev => ({ ...prev, [trackId]: 1 }));
        setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
        setVolume(prev => ({ ...prev, [trackId]: lastUsedVolumeRef.current }));
        setExpandedControls(prev => ({ ...prev, [trackId]: false }));
        
        // Track demo event
        trackDemoEvent('session_started', { 
          trackId: currentDemoTrack.id,
          timestamp: Date.now()
        });
        
        // Start onboarding for demo mode
        if (onboarding.shouldShowOnboarding()) {
          setTimeout(() => {
            onboarding.startOnboarding();
          }, 1000);
        }
        
        setIsInitializingAudio(false);
        return;
      }
      
      // For authenticated users, wait for assets to load if they're not ready yet
      if (!availableAssets || availableAssets.length === 0) {
        throw new Error('Library tracks are still loading. Please wait a moment and try again.');
      }
      

      
      // Use all available tracks for authenticated users
      const availableTracks = availableAssets;
      const randomIndex = Math.floor(Math.random() * availableTracks.length);
      const asset = availableTracks[randomIndex];
      
      // Get signed URL from Worker API using fileKey
      let signedUrl: string;
      try {
        if (!asset.fileKey) {
          throw new Error('Asset fileKey is missing');
        }
        signedUrl = await signFile(asset.fileKey);
      } catch (error) {
        console.error('Failed to get signed URL for asset:', error);
        throw new Error('Failed to access audio file. Please try again.');
      }

      // Fetch the audio file using the signed URL
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const file = new File([blob], `${asset.name}.${asset.type}`, { type: `audio/${asset.type}` });
      
      const buffer = await loadAudioBuffer(file, context);
      const trackId = asset.id;
      const settings = loadTrackSettingsFromLocal(trackId) || {};
      
      const newTrack: Track = {
        id: trackId,
        file,
        buffer,
        mode: settings.mode || 'preview',
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
      setCurrentTrackIndex(0);
      setShowMeasures(prev => ({ ...prev, [trackId]: !!settings.showMeasures }));
      setShowCueThumbs(prev => ({ ...prev, [trackId]: !!settings.showCueThumbs }));
      setZoomLevels(prev => ({ ...prev, [trackId]: settings.zoomLevel || 1 }));
      setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
      const trackVolume = newTrack.mode === 'preview' 
        ? lastUsedVolumeRef.current 
        : (typeof settings.volume === 'number' ? settings.volume : lastUsedVolumeRef.current);
      setVolume(prev => ({ ...prev, [trackId]: trackVolume }));
      setExpandedControls(prev => ({ ...prev, [trackId]: false }));
      
      // Start onboarding only for anonymous users when first track loads
      // Logged-in users should only get walkthrough when explicitly clicking "Load a random track"  
      if (isAnonymousUser && onboarding.shouldShowOnboarding()) {
        // Small delay to ensure UI is fully rendered
        setTimeout(() => {
          onboarding.startOnboarding();
        }, 1000);
      }
      
      setIsInitializingAudio(false);
    } catch (error) {
      console.error('Error initializing audio:', error);
      setError('Failed to initialize audio. Please try again.');
      setNeedsUserInteraction(true);
      setIsInitializingAudio(false);
    }
  };

  // Memoize the callback functions to prevent SidePanel re-mounting
  const memoizedSidePanelProps = useMemo(() => ({
    isOpen: isSidePanelOpen,
    onToggle: toggleSidePanel,
    onUploadTrack: handleUploadTrack,
    onAddFromLibrary: handleAddFromLibrary,
    onAddUserTrack: handleAddUserTrack,
  }), [isSidePanelOpen, toggleSidePanel, handleUploadTrack, handleAddFromLibrary, handleAddUserTrack]);








  
  // Loading state
  if (isLoading || isTrackLoading || userLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="audafact-card p-8 text-center">
          <h1 className="text-2xl font-medium audafact-heading mb-4">
            Loading Audafact Studio
          </h1>
          <p className="audafact-text-secondary mb-8">
            Loading audio track...
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-audafact-accent-cyan"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-audafact-surface-1 border border-audafact-alert-red rounded-lg p-8 text-center">
          <h1 className="text-2xl font-medium text-audafact-alert-red mb-4">
            Error Loading Track
          </h1>
          <p className="text-audafact-alert-red mb-8">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-audafact-alert-red text-audafact-text-primary px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Audio context needs user interaction state
  if (needsUserInteraction) {
    return (
      <>
        <div 
          className={`mx-auto p-4 lg:p-6 space-y-6 relative transition-all duration-300 ease-in-out ${
            (user || isDemoMode) && isSidePanelOpen 
              ? 'lg:ml-[400px] lg:max-w-[calc(100vw-400px)] lg:bg-audafact-surface-2 lg:bg-opacity-30' 
              : 'max-w-6xl'
          }`}
        >
          <div className="max-w-6xl mx-auto p-6">
            <div className="audafact-card p-8 text-center">
              <h1 className="text-2xl font-medium audafact-heading mb-4">
                Audio Context Required
              </h1>
              <p className="audafact-text-secondary mb-6">
                Your browser requires user interaction before allowing audio playback. 
                Click the button below to initialize audio and load a random track.
              </p>
              {user ? (
                <p className="audafact-text-secondary mb-6">
                  You can also select a track from the side panel after audio is initialized.
                </p>
              ) : (
                <p className="audafact-text-secondary mb-6">
                                      <a href="/auth" className="text-audafact-accent-cyan hover:underline">
                    Login to Audafact
                  </a> to access your library and select specific tracks.
                </p>
              )}
              <button
                onClick={handleInitializeAudio}
                className="audafact-button-primary"
                disabled={isInitializingAudio}
              >
                {isInitializingAudio ? 'Initializing...' : 'Initialize Audio & Load Track'}
              </button>
            </div>
          </div>
        </div>

 
      </>
    );
  }

  // No tracks state
  if (tracks.length === 0) {
    return (
      <>
        <div 
          className={`mx-auto p-4 lg:p-6 space-y-6 relative transition-all duration-300 ease-in-out ${
            (user || isDemoMode) && isSidePanelOpen 
              ? 'lg:ml-[400px] lg:max-w-[calc(100vw-400px)] lg:bg-audafact-surface-2 lg:bg-opacity-30' 
              : 'max-w-6xl'
          }`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Full-page drag and drop overlay - covers entire viewport when SidePanel is closed */}
          {(user || isDemoMode) && !isSidePanelOpen && isDragOver && (
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          )}
          
          {/* Full-screen drag and drop overlay - only active when dragging and SidePanel is open */}
          {(user || isDemoMode) && isDragOver && isSidePanelOpen && (
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          )}

          {/* Drag and Drop Indicator */}
          {isDragOver && (
            <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
              <div className="bg-audafact-accent-cyan bg-opacity-90 text-audafact-bg-primary px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="text-center">
                  <span className="text-lg font-medium block">
                    {dragData?.type === 'file' ? 'Drop audio file to add to studio' : 'Drop track to add to studio'}
                  </span>
                  {dragData && (
                    <span className="text-sm opacity-90 block mt-1">
                      {dragData.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="max-w-6xl mx-auto p-6">
            <div className="relative overflow-hidden audafact-card p-12 text-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
              {/* Vinyl record background element */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border-8 border-slate-600"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-4 border-slate-500"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-slate-400"></div>
              </div>
              
              {/* Animated groove lines */}
              <div className="absolute inset-0 opacity-10">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-slate-500"
                    style={{
                      width: `${200 + i * 8}px`,
                      height: `${200 + i * 8}px`,
                      animation: `vinyl-spin ${20 + i * 0.5}s linear infinite`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  ></div>
                ))}
              </div>

              {/* Main content */}
              <div className="relative z-10">
                {/* Icon/Logo area */}
                <div className="mb-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-audafact-accent-cyan to-audafact-accent-purple mb-4 shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                </div>

                {user ? (
                  // Registered Users Content
                  <>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-6 tracking-tight">
                      Welcome Back to Audafact Studio
                    </h1>
                    
                    <div className="max-w-2xl mx-auto">
                      <p className="text-lg text-slate-300 mb-6 leading-relaxed">
                        Start creating by:
                      </p>
                      
                      <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-slate-400">
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🔄 Looping segments</span>
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎯 Adjusting cue points</span>
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎛️ Creating real-time remixes</span>
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">📚 Adding tracks from your library</span>
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">📤 Uploading new samples</span>
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎙️ Recording your live performances</span>
                      </div>
                      
                      {/* Library Loading Indicator */}
                      {availableAssets.length === 0 && (
                        <div className="text-center mb-4">
                          <div className="inline-flex items-center gap-2 text-slate-400">
                            <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading library tracks...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={handleInitializeAudio}
                        className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        disabled={isInitializingAudio || availableAssets.length === 0}
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          {isInitializingAudio ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Loading...
                            </>
                          ) : availableAssets.length === 0 ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Loading Library...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                              </svg>
                              Load a Random Track
                            </>
                          )}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                      </button>

                      <button
                        onClick={toggleSidePanel}
                        className="group relative inline-flex items-center justify-center px-8 py-4 bg-slate-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-slate-600 hover:border-slate-500"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          Select from Your Library
                        </span>
                      </button>
                    </div>
                  </>
                ) : (
                  // Anonymous Users Content
                  <>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-6 tracking-tight">
                      Welcome to Audafact Studio
                    </h1>
                    
                    <div className="max-w-2xl mx-auto">
                      <p className="text-lg text-slate-300 mb-6 leading-relaxed">
                        Explore the basics of Audafact in this interactive demo:
                      </p>
                      
                      <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-slate-400">
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎵 Preview curated tracks</span>
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🔄 Create loops from segments</span>
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎯 Trigger cues for playback</span>
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">⬅️➡️ Navigate with buttons/swipe</span>
                        <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">📚 Browse curated library</span>
                      </div>

                      <p className="text-slate-300 mb-8 font-medium">
                        Ready for more? Sign up to unlock advanced tools and features.
                      </p>
                      
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={async () => {
                          if (currentDemoTrack) {
                            loadRandomTrack();
                          } else {
                            // If no current bundled track, load a random one first
                            await loadRandomDemoTrack();
                            // Then load the track
                            if (currentDemoTrack) {
                              loadRandomTrack();
                            }
                          }
                        }}
                        className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        disabled={isDemoLoading}
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          {isDemoLoading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Loading...
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                              </svg>
                              Load a Random Track
                            </>
                          )}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                      </button>

                      <button
                        onClick={toggleSidePanel}
                        className="group relative inline-flex items-center justify-center px-8 py-4 bg-slate-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-slate-600 hover:border-slate-500"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          Browse Curated Library
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Library Mode - User has assets but no tracks loaded */}
        {!isDemoMode && user && availableAssets.length > 0 && tracks.length === 0 && (
          <div className="max-w-6xl mx-auto p-6">
            <div className="audafact-card p-8 text-center">
              <h1 className="text-2xl font-medium audafact-heading mb-4">
                Welcome to Your Library
              </h1>
              <p className="text-slate-300 mb-8 font-medium">
                You have {availableAssets.length} tracks available. Click below to load your first track.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={loadRandomTrack}
                  className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  disabled={isTrackLoading}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isTrackLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        Load a Random Track
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                </button>

                <button
                  onClick={toggleSidePanel}
                  className="group relative inline-flex items-center justify-center px-8 py-4 bg-slate-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-slate-600 hover:border-slate-500"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    Browse Your Library
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

      </>
    );
  }

  return (
    <>
      {/* Demo Mode Indicator */}
      {isDemoMode && <DemoModeIndicator />}
      
      <div 
        className={`mx-auto p-4 lg:p-6 space-y-6 relative transition-all duration-300 ease-in-out ${
          (user || isDemoMode) && isSidePanelOpen 
            ? 'lg:ml-[400px] lg:max-w-[calc(100vw-400px)] lg:bg-audafact-surface-2 lg:bg-opacity-30' 
            : 'max-w-6xl'
        }`}
        style={{ 
          overscrollBehaviorX: 'none'
        }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Demo Track Info */}
        {/* {isDemoMode && <DemoTrackInfo track={currentDemoTrack} />} */}
        {/* Full-page drag and drop overlay - covers entire viewport when SidePanel is closed */}
        {(user || isDemoMode) && !isSidePanelOpen && isDragOver && (
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        )}
        
        {/* Full-screen drag and drop overlay - only active when dragging and SidePanel is open */}
        {(user || isDemoMode) && isDragOver && isSidePanelOpen && (
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        )}
        
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

        {/* Drag and Drop Indicator */}
        {isDragOver && (
          <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
            <div className="bg-audafact-accent-cyan bg-opacity-90 text-audafact-bg-primary px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div className="text-center">
                <span className="text-lg font-medium block">
                  {dragData?.type === 'file' ? 'Drop audio file to add to studio' : 'Drop track to add to studio'}
                </span>
                {dragData && (
                  <span className="text-sm opacity-90 block mt-1">
                    {dragData.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Global Recording Controls */}
        <div className="flex justify-end mb-4">
          <RecordingControls onSave={handleSaveCurrentState} audioContext={audioContext || undefined} />
        </div>

        {/* Render all tracks */}
        {tracks.map((track, index) => (
          <div 
            key={track.id} 
            className={`audafact-card overflow-hidden transition-all duration-300 relative ${
              index === 0 
                ? 'border-audafact-accent-cyan shadow-card' // Top track styling
                : 'border-audafact-divider shadow-sm' // Lower tracks styling
            } ${isDragOver ? 'ring-2 ring-audafact-accent-cyan ring-opacity-50' : ''}`}
            style={{
              transform: isAddingTrack && index > 0 ? 'translateY(10px)' : 'translateY(0)'
            }}
            data-testid={index === 0 ? 'main-track-card' : `track-card-${index}`}
          >
            {/* Add Track and Navigation Controls - Only show on first track */}
            {index === 0 && (
              <div 
                className="flex items-center justify-between bg-audafact-surface-2 border-b border-audafact-divider py-1 px-2"
                style={{ touchAction: 'pan-y pinch-zoom' }}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <button
                  onClick={handlePreviousTrack}
                  disabled={isTrackLoading}
                  className={`p-2 rounded-full transition-all duration-200 ${
                    isTrackLoading
                      ? 'text-audafact-text-secondary cursor-not-allowed'
                      : 'text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-1 shadow-sm'
                  }`}
                  title="Previous Track (Left Arrow)"
                  data-testid="previous-track-button"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                  
                {/* Add Track Button */}
                <button
                  onClick={addNewTrack}
                  disabled={!canAddTrack || isAddingTrack || isTrackLoading || isDemoMode}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                    !canAddTrack || isAddingTrack || isTrackLoading || isDemoMode
                      ? 'text-audafact-text-secondary cursor-not-allowed'
                      : 'text-audafact-accent-cyan hover:text-audafact-accent-cyan hover:bg-audafact-surface-1 shadow-sm'
                  } ${addTrackAnimation ? 'animate-pulse' : ''}`}
                  title={isDemoMode ? 'Add tracks not available in demo mode' : (canAddTrack ? 'Add New Track' : 'Change current track mode to enable adding tracks')}
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
                disabled={isTrackLoading}
                className={`p-2 rounded-full transition-all duration-200 ${
                  isTrackLoading
                    ? 'text-audafact-text-secondary cursor-not-allowed'
                    : 'text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-1 shadow-sm'
                }`}
                title="Next Track (Right Arrow)"
                data-testid="next-track-button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            )}

            {/* Track Header */}
            <div className="p-4 border-b border-audafact-divider bg-audafact-surface-1">
              {/* Mobile layout */}
              <div className="flex flex-col gap-2 md:hidden">
                {/* Row 1: Mode buttons */}
                <div className="flex items-center gap-2">
                  <div className="grid grid-cols-3 gap-1 bg-audafact-surface-2 rounded-md p-0.5 border border-audafact-divider w-full max-w-full">
                    <button
                      onClick={() => handleModeChange(track.id, 'preview')}
                      className={`w-full text-center px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'preview'
                          ? 'bg-audafact-accent-blue text-audafact-text-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      data-testid="preview-mode-button"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleModeChange(track.id, 'loop')}
                      className={`w-full text-center px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'loop'
                          ? 'bg-audafact-accent-cyan text-audafact-bg-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      data-testid="loop-mode-button"
                    >
                      Loop
                    </button>
                    <button
                      onClick={() => handleModeChange(track.id, 'cue')}
                      className={`w-full text-center px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'cue'
                          ? 'bg-audafact-alert-red text-audafact-text-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      data-testid="chop-mode-button"
                    >
                      Chop
                    </button>
                  </div>
                </div>
                {/* Row 2: Song name (truncated) + mode */}
                <div className="min-w-0">
                  <h3 className="font-medium audafact-heading truncate">
                    {track.file.name}
                  </h3>
                  <p className="text-xs audafact-text-secondary truncate">
                    {track.mode === 'preview' ? 'Preview Mode' : track.mode === 'loop' ? 'Loop Mode' : 'Cue Mode'}
                  </p>
                </div>
                {/* Row 3: Measures, Cues, Select */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleToggleMeasures(track.id)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                      showMeasures[track.id]
                        ? 'bg-audafact-accent-cyan text-audafact-bg-primary'
                        : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                    }`}
                    title={showMeasures[track.id] ? 'Hide Measures' : 'Show Measures'}
                    data-testid="measures-button"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Measures</span>
                  </button>
                  {track.mode === 'cue' && (
                    <button
                      onClick={() => handleToggleCueThumbs(track.id)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                        showCueThumbs[track.id]
                          ? 'bg-audafact-alert-red text-audafact-text-primary'
                          : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                      }`}
                      title={showCueThumbs[track.id] ? 'Hide Cue Points' : 'Show Cue Points'}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>Cues</span>
                    </button>
                  )}
                  {track.mode === 'cue' && (
                    <button
                      onClick={() => handleTrackSelect(track.id)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                        track.id === selectedCueTrackId
                          ? 'bg-audafact-alert-red text-audafact-text-primary'
                          : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                      }`}
                      title={track.id === selectedCueTrackId ? 'Selected for Cue Control' : 'Select for Cue Control'}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Select</span>
                    </button>
                  )}
                </div>
                {/* Row 4: Time & Tempo toggle */}
                <div>
                  <button
                    onClick={() => handleToggleControls(track.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium audafact-text-secondary bg-audafact-surface-1 border border-audafact-divider rounded hover:bg-audafact-surface-2 transition-colors duration-200 w-full justify-between"
                    title={expandedControls[track.id] ? 'Collapse Controls' : 'Expand Controls'}
                    data-testid="time-tempo-controls-button"
                  >
                    <span className="truncate">Time and Tempo</span>
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

              {/* Desktop layout */}
              <div className="hidden md:flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Custom Mode Selector */}
                  <div className="flex items-center bg-audafact-surface-2 rounded-md p-0.5 border border-audafact-divider">
                    <button
                      onClick={() => handleModeChange(track.id, 'preview')}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'preview'
                          ? 'bg-audafact-accent-blue text-audafact-text-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      data-testid="preview-mode-button"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleModeChange(track.id, 'loop')}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'loop'
                          ? 'bg-audafact-accent-cyan text-audafact-bg-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      data-testid="loop-mode-button"
                    >
                      Loop
                    </button>
                    <button
                      onClick={() => handleModeChange(track.id, 'cue')}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'cue'
                          ? 'bg-audafact-alert-red text-audafact-text-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      data-testid="chop-mode-button"
                    >
                      Chop
                    </button>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium audafact-heading truncate max-w-[420px]">
                      {track.file.name}
                    </h3>
                    <p className="text-sm audafact-text-secondary">
                      {track.mode === 'preview' ? 'Preview Mode' : track.mode === 'loop' ? 'Loop Mode' : 'Cue Mode'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Show Measures Button */}
                  <button
                    onClick={() => handleToggleMeasures(track.id)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                      showMeasures[track.id]
                        ? 'bg-audafact-accent-cyan text-audafact-bg-primary'
                        : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                    }`}
                    title={showMeasures[track.id] ? 'Hide Measures' : 'Show Measures'}
                    data-testid="measures-button"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Measures</span>
                  </button>

                  {/* Show Cue Points Button - Only visible on cue tracks */}
                  {track.mode === 'cue' && (
                    <button
                      onClick={() => handleToggleCueThumbs(track.id)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                        showCueThumbs[track.id]
                          ? 'bg-audafact-alert-red text-audafact-text-primary'
                          : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                      }`}
                      title={showCueThumbs[track.id] ? 'Hide Cue Points' : 'Show Cue Points'}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>Cues</span>
                    </button>
                  )}

                  {/* Cue Track Selection Indicator */}
                  {track.mode === 'cue' && (
                    <button
                      onClick={() => handleTrackSelect(track.id)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                        track.id === selectedCueTrackId
                          ? 'bg-audafact-alert-red text-audafact-text-primary'
                          : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                      }`}
                      title={track.id === selectedCueTrackId ? 'Selected for Cue Control' : 'Select for Cue Control'}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Select</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleToggleControls(track.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium audafact-text-secondary bg-audafact-surface-1 border border-audafact-divider rounded hover:bg-audafact-surface-2 transition-colors duration-200"
                    title={expandedControls[track.id] ? 'Collapse Controls' : 'Expand Controls'}
                    data-testid="time-tempo-controls-button"
                  >
                    <span>Time and Tempo</span>
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

            {/* Collapsible Controls */}
            {expandedControls[track.id] && (
              <div className="p-4 border-b border-audafact-divider bg-audafact-surface-2 space-y-4">
                {/* Tempo Controls */}
                <div className="space-y-2">
                  <TempoControls
                    trackId={track.id}
                    initialTempo={track.tempo}
                    onTempoChange={handleTempoChange}
                    playbackSpeed={playbackSpeeds[track.id] || 1}
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
            )}

            {/* Waveform Display */}
            <div className="audafact-waveform-bg relative" style={{ height: '120px' }}>
            <WaveformDisplay
                audioFile={track.file}
                mode={track.mode}
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
                showCueThumbs={showCueThumbs[track.id]}
                isPlaying={playbackStates[track.id] || false}
                onPlayheadChange={(time) => handlePlayheadChange(track.id, time)}
                onScrollStateChange={(isScrolling) => handleWaveformScrollStateChange(track.id, isScrolling)}
                isDemoMode={isDemoMode}
              />
              

            </div>

            {/* Track Controls */}
            <div className="p-4 relative z-10 bg-audafact-surface-1">
              <TrackControls
                key={`controls-${track.id}`}
                mode={track.mode}
                audioContext={audioContext}
                audioBuffer={track.buffer}
                loopStart={track.loopStart}
                loopEnd={track.loopEnd}
                cuePoints={track.cuePoints}
                ensureAudio={ensureAudioBeforeAction}
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
                disabled={false}
                lowpassFreq={lowpassFreqs[track.id] || 20000}
                onLowpassFreqChange={(freq) => handleLowpassFreqChange(track.id, freq)}
                highpassFreq={highpassFreqs[track.id] || 20}
                onHighpassFreqChange={(freq) => handleHighpassFreqChange(track.id, freq)}
                filterEnabled={filterEnabled[track.id] || false}
                onFilterEnabledChange={(enabled) => handleFilterEnabledChange(track.id, enabled)}
                showDeleteButton={tracks.length > 1 && track.mode !== 'preview'}
                onDelete={() => removeTrack(track.id)}
                trackId={track.id}
                seekFunctionRef={getSeekFunctionRef(track.id)}
                recordingDestination={isRecordingPerformance ? getRecordingDestination() : null}
              />

              {track.mode === 'cue' && track.id === selectedCueTrackId && (
                <div className="mt-3 bg-audafact-accent-blue bg-opacity-10 p-2 rounded text-audafact-accent-blue text-xs">
                  Press keyboard keys 1-0 to trigger cue points
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* SidePanel - Single instance for all states */}
      {(user || isDemoMode) && <SidePanel {...memoizedSidePanelProps} />}
      

      
      {/* Signup Modal */}
      <SignupModal
        isOpen={modalState.isOpen}
        onClose={closeSignupModal}
        trigger={modalState.trigger}
      />
      
      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt.show && (
        <UpgradePrompt
          message={showUpgradePrompt.message}
          feature={showUpgradePrompt.feature}
          onClose={() => setShowUpgradePrompt({ show: false, message: '', feature: '' })}
        />
      )}

      {/* Onboarding Walkthrough */}
      <OnboardingWalkthrough
        isOpen={onboarding.isOpen}
        onClose={onboarding.closeOnboarding}
        onComplete={onboarding.completeOnboarding}
        steps={onboardingSteps}
        currentStep={onboarding.currentStep}
        onStepChange={onboarding.setCurrentStep}
      />

      {/* Help Button */}
      <HelpButton
        onStartTutorial={onboarding.startOnboarding}
        onShowHelp={() => setShowHelpModal(true)}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </>
  );
};

export default Studio; 