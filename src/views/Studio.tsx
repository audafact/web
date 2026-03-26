import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAudioContext } from '../context/AudioContext';
import { useSidePanel } from '../context/SidePanelContext';
import { useRecording } from '../context/RecordingContext';
import { useAuth } from '../context/AuthContext';
import { useGuest } from '../context/GuestContext';
import { useAccessControl } from '../hooks/useAccessControl';
import { useSignupModal } from '../hooks/useSignupModal';
import { useOnboarding } from '../hooks/useOnboarding';
import { useUserAccess } from '../hooks/useUserAccess';
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
import { loadPreferredMode, savePreferredMode } from '../components/GetStartedFlowModal';
import Tooltip from '../components/Tooltip';
// import { AccessService } from '../services/accessService';
import { TimeSignature, UserTrack } from '../types/music';
import { useUser } from '../hooks/useUser';
import { useAnalytics } from '../hooks/useAnalytics';
import { LibraryService } from '../services/libraryService';
import type { SuggestionReference } from '../services/sampleSuggestionService';
import { signFile } from '../lib/api';
import { getSignedUrl } from '../lib/storage';
import { useTapTempo } from '../context/TapTempoContext';
import { extractPeaksFromBuffer } from '../utils/audioPeaks';
import { transposeKey, semitonesFromPlaybackSpeed } from '../utils/keyTranspose';

// Define a Track type
interface Track {
  id: string;
  sourceAssetId?: string;  // For restore: library asset id or upload id
  fileKey?: string;        // For restore: used to fetch audio via signFile (library + user uploads)
  file: File;
  buffer: AudioBuffer;
  /** Pre-decoded peaks for WaveSurfer - skips duplicate decode, faster waveform load */
  peaks?: number[][];
  mode: 'preview' | 'loop' | 'cue';
  /** How chop pads trigger playback when mode is 'cue'. Default 'cue' for backwards compatibility. */
  chopTriggerStyle?: 'cue' | 'hold' | 'one-shot';
  loopStart: number;
  loopEnd: number;
  cuePoints: number[];
  tempo: number;
  timeSignature: TimeSignature;
  firstMeasureTime: number;
  showMeasures: boolean;
  /** Detected musical key from audio analysis (library/user uploads) */
  key?: string;
  /** Beat positions in seconds (adaptive grid); from audio analysis when available */
  beats?: number[];
  /** True when tempo/key analysis is pending (uploaded track) */
  isAnalyzing?: boolean;
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
  bpm?: number;
  key?: string;
  beats?: number[];
}



const Studio = () => {
  const [searchParams] = useSearchParams();
  const { audioContext, initializeAudio, resumeAudioContext, primeIosSessionForWebAudio } =
    useAudioContext();
  const { isOpen: isSidePanelOpen, toggleSidePanel } = useSidePanel();
  const { addRecordingEvent, saveCurrentState, isRecordingPerformance, getRecordingDestination } = useRecording();
  const { loading: authLoading } = useAuth();
  const { isGuestMode, currentGuestTrack, loadRandomGuestTrack, isLoading: isGuestLoading, trackGuestEvent} = useGuest();

  const { modalState, closeSignupModal, showSignupModal: openSignupModal } = useSignupModal();
  const { canPerformAction, getUpgradeMessage } = useAccessControl();
  const { user, tier, libraryTracks, loading: userLoading } = useUser();
  const { trackEvent } = useAnalytics();
  const { accessTier, proAccessSource } = useUserAccess();
  const { isTapTempoActive } = useTapTempo();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showEarlyCreatorModal, setShowEarlyCreatorModal] = useState<boolean>(false);
  const [getStartedStep, setGetStartedStep] = useState<null | 'mode-choice'>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAudioInitialized, setIsAudioInitialized] = useState<boolean>(false);
  // Track drag state for real-time timestamp updates
  const [cueDragStates, setCueDragStates] = useState<{ [trackId: string]: { [index: number]: number } }>({});
  const [loopDragStates, setLoopDragStates] = useState<{ [trackId: string]: { start: number; end: number } }>({});
  // Unified list of assets available for navigation (Supabase library only)
  const [availableAssets, setAvailableAssets] = useState<AudioAsset[]>([]);
  
  // Creative metrics: sampler_opened on Studio mount (Studio only, excludes /demo)
  useEffect(() => {
    trackEvent('sampler_opened', { userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- fire once on mount

  // Demo mode detection from URL parameters (for backward compatibility)
  const isDemoMode = searchParams.get('demo') === 'true';
  
  // Verification state detection from URL parameters
  const isVerified = searchParams.get('verified') === 'true';
  
  // Ref to prevent multiple track loads
  const hasLoadedTrack = useRef(false);
  const isRestoringRef = useRef(false);
  /** Creative metrics: emit sampler_ready only once per session when first track is playable */
  const hasEmittedSamplerReady = useRef(false);
  /** Debounced parameter_changed tracking (500ms) - key: `${trackId}-${parameterType}` */
  const parameterChangeTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Ref to hold latest studio state for save (avoids stale closures in beforeunload/debounced save)
  const studioStateForSaveRef = useRef({
    tracks: [] as Track[],
    availableAssets: [] as AudioAsset[],
    showMeasures: {} as Record<string, boolean>,
    showCueThumbs: {} as Record<string, boolean>,
    zoomLevels: {} as Record<string, number>,
    playbackSpeeds: {} as Record<string, number>,
    volume: {} as Record<string, number>,
    lowpassFreqs: {} as Record<string, number>,
    highpassFreqs: {} as Record<string, number>,
    filterEnabled: {} as Record<string, boolean>,
    expandedControls: {} as Record<string, boolean>,
    playbackTimes: {} as Record<string, number>,
    selectedCueTrackId: null as string | null,
    armedLoopTrackIds: new Set<string>(),
    currentTrackIndex: 0,
    lastUsedVolume: 1,
  });

  // Handle demo mode initialization
  useEffect(() => {
    if (isDemoMode && !isGuestMode && user) {
      // User clicked "Launch Demo" from AuthVerification
      // Track this as a demo event
      trackGuestEvent('demo_launched', { 
        userId: user.id,
        timestamp: Date.now(),
        source: 'auth_verification'
      });
      
      // Clear the demo parameter from URL after tracking
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('demo');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [isDemoMode, isGuestMode, user, trackGuestEvent]);

  // Determine if we should show demo mode indicator (only for URL-based demo mode)
  const shouldShowDemoIndicator = isDemoMode;

  // Verification UI state
  const [showVerificationUI, setShowVerificationUI] = useState(false);
  const [isVerificationLoading, setIsVerificationLoading] = useState(false);

  // Handle verification state - show modal immediately when Studio renders
  useEffect(() => {
    if (isVerified && user && !isGuestMode) {
      console.log('Showing verification UI for user:', user.id);
      setShowVerificationUI(true);
      // Clear verification parameters from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('verified');
      newUrl.searchParams.delete('type');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [isVerified, user, isGuestMode]);

  useEffect(() => {
    if (!user || authLoading || userLoading) return;
    if (accessTier !== 'pro') return;
    if (proAccessSource !== 'founder_manual' && proAccessSource !== 'invite_code') return;

    const storageKey = `early_creator_modal_seen_${user.id}`;
    if (localStorage.getItem(storageKey) === 'true') return;

    setShowEarlyCreatorModal(true);
  }, [user, authLoading, userLoading, accessTier, proAccessSource]);

  const closeEarlyCreatorModal = () => {
    if (user) {
      localStorage.setItem(`early_creator_modal_seen_${user.id}`, 'true');
    }
    setShowEarlyCreatorModal(false);
  };

  // Verification handlers
  const handleStartDemo = async () => {
    console.log('Starting demo tutorial from verification UI');
    setIsVerificationLoading(true);
    
    // First, ensure we have a track loaded and audio context initialized
    if (tracks.length === 0) {
      try {
        // Initialize audio and load a track first
        await handleInitializeAudio();
        // Wait a bit for the track to load, then start onboarding
        setTimeout(() => {
          setShowVerificationUI(false);
          setIsVerificationLoading(false);
          onboarding.startOnboarding();
        }, 1500);
      } catch (error) {
        console.error('Failed to initialize audio for tutorial:', error);
        // Still try to start onboarding even if audio fails
        setTimeout(() => {
          setShowVerificationUI(false);
          setIsVerificationLoading(false);
          onboarding.startOnboarding();
        }, 500);
      }
    } else {
      // Track already loaded, start onboarding immediately
      setShowVerificationUI(false);
      setIsVerificationLoading(false);
      setTimeout(() => {
        onboarding.startOnboarding();
      }, 500);
    }
  };

  const handleStartCreating = async () => {
    console.log('Starting normal creation from verification UI');
    setIsVerificationLoading(true);
    
    // If no tracks are loaded, load one to get started
    if (tracks.length === 0) {
      try {
        await handleInitializeAudio();
      } catch (error) {
        console.error('Failed to initialize audio for creation:', error);
      }
    }
    
    setShowVerificationUI(false);
    setIsVerificationLoading(false);
  };

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
  // Loading placeholder - keeps existing tracks visible and playing during any track load
  const [loadingTrackPlaceholder, setLoadingTrackPlaceholder] = useState<{
    id: string;
    displayName: string;
    mode: 'add' | 'replace'; // add = new track on top, replace = swapping first track (prev/next)
  } | null>(null);
  const [loopPlayhead, setLoopPlayhead] = useState(0);
  const [samplePlayhead, setSamplePlayhead] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedCueTrackId, setSelectedCueTrackId] = useState<string | null>(null);
  /** Dedicated reference track for Smart Sample Suggestions (independent of cue selection; e.g. match to a loop). */
  const [suggestionReferenceTrackId, setSuggestionReferenceTrackId] = useState<string | null>(null);
  const [armedLoopTrackIds, setArmedLoopTrackIds] = useState<Set<string>>(() => new Set());
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
  
  // Store toggle playback functions for each track (for global space bar)
  const togglePlaybackRefs = useRef<{ [key: string]: React.MutableRefObject<(() => void) | null> }>({});
  
  // Get or create seek function ref for a track
  const getSeekFunctionRef = useCallback((trackId: string) => {
    if (!seekFunctionRefs.current[trackId]) {
      seekFunctionRefs.current[trackId] = { current: null };
    }
    return seekFunctionRefs.current[trackId];
  }, []);

  // Get or create toggle playback function ref for a track
  const getTogglePlaybackRef = useCallback((trackId: string) => {
    if (!togglePlaybackRefs.current[trackId]) {
      togglePlaybackRefs.current[trackId] = { current: null };
    }
    return togglePlaybackRefs.current[trackId];
  }, []);

  // Global play: play/pause all armed loop tracks (same as space bar)
  const handleGlobalPlay = useCallback(() => {
    if (armedLoopTrackIds.size === 0) return;
    const anyArmedPlaying = [...armedLoopTrackIds].some(id => playbackStates[id]);
    armedLoopTrackIds.forEach(trackId => {
      const isPlaying = playbackStates[trackId];
      if (anyArmedPlaying ? isPlaying : !isPlaying) {
        getTogglePlaybackRef(trackId).current?.();
      }
    });
  }, [armedLoopTrackIds, playbackStates, getTogglePlaybackRef]);

  // Stop all track playback (loops and chops) - used when recording completes
  const stopAllPlayback = useCallback(() => {
    tracks.forEach(track => {
      if (playbackStates[track.id]) {
        getTogglePlaybackRef(track.id).current?.();
      }
    });
  }, [tracks, playbackStates, getTogglePlaybackRef]);

  useEffect(() => {
    const handleRecordingCompleted = () => stopAllPlayback();
    window.addEventListener('recordingCompleted', handleRecordingCompleted);
    return () => window.removeEventListener('recordingCompleted', handleRecordingCompleted);
  }, [stopAllPlayback]);

  // Clear suggestion reference if that track was removed
  useEffect(() => {
    if (suggestionReferenceTrackId && !tracks.some((t) => t.id === suggestionReferenceTrackId)) {
      setSuggestionReferenceTrackId(null);
    }
  }, [tracks, suggestionReferenceTrackId]);

  // Filter state
  const [lowpassFreqs, setLowpassFreqs] = useState<{ [key: string]: number }>({});
  const [highpassFreqs, setHighpassFreqs] = useState<{ [key: string]: number }>({});
  const [filterEnabled, setFilterEnabled] = useState<{ [key: string]: boolean }>({});
  
  // Track navigation state
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const randomQueueRef = useRef<number[]>([]);
  const historyStackRef = useRef<number[]>([]);
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

  // Track which waveforms have finished loading (avoids flicker on initial load/restore)
  const [waveformReadyTrackIds, setWaveformReadyTrackIds] = useState<Set<string>>(() => new Set());
  // When adding a track, defer clearing placeholder until this track's waveform is ready
  const addingTrackIdRef = useRef<string | null>(null);
  const analysisTimeoutIdsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const trackIdsKey = useMemo(() => tracks.map(t => t.id).join(','), [tracks]);
  // Only prune removed tracks - keep ready status for existing tracks (avoids all tracks loading when adding one)
  useEffect(() => {
    setWaveformReadyTrackIds(prev => {
      const currentIds = new Set(tracks.map(t => t.id));
      const pruned = new Set<string>();
      for (const id of prev) {
        if (currentIds.has(id)) pruned.add(id);
      }
      return pruned;
    });
  }, [trackIdsKey]);
  const handleWaveformReady = useCallback((trackId: string) => {
    setWaveformReadyTrackIds(prev => new Set(prev).add(trackId));
    if (addingTrackIdRef.current === trackId) {
      addingTrackIdRef.current = null;
      setLoadingTrackPlaceholder(null);
      setWaveformsSettled(true); // Skip 200ms debounce — existing tracks were already shown, avoid skeleton flash
    }
  }, []);

  // Fallback: if waveform never reports ready (e.g. WaveSurfer stalls on certain files), clear loading after timeout
  const WAVEFORM_LOAD_TIMEOUT_MS = 20000;
  useEffect(() => {
    if (!loadingTrackPlaceholder || tracks.length === 0) return;
    const pendingTrackId = addingTrackIdRef.current ?? tracks[0]?.id;
    if (!pendingTrackId || waveformReadyTrackIds.has(pendingTrackId)) return;

    const timer = setTimeout(() => {
      setWaveformReadyTrackIds(prev => new Set(prev).add(pendingTrackId));
      if (addingTrackIdRef.current === pendingTrackId) {
        addingTrackIdRef.current = null;
        setLoadingTrackPlaceholder(null);
        setWaveformsSettled(true);
      }
    }, WAVEFORM_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [loadingTrackPlaceholder, tracks, waveformReadyTrackIds]);

  const tracksToRender = useMemo(() =>
    loadingTrackPlaceholder?.mode === 'replace' ? tracks.slice(1) : tracks,
    [tracks, loadingTrackPlaceholder?.mode]);
  const allWaveformsReady = tracksToRender.length === 0 || tracksToRender.every(t => waveformReadyTrackIds.has(t.id));

  // Debounce: only show tracks after waveforms have been ready for 200ms (reduces restore flicker)
  const [waveformsSettled, setWaveformsSettled] = useState(false);
  useEffect(() => {
    if (!allWaveformsReady) {
      setWaveformsSettled(false);
      return;
    }
    const t = setTimeout(() => setWaveformsSettled(true), 200);
    return () => clearTimeout(t);
  }, [allWaveformsReady]);

  const showTrackSkeletons = !loadingTrackPlaceholder && tracksToRender.length > 0 && !waveformsSettled;

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

  // --- Studio State Persistence (for authorized users only) ---
  const getStudioStateKey = () => user ? `studioState-${user.id}` : null;
  
  const saveStudioStateToLocal = () => {
    const stateKey = getStudioStateKey();
    if (!stateKey || !user || isGuestMode) return;

    const ref = studioStateForSaveRef.current;
    if (!ref.tracks.length) return;

    try {
      const studioState = {
        tracks: ref.tracks.map(track => {
          let fileKey = track.fileKey ?? (track.sourceAssetId && ref.availableAssets.find(a => a.id === track.sourceAssetId)?.fileKey);
          // Fallback: match by id prefix or fileName when exact lookup fails (handles tier/timing mismatches)
          if (!fileKey && (track.sourceAssetId || track.id)) {
            const lookupId = track.sourceAssetId ?? track.id;
            const basePrefix = String(lookupId).replace(/-?\d{10,}$/, '');
            let fallbackAsset = ref.availableAssets.find(a => a.id === basePrefix || a.id.startsWith(basePrefix + '-'));
            if (!fallbackAsset && track.file?.name) {
              const fn = (track.file.name as string).toLowerCase().replace(/\s+/g, '-').replace(/\.\w+$/, '');
              fallbackAsset = ref.availableAssets.find(a =>
                a.name.toLowerCase().replace(/\s+/g, '-').includes(fn) || a.id.toLowerCase().includes(fn)
              ) ?? undefined;
            }
            fileKey = fallbackAsset?.fileKey;
          }
          return {
            id: track.id,
            sourceAssetId: track.sourceAssetId ?? track.id,
            fileKey: fileKey ?? undefined,
            fileName: track.file.name,
            fileSize: track.file.size,
            fileType: track.file.type,
            mode: track.mode,
            loopStart: track.loopStart,
            loopEnd: track.loopEnd,
            cuePoints: track.cuePoints,
            tempo: track.tempo,
            timeSignature: track.timeSignature,
            firstMeasureTime: track.firstMeasureTime,
            showMeasures: ref.showMeasures[track.id] || false,
            showCueThumbs: (ref.showCueThumbs[track.id] ?? true),
            zoomLevel: ref.zoomLevels[track.id] || 1,
            playbackSpeed: ref.playbackSpeeds[track.id] || 1,
            volume: ref.volume[track.id] || 1,
            lowpassFreq: ref.lowpassFreqs[track.id] || 20000,
            highpassFreq: ref.highpassFreqs[track.id] || 20,
            filterEnabled: ref.filterEnabled[track.id] || false,
            expandedControls: ref.expandedControls[track.id] || false,
            playbackTime: ref.playbackTimes[track.id] || 0
          };
        }),
        selectedCueTrackId: ref.selectedCueTrackId,
        armedLoopTrackIds: [...ref.armedLoopTrackIds],
        currentTrackIndex: ref.currentTrackIndex,
        lastUsedVolume: ref.lastUsedVolume,
        timestamp: Date.now(),
        version: 1
      };

      localStorage.setItem(stateKey, JSON.stringify(studioState));
    } catch (error) {
      console.warn('Failed to save studio state:', error);
    }
  };
  
  // Keep ref in sync for reliable save (beforeunload/debounce can fire with stale closures)
  studioStateForSaveRef.current = {
    tracks,
    availableAssets: availableAssets || [],
    showMeasures,
    showCueThumbs,
    zoomLevels,
    playbackSpeeds,
    volume,
    lowpassFreqs,
    highpassFreqs,
    filterEnabled,
    expandedControls,
    playbackTimes,
    selectedCueTrackId,
    armedLoopTrackIds,
    currentTrackIndex,
    lastUsedVolume,
  };

  const loadStudioStateFromLocal = (): any | null => {
    const stateKey = getStudioStateKey();
    if (!stateKey) return null;
    
    try {
      const saved = localStorage.getItem(stateKey);
      if (!saved) return null;
      
      return JSON.parse(saved);
    } catch (error) {
      console.warn('Failed to load studio state:', error);
      return null;
    }
  };
  
  const clearStudioStateFromLocal = () => {
    const stateKey = getStudioStateKey();
    if (!stateKey) return;
    
    try {
      localStorage.removeItem(stateKey);
    } catch (error) {
      console.warn('Failed to clear studio state:', error);
    }
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
  const saveArmedLoopTrackIdsToLocal = (ids: string[]) => {
    if (ids.length > 0) {
      localStorage.setItem('armedLoopTrackIds', JSON.stringify(ids));
    } else {
      localStorage.removeItem('armedLoopTrackIds');
    }
  };
  const loadArmedLoopTrackIdsFromLocal = (): string[] => {
    const saved = localStorage.getItem('armedLoopTrackIds');
    return saved ? JSON.parse(saved) : [];
  };

  // --- PATCH: Load settings on mount ---
  useEffect(() => {
    // Load selected cue track id and armed loop track ids
    const selected = loadSelectedCueTrackIdFromLocal();
    if (selected) setSelectedCueTrackId(selected);
    const armedIds = loadArmedLoopTrackIdsFromLocal();
    if (armedIds.length > 0) setArmedLoopTrackIds(new Set(armedIds));
  }, []);

  // --- Studio State Restoration ---
  // Shared restore logic: fetches audio by fileKey, restores tracks + params. Uses defaults for zoomLevel (1) and playbackTime (0) when missing.
  const restoreFromState = useCallback(async (savedState: any): Promise<boolean> => {
    if (!savedState?.tracks?.length) return false;

    try {
      isRestoringRef.current = true;
      let context = audioContext;
      if (!context) {
        try {
          context = await initializeAudio();
          setIsAudioInitialized(true);
        } catch (initError) {
          console.error('Error initializing audio context during restore:', initError);
          setNeedsUserInteraction(true);
          return false;
        }
      }
      if (!context) {
        setNeedsUserInteraction(true);
        return false;
      }

      const restoredTracks: Track[] = [];
      const assets = availableAssets || [];

      for (let i = 0; i < savedState.tracks.length; i++) {
        const savedTrack = savedState.tracks[i];
        try {
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          let fileKeyToUse: string | undefined;
          if (savedTrack.fileKey) {
            fileKeyToUse = savedTrack.fileKey;
          } else {
            const lookupId = savedTrack.sourceAssetId ?? savedTrack.id;
            let asset = assets.find(a => a.id === lookupId);
            if (!asset && lookupId) {
              const basePrefix = lookupId.replace(/-?\d{10,}$/, '');
              asset = assets.find(a => a.id === basePrefix || a.id.startsWith(basePrefix + '-'));
            }
            if (!asset && savedTrack.fileName) {
              const fn = (savedTrack.fileName as string).toLowerCase().replace(/\s+/g, '-').replace(/\.\w+$/, '');
              asset = assets.find(a => {
                const an = a.name.toLowerCase().replace(/\s+/g, '-');
                return fn.includes(an) || an.includes(fn) || a.id.toLowerCase().includes(fn);
              });
            }
            if (!asset) continue;
            fileKeyToUse = asset.fileKey;
          }

          if (!fileKeyToUse) continue;

          const signedUrl = await signFile(fileKeyToUse);
          const response = await fetch(signedUrl);
          const blob = await response.blob();
          const file = new File([blob], savedTrack.fileName, { type: savedTrack.fileType });
          const buffer = await loadAudioBuffer(file, context);

          const rawCuePoints = savedTrack.cuePoints;
          const isAllZeros = Array.isArray(rawCuePoints) && rawCuePoints.every(v => v === 0);
          let validCuePoints: number[];
          if (Array.isArray(rawCuePoints) && rawCuePoints.length > 0 && rawCuePoints.every(v => typeof v === 'number') && !isAllZeros) {
            validCuePoints = rawCuePoints.map(t => Math.max(0, Math.min(t, buffer.duration)));
          } else {
            const fromLocal = loadCuePointsFromLocal(savedTrack.id);
            const fromLocalValid = Array.isArray(fromLocal) && fromLocal.length > 0 && fromLocal.every(v => typeof v === 'number') && !fromLocal.every(v => v === 0);
            validCuePoints = fromLocalValid
              ? fromLocal.map(t => Math.max(0, Math.min(t, buffer.duration)))
              : Array.from({ length: 10 }, (_, i) => buffer.duration * (i / 10));
          }

          let validChopStyle: 'cue' | 'hold' | 'one-shot' =
            savedTrack.chopTriggerStyle && ['cue', 'hold', 'one-shot'].includes(savedTrack.chopTriggerStyle)
              ? savedTrack.chopTriggerStyle
              : 'cue';
          if (tier.id !== 'pro' && (validChopStyle === 'hold' || validChopStyle === 'one-shot')) {
            validChopStyle = 'cue';
          }
          const restoredTrack: Track = {
            id: savedTrack.id,
            sourceAssetId: savedTrack.sourceAssetId ?? savedTrack.id,
            fileKey: fileKeyToUse,
            file,
            buffer,
            mode: (savedTrack.mode && ['preview', 'loop', 'cue'].includes(savedTrack.mode)) ? savedTrack.mode : 'cue',
            chopTriggerStyle: validChopStyle,
            loopStart: typeof savedTrack.loopStart === 'number' ? savedTrack.loopStart : 0,
            loopEnd: typeof savedTrack.loopEnd === 'number' ? savedTrack.loopEnd : buffer.duration,
            cuePoints: validCuePoints,
            tempo: savedTrack.tempo ?? 120,
            timeSignature: savedTrack.timeSignature ?? { numerator: 4, denominator: 4 },
            firstMeasureTime: savedTrack.firstMeasureTime ?? 0,
            showMeasures: savedTrack.showMeasures ?? false,
            beats: Array.isArray(savedTrack.beats) && savedTrack.beats.length > 0 ? savedTrack.beats : undefined
          };

          const restoredMode = (savedTrack.mode && ['preview', 'loop', 'cue'].includes(savedTrack.mode)) ? savedTrack.mode : 'cue';
          const restoredLoopStart = typeof savedTrack.loopStart === 'number' ? savedTrack.loopStart : 0;
          const restoredLoopEnd = typeof savedTrack.loopEnd === 'number' ? savedTrack.loopEnd : buffer.duration;
          const trackSettings = {
            mode: restoredMode,
            chopTriggerStyle: validChopStyle,
            loopStart: restoredLoopStart,
            loopEnd: restoredLoopEnd,
            cuePoints: validCuePoints,
            tempo: savedTrack.tempo ?? 120,
            timeSignature: savedTrack.timeSignature ?? { numerator: 4, denominator: 4 },
            firstMeasureTime: savedTrack.firstMeasureTime ?? 0,
            showMeasures: savedTrack.showMeasures ?? false,
            showCueThumbs: savedTrack.showCueThumbs ?? true,
            zoomLevel: savedTrack.zoomLevel ?? 1,
            playbackSpeed: savedTrack.playbackSpeed ?? 1,
            volume: savedTrack.volume ?? 1,
            lowpassFreq: savedTrack.lowpassFreq ?? 20000,
            highpassFreq: savedTrack.highpassFreq ?? 20,
            filterEnabled: savedTrack.filterEnabled ?? false
          };
          saveTrackSettingsToLocal(savedTrack.id, trackSettings);
          saveCuePointsToLocal(savedTrack.id, validCuePoints);

          restoredTracks.push(restoredTrack);

          setShowMeasures(prev => ({ ...prev, [savedTrack.id]: savedTrack.showMeasures ?? false }));
          setShowCueThumbs(prev => ({ ...prev, [savedTrack.id]: savedTrack.showCueThumbs ?? true }));
          setZoomLevels(prev => ({ ...prev, [savedTrack.id]: savedTrack.zoomLevel ?? 1 }));
          setPlaybackSpeeds(prev => ({ ...prev, [savedTrack.id]: savedTrack.playbackSpeed ?? 1 }));
          setVolume(prev => ({ ...prev, [savedTrack.id]: savedTrack.volume ?? 1 }));
          setLowpassFreqs(prev => ({ ...prev, [savedTrack.id]: savedTrack.lowpassFreq ?? 20000 }));
          setHighpassFreqs(prev => ({ ...prev, [savedTrack.id]: savedTrack.highpassFreq ?? 20 }));
          setFilterEnabled(prev => ({ ...prev, [savedTrack.id]: savedTrack.filterEnabled ?? false }));
          setExpandedControls(prev => ({ ...prev, [savedTrack.id]: savedTrack.expandedControls ?? false }));
          setPlaybackTimes(prev => ({ ...prev, [savedTrack.id]: savedTrack.playbackTime ?? 0 }));
        } catch (error) {
          const msg = error instanceof Error ? error.message : '';
          if (msg.includes('429')) {
            setError('Too many requests. Please wait a moment and try again.');
            break;
          }
        }
      }

      if (restoredTracks.length > 0) {
        setTracks(restoredTracks);
        setCurrentTrackIndex(savedState.currentTrackIndex ?? 0);
        setSelectedCueTrackId(savedState.selectedCueTrackId ?? null);
        setArmedLoopTrackIds(Array.isArray(savedState.armedLoopTrackIds) ? new Set(savedState.armedLoopTrackIds) : new Set());
        setLastUsedVolume(savedState.lastUsedVolume ?? 1);
        return true;
      }
    } catch {
      // Restore failed
    } finally {
      isRestoringRef.current = false;
    }
    return false;
  }, [audioContext, initializeAudio, availableAssets, loadCuePointsFromLocal, saveTrackSettingsToLocal, saveCuePointsToLocal, signFile, tier.id]);

  const restoreStudioStateFromLocal = useCallback(async (): Promise<boolean> => {
    if (!user || isGuestMode) return false;
    const savedState = loadStudioStateFromLocal();
    if (!savedState || !savedState.tracks || savedState.tracks.length === 0) return false;
    return restoreFromState(savedState);
  }, [user, isGuestMode, loadStudioStateFromLocal, restoreFromState]);

  // Restore from saved session (RecordingSession or DB Session with full_state)
  const restoreStudioStateFromSession = useCallback(async (session: { events?: Array<{ data?: any }>; full_state?: any }): Promise<boolean> => {
    if (!user || isGuestMode) return false;
    const savedState = session.events?.[0]?.data ?? session.full_state;
    if (!savedState?.tracks?.length) return false;
    return restoreFromState(savedState);
  }, [user, isGuestMode, restoreFromState]);

  const handleRestoreSession = useCallback(async (session: { events?: Array<{ data?: any }>; full_state?: any }) => {
    await restoreStudioStateFromSession(session);
  }, [restoreStudioStateFromSession]);

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
    if (isGuestMode) {
      // For demo mode, use bundled tracks from DemoProvider

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
  }, [libraryTracks, isGuestMode, user]);

  // No automatic restoration on load - user must explicitly choose "Start digging" or "Restore previous session"

  // Load a random track on component mount
  const loadRandomTrack = useCallback(async () => {
      try {
        setIsTrackLoading(true);
        setError(null);
        
                 // In demo mode, use the DemoProvider's current track
         if (isGuestMode && currentGuestTrack) {
          
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

                     // Fetch the bundled track from DemoProvider
           const response = await fetch(currentGuestTrack.file);
           const blob = await response.blob();
           const file = new File([blob], `${currentGuestTrack.name}.${currentGuestTrack.type}`, { 
             type: `audio/${currentGuestTrack.type}` 
           });
           
           // Load the audio file into buffer
           const buffer = await loadAudioBuffer(file, context);
           
           // Create track using DemoProvider metadata
           const newTrack: Track = {
             id: currentGuestTrack.id,
             file,
             buffer,
             peaks: extractPeaksFromBuffer(buffer),
             mode: 'cue',
             chopTriggerStyle: 'cue',
             loopStart: 0,
             loopEnd: buffer.duration,
             cuePoints: Array.from({ length: 10 }, (_, i) => 
               buffer.duration * (i / 10)
             ),
             tempo: currentGuestTrack.bpm || 120,
             timeSignature: { numerator: 4, denominator: 4 },
             firstMeasureTime: 0,
             showMeasures: false
           };
          
          setTracks([newTrack]);
          setCurrentTrackIndex(0);
          setShowCueThumbs(prev => ({ ...prev, [newTrack.id]: true }));
          setSelectedCueTrackId(newTrack.id);
          setIsTrackLoading(false);
          
          // Creative metrics: sampler_ready + track_loaded (first track)
          if (!hasEmittedSamplerReady.current) {
            trackEvent('sampler_ready', { trackId: currentGuestTrack.id, userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
            hasEmittedSamplerReady.current = true;
          }
          trackEvent('track_loaded', { trackId: currentGuestTrack.id, trackIndex: 0, source: 'guest', userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
          
          // Track demo event
          trackGuestEvent('session_started', { 
            trackId: currentGuestTrack.id,
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
        let audioUrl: string;
        try {
          audioUrl = await signFile(asset.fileKey);
        } catch (error) {
          console.error('Failed to get signed URL for asset:', error);
          const msg = error instanceof Error ? error.message : '';
          throw new Error(msg.includes('429') ? 'Too many requests. Please wait a moment and try again.' : 'Failed to access audio file. Please try again.');
        }
        
        // Fetch the audio file
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const file = new File([blob], `${asset.name}.${asset.type}`, { type: `audio/${asset.type}` });
        
        // Load the audio file into buffer
        const buffer = await loadAudioBuffer(file, context);
        
        // Generate track ID
        const trackId = asset.id;
        const settings = loadTrackSettingsFromLocal(trackId) || {};
        
        const newMode = settings.mode || 'cue';
        const newChopStyle = (settings.chopTriggerStyle && ['cue', 'hold', 'one-shot'].includes(settings.chopTriggerStyle))
          ? settings.chopTriggerStyle
          : 'cue';
        const trackTempo = (asset.bpm != null && asset.bpm >= 40 && asset.bpm <= 300)
          ? asset.bpm
          : (settings.tempo || 120);
        const newTrack: Track = {
          id: trackId,
          file,
          buffer,
          mode: newMode,
          chopTriggerStyle: newMode === 'cue' ? newChopStyle : undefined,
          loopStart: settings.loopStart || 0,
          loopEnd: settings.loopEnd || buffer.duration,
          cuePoints: settings.cuePoints || Array.from({ length: 10 }, (_, i) => 
            buffer.duration * (i / 10)
          ),
          tempo: trackTempo,
          timeSignature: settings.timeSignature || { numerator: 4, denominator: 4 },
          firstMeasureTime: settings.firstMeasureTime || 0,
          showMeasures: settings.showMeasures || false,
          key: asset.key,
          beats: asset.beats
        };
        
        setTracks([newTrack]);
        setCurrentTrackIndex(0);
        setShowMeasures(prev => ({ ...prev, [trackId]: !!settings.showMeasures }));
        setShowCueThumbs(prev => ({ ...prev, [trackId]: settings.showCueThumbs !== undefined ? !!settings.showCueThumbs : true }));
        setZoomLevels(prev => ({ ...prev, [trackId]: settings.zoomLevel || 1 }));
        setSelectedCueTrackId(trackId);
        setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
        const trackVolume = newTrack.mode === 'preview' 
          ? lastUsedVolumeRef.current 
          : (typeof settings.volume === 'number' ? settings.volume : lastUsedVolumeRef.current);
        setVolume(prev => ({ ...prev, [trackId]: trackVolume }));
        setExpandedControls(prev => ({ ...prev, [trackId]: false }));
        
        // Creative metrics: sampler_ready + track_loaded (first track from library)
        if (!hasEmittedSamplerReady.current) {
          trackEvent('sampler_ready', { trackId, userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
          hasEmittedSamplerReady.current = true;
        }
        trackEvent('track_loaded', { trackId, trackIndex: 0, source: 'library', userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
        
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
        } else if (errorMessage.startsWith('Too many requests')) {
          setError(errorMessage);
        } else if (error instanceof Error && error.message.includes('Failed to fetch')) {
          setError(`Connection error (attempt ${newRetryCount}/3). Please check your connection and try again.`);
        } else {
          setError(`Error loading track: ${errorMessage}`);
        }
      }
    }, [audioContext, initializeAudio, isGuestMode, currentGuestTrack, availableAssets, user, trackGuestEvent, trackEvent, tier]);

    useEffect(() => {
      if (tracks.length === 0 && !isManuallyAddingTrack && !isTrackLoading && !error && trackLoadRetryCount < 3) {
        // Don't automatically load tracks - wait for user interaction
        // This prevents AudioContext initialization issues
      }
    }, [tracks.length, isManuallyAddingTrack, isGuestMode, availableAssets, user, isTrackLoading, loadRandomTrack, error, trackLoadRetryCount]);

  // Keyboard navigation for track switching
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Skip shortcuts when user is typing in an input (volume, speed, filters, etc.)
      const active = document.activeElement;
      const isTypingInput =
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active as HTMLElement)?.isContentEditable ||
        (active instanceof HTMLInputElement &&
          (active as HTMLInputElement).type !== 'range');
      if (isTypingInput) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') return;
        if (event.key === ' ') return; // Never trigger playback when typing in text inputs
        if (event.key === 'z' || event.key === 'Z' || event.key === 'x' || event.key === 'X' || event.key === 'c' || event.key === 'C') return; // Don't trigger zoom when typing
      }

      // Space bar: global play/pause for all armed loop tracks (disabled when text inputs are focused)
      if (event.key === ' ') {
        if (isTypingInput) return; // Ensure we never trigger playback while user is typing
        if (isTapTempoActive) return; // Let event propagate to TempoControls for tap tempo
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) handleGlobalPlay();
        return;
      }

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

    window.addEventListener('keydown', handleKeyPress, true); // Capture phase: handle Space before focused buttons or default scroll
    return () => window.removeEventListener('keydown', handleKeyPress, true);
  }, [tracks, currentTrackIndex, isTapTempoActive, handleGlobalPlay]);

        // Handle demo track changes
      useEffect(() => {
        if (isGuestMode && currentGuestTrack && audioContext && tracks.length > 0) {
          // If the currently loaded track already matches the bundled track, do nothing
          if (tracks[0]?.id === currentGuestTrack.id) return;
          
          // Reload the guest buffer so next/prev actually swaps the loaded audio + cue points.
          (async () => {
            try {
              setIsInitializingAudio(true);
              setError(null);

              const response = await fetch(currentGuestTrack.file);
              const blob = await response.blob();
              const file = new File([blob], `${currentGuestTrack.name}.${currentGuestTrack.type}`, {
                type: `audio/${currentGuestTrack.type}`,
              });

              const buffer = await loadAudioBuffer(file, audioContext);
              const trackId = currentGuestTrack.id;
              const mode: 'cue' | 'loop' = tracks[0]?.mode === 'loop' ? 'loop' : 'cue';

              const newTrack: Track = {
                id: trackId,
                file,
                buffer,
                peaks: extractPeaksFromBuffer(buffer),
                mode,
                chopTriggerStyle: mode === 'cue' ? 'cue' : undefined,
                loopStart: 0,
                loopEnd: buffer.duration,
                cuePoints: Array.from({ length: 10 }, (_, i) => buffer.duration * (i / 10)),
                tempo: currentGuestTrack.bpm || 120,
                timeSignature: { numerator: 4, denominator: 4 },
                firstMeasureTime: 0,
                showMeasures: false,
              };

              setTracks([newTrack]);
              setCurrentTrackIndex(0);
              setShowMeasures((prev) => ({ ...prev, [trackId]: false }));
              setShowCueThumbs((prev) => ({ ...prev, [trackId]: mode === 'cue' }));
              if (mode === 'cue') setSelectedCueTrackId(trackId);
              setArmedLoopTrackIds(mode === 'loop' ? new Set([trackId]) : new Set());
              setZoomLevels((prev) => ({ ...prev, [trackId]: 1 }));
              setPlaybackSpeeds((prev) => ({ ...prev, [trackId]: 1 }));
              setVolume((prev) => ({ ...prev, [trackId]: lastUsedVolumeRef.current }));
              setExpandedControls((prev) => ({ ...prev, [trackId]: false }));
              setPlaybackTimes((prev) => ({ ...prev, [trackId]: 0 }));
              setPlaybackStates((prev) => ({ ...prev, [trackId]: false }));
              setLowpassFreqs((prev) => ({ ...prev, [trackId]: 20000 }));
              setHighpassFreqs((prev) => ({ ...prev, [trackId]: 20 }));
              setFilterEnabled((prev) => ({ ...prev, [trackId]: false }));

              trackGuestEvent('next_track', {
                fromTrackId: tracks[0]?.id,
                toTrackId: currentGuestTrack.id,
              });
            } catch (error) {
              console.error('Failed to reload guest track:', error);
              const msg = error instanceof Error ? error.message : '';
              setError(msg || 'Failed to load guest track');
            } finally {
              setIsInitializingAudio(false);
            }
          })();
        }
      }, [isGuestMode, currentGuestTrack, audioContext, tracks.length, trackGuestEvent]);

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
    if (
      isVerticalSwipeDown &&
      !isAddingTrack &&
      (!isGuestMode ? canAddTrack : tracks.length >= 1)
    ) {
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
      if (isGuestMode && tracks.length >= 1) {
        openSignupModal('add_second_source');
        setTouchStartX(null);
        setTouchEndX(null);
        setTouchStartY(null);
        setTouchEndY(null);
        setShowAddTrackGesture(false);
        return;
      }
      if (canAddTrack && !isAddingTrack && !isGuestMode) {
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
    } else if (isVerticalGesture && e.deltaY < 0) {
      e.preventDefault();
      if (isGuestMode && tracks.length >= 1) {
        openSignupModal('add_second_source');
        setLastGestureTime(now);
        setTimeout(() => setIsGestureProcessing(false), 500);
        return;
      }
      if (canAddTrack && !isAddingTrack && !isGuestMode) {
        setLastGestureTime(now);
        setIsGestureProcessing(true);
        addNewTrack();
        setTimeout(() => setIsGestureProcessing(false), 1000);
      }
    }
    // For other gestures, allow normal scrolling to pass through
  };

  // Track navigation functions
  const refillRandomQueue = useCallback((assetsLength: number, excludeIndex: number) => {
    if (assetsLength <= 0) {
      randomQueueRef.current = [];
      return;
    }
    const queue = Array.from({ length: assetsLength }, (_, i) => i).filter(i => i !== excludeIndex);
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    randomQueueRef.current = queue;
  }, []);

  const getRandomNextIndex = useCallback((assetsLength: number, currentIndex: number): number | null => {
    if (assetsLength <= 0) return null;
    if (assetsLength === 1) return currentIndex;

    if (randomQueueRef.current.length === 0) {
      refillRandomQueue(assetsLength, currentIndex);
    }

    const nextIndex = randomQueueRef.current.shift();
    if (typeof nextIndex === 'number') return nextIndex;

    // Safety fallback if queue and asset list get out of sync
    refillRandomQueue(assetsLength, currentIndex);
    return randomQueueRef.current.shift() ?? null;
  }, [refillRandomQueue]);

  useEffect(() => {
    const assetsLength = (availableAssets || []).length;
    if (assetsLength <= 1) {
      randomQueueRef.current = [];
      historyStackRef.current = [];
      return;
    }

    randomQueueRef.current = randomQueueRef.current.filter(index => index >= 0 && index < assetsLength);
    historyStackRef.current = historyStackRef.current.filter(index => index >= 0 && index < assetsLength);
  }, [availableAssets]);

  const handleNextTrack = useCallback(async () => {
    if (isTrackLoading || isGuestLoading) return; // Disable during loading
    if (tracks.length === 0) return;
    
    if (isGuestMode) {
      // In demo mode, load next bundled track
      loadRandomGuestTrack();
    } else {
      const assetsLength = (availableAssets || []).length;
      const nextIndex = getRandomNextIndex(assetsLength, currentTrackIndex);
      if (nextIndex === null) return;

      if (assetsLength > 1) {
        historyStackRef.current.push(currentTrackIndex);
      }
      await loadTrackByIndex(nextIndex, true); // true = only update first track
    }
  }, [tracks.length, currentTrackIndex, isTrackLoading, isGuestLoading, isGuestMode, loadRandomGuestTrack, availableAssets, getRandomNextIndex]);

  const handlePreviousTrack = useCallback(async () => {
    if (isTrackLoading || isGuestLoading) return; // Disable during loading
    if (tracks.length === 0) return;
    
    if (isGuestMode) {
      // In demo mode, load next bundled track (since we don't have previous bundled track concept)
      loadRandomGuestTrack();
    } else {
      const assetsLength = (availableAssets || []).length;
      if (assetsLength <= 0) return;

      const prevFromHistory = historyStackRef.current.pop();
      const prevIndex = typeof prevFromHistory === 'number'
        ? prevFromHistory
        : getRandomNextIndex(assetsLength, currentTrackIndex);
      if (prevIndex === null) return;

      await loadTrackByIndex(prevIndex, true); // true = only update first track
    }
  }, [tracks.length, currentTrackIndex, isTrackLoading, isGuestLoading, isGuestMode, loadRandomGuestTrack, availableAssets, getRandomNextIndex]);

  const loadTrackByIndex = async (index: number, onlyUpdateFirstTrack: boolean = false) => {
    const assets = availableAssets || [];
    const safeIndex = ((index % assets.length) + assets.length) % assets.length;
    const asset = assets[safeIndex];
    
    if (asset && onlyUpdateFirstTrack && tracks.length > 0) {
      setLoadingTrackPlaceholder({
        id: `loading-${Date.now()}`,
        displayName: asset.name,
        mode: 'replace'
      });
    }
    
    try {
      setIsTrackLoading(true);
      setError(null);
      
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
        const msg = error instanceof Error ? error.message : '';
        throw new Error(msg.includes('429') ? 'Too many requests. Please wait a moment and try again.' : 'Failed to access audio file. Please try again.');
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
      const newMode = settings.mode || 'cue';
      const newChopStyle = (settings.chopTriggerStyle && ['cue', 'hold', 'one-shot'].includes(settings.chopTriggerStyle))
        ? settings.chopTriggerStyle
        : 'cue';
      const trackTempo = (asset.bpm != null && asset.bpm >= 40 && asset.bpm <= 300)
        ? asset.bpm
        : (settings.tempo || 120);
      const newTrack: Track = {
        id: trackId,
        sourceAssetId: asset.id,
        fileKey: asset.fileKey,
        file,
        buffer,
        peaks: extractPeaksFromBuffer(buffer),
        mode: newMode, // Default to cue mode
        chopTriggerStyle: newMode === 'cue' ? newChopStyle : undefined,
        loopStart: settings.loopStart || 0,
        loopEnd: settings.loopEnd || buffer.duration,
        cuePoints: settings.cuePoints || Array.from({ length: 10 }, (_, i) => 
          buffer.duration * (i / 10)
        ),
        tempo: trackTempo,
        timeSignature: settings.timeSignature || { numerator: 4, denominator: 4 },
        firstMeasureTime: settings.firstMeasureTime || 0,
        showMeasures: settings.showMeasures || false,
        key: asset.key,
        beats: asset.beats
      };
      
      if (onlyUpdateFirstTrack && tracks.length > 0) {
        // Only update the first track, preserve other tracks
        const replacedTrackId = tracks[0].id;
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
        addingTrackIdRef.current = replacedTrackId; // Defer clearing placeholder until waveform is ready
      } else {
        // Replace all tracks (original behavior)
        setTracks([newTrack]);
        addingTrackIdRef.current = newTrack.id; // Defer clearing placeholder until waveform is ready
      }
      setCurrentTrackIndex(safeIndex);
      setShowMeasures(prev => ({ ...prev, [trackId]: !!settings.showMeasures }));
      setShowCueThumbs(prev => ({ ...prev, [trackId]: settings.showCueThumbs !== undefined ? !!settings.showCueThumbs : true }));
      setZoomLevels(prev => ({ ...prev, [trackId]: settings.zoomLevel || 1 }));
      if (!onlyUpdateFirstTrack) {
        setSelectedCueTrackId(trackId);
      } else if (newTrack.mode === 'cue') {
        setSelectedCueTrackId(trackId);
      }
      // Reset playback speed but keep volume
      setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
      // Set volume based on mode
      const trackVolume = newTrack.mode === 'preview' 
        ? lastUsedVolumeRef.current 
        : (typeof settings.volume === 'number' ? settings.volume : lastUsedVolumeRef.current);
      setVolume(prev => ({ ...prev, [trackId]: trackVolume }));
      setExpandedControls(prev => ({ ...prev, [trackId]: false }));
      
      // Track loading is complete (placeholder cleared when waveform is ready)
      setIsTrackLoading(false);
      
      // Creative metrics: sampler_ready (if first) + track_loaded
      if (!hasEmittedSamplerReady.current) {
        trackEvent('sampler_ready', { trackId, userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
        hasEmittedSamplerReady.current = true;
      }
      trackEvent('track_loaded', { trackId, trackIndex: safeIndex, source: 'library', userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
    
    } catch (error) {
      console.error('Error loading track by index:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(`Error loading track: ${errorMessage}`);
      setIsTrackLoading(false);
      setLoadingTrackPlaceholder(null);
    }
  };

  // Add new track function
  const addNewTrack = async () => {
    if (isGuestMode && tracks.length >= 1) {
      openSignupModal('add_second_source');
      return;
    }
    if (!canAddTrack || isAddingTrack) return;
    if (isGuestMode) return;
    
    // Select a random asset that's different from existing tracks (before async work)
    const assets = availableAssets || [];
    if (assets.length === 0) {
      setError('No library tracks available. Please wait for tracks to load from the library.');
      return;
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
    
    addingTrackIdRef.current = null; // Clear so add skeleton shows immediately
    setLoadingTrackPlaceholder({
      id: `loading-${Date.now()}`,
      displayName: selectedAsset.name,
      mode: 'add'
    });
    
    try {
      setIsAddingTrack(true);
      setAddTrackAnimation(true);
      setError(null);
      
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
        const msg = error instanceof Error ? error.message : '';
        throw new Error(msg.includes('429') ? 'Too many requests. Please wait a moment and try again.' : 'Failed to access audio file. Please try again.');
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
        peaks: extractPeaksFromBuffer(buffer),
        mode: 'cue', // New tracks always start as cue
        chopTriggerStyle: 'cue',
        loopStart: 0,
        loopEnd: buffer.duration,
        cuePoints: Array.from({ length: 10 }, (_, i) => 
          buffer.duration * (i / 10)
        ),
        tempo: selectedAsset.bpm != null && selectedAsset.bpm >= 40 && selectedAsset.bpm <= 300 ? selectedAsset.bpm : 120,
        timeSignature: { numerator: 4, denominator: 4 },
        firstMeasureTime: 0,
        showMeasures: false,
        key: selectedAsset.key,
        beats: selectedAsset.beats
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
      const isFirstTrack = tracks.length === 0;
      setTracks([newTrack, ...updatedExistingTracks]);
      addingTrackIdRef.current = trackId; // Defer clearing placeholder until waveform is ready
      
      // Creative metrics: sampler_ready (if first) + track_loaded + track_added
      if (isFirstTrack && !hasEmittedSamplerReady.current) {
        trackEvent('sampler_ready', { trackId, userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
        hasEmittedSamplerReady.current = true;
      }
      trackEvent('track_loaded', { trackId, trackIndex: 0, source: 'library', userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
      trackEvent('track_added', { trackId, trackIndex: 0, mode: 'cue', source: 'library', userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
      
      // Initialize states for the new track
      setShowMeasures(prev => ({ ...prev, [trackId]: false }));
      setShowCueThumbs(prev => ({ ...prev, [trackId]: true }));
      setZoomLevels(prev => ({ ...prev, [trackId]: 1 }));
      setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
      setVolume(prev => ({ ...prev, [trackId]: lastUsedVolumeRef.current }));
      setExpandedControls(prev => ({ ...prev, [trackId]: false }));
      setSelectedCueTrackId(trackId);
      
      // Animation delay for button state
      setTimeout(() => {
        setAddTrackAnimation(false);
        setIsAddingTrack(false);
      }, 200);
      
    } catch (error) {
      console.error('Error adding new track:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(errorMessage.startsWith('Too many requests') ? errorMessage : `Error adding track: ${errorMessage}`);
      setIsAddingTrack(false);
      setAddTrackAnimation(false);
      setLoadingTrackPlaceholder(null);
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
    
    // Clean up selected cue track and armed loop if it was removed; fall back to another cue track
    if (selectedCueTrackId === trackId) {
      const remaining = tracks.filter((t) => t.id !== trackId);
      const otherCueTrack = remaining.find((t) => t.mode === 'cue');
      setSelectedCueTrackId(otherCueTrack?.id ?? null);
    }
    setArmedLoopTrackIds(prev => {
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });
    
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
        showCueThumbs: (showCueThumbs[track.id] ?? true),
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

  // Persist armed loop track ids
  useEffect(() => {
    saveArmedLoopTrackIdsToLocal([...armedLoopTrackIds]);
  }, [armedLoopTrackIds]);

  // Save studio state when tracks or settings change (for authorized users)
  useEffect(() => {
    if (!user || isGuestMode) return;
    if (tracks.length === 0) return;
    
    // Debounce the save operation to avoid excessive localStorage writes
    const timeoutId = setTimeout(() => {
      saveStudioStateToLocal();
    }, 1000); // Save after 1 second of inactivity
    
    return () => clearTimeout(timeoutId);
  }, [
    user, 
    isGuestMode, 
    tracks, 
    selectedCueTrackId, 
    armedLoopTrackIds,
    currentTrackIndex,
    showMeasures,
    showCueThumbs,
    zoomLevels,
    playbackSpeeds,
    volume,
    lowpassFreqs,
    highpassFreqs,
    filterEnabled,
    expandedControls,
    playbackTimes,
    lastUsedVolume
  ]);

  // Clear studio state when user logs out
  useEffect(() => {
    if (!user) {
      // User logged out, clear any saved state
      clearStudioStateFromLocal();
    }
  }, [user]);

  // Save state before page unload (refresh/navigation)
  // Must include tracks so handler has fresh state when loop/mode change
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user && !isGuestMode && tracks.length > 0) {
        saveStudioStateToLocal();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, isGuestMode, tracks]);

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
      prev.map(track => {
        if (!track || track.id !== trackId) return track;
        const updated = { ...track, loopStart: start, loopEnd: end };
        // Persist immediately so save/restore captures loop positions
        const settings = loadTrackSettingsFromLocal(trackId) || {};
        saveTrackSettingsToLocal(trackId, { ...settings, loopStart: start, loopEnd: end });
        return updated;
      })
    );
    // Creative metrics: loop_created
    trackEvent('loop_created', { trackId, start, end, userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
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
    // Creative metrics: cue_added
    trackEvent('cue_added', { trackId, cueIndex: index, userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
  };

  // Handle cue point drag state updates for real-time timestamp display
  const handleCueDragStateChange = (trackId: string, index: number, time: number | null) => {
    setCueDragStates(prev => {
      const newState = { ...prev };
      const trackState = newState[trackId] ? { ...newState[trackId] } : {};

      if (time === null) {
        // Remove drag state when drag ends
        delete trackState[index];
        if (Object.keys(trackState).length === 0) {
          delete newState[trackId];
        } else {
          newState[trackId] = trackState;
        }
      } else {
        // Update drag state with current position (new object so React/effects detect the change)
        newState[trackId] = { ...trackState, [index]: time };
      }

      return newState;
    });
  };

  const handleLoopDragStateChange = (trackId: string, start: number | null, end: number | null) => {
    setLoopDragStates(prev => {
      if (start === null || end === null) {
        const { [trackId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [trackId]: { start, end } };
    });
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
          saveTrackSettingsToLocal(trackId, { ...settings, mode, cuePoints: autoCues });
          saveCuePointsToLocal(trackId, autoCues);
          return { ...track, mode, cuePoints: autoCues };
        }
        // Persist mode immediately so save/restore captures it
        const settings = loadTrackSettingsFromLocal(trackId) || {};
        saveTrackSettingsToLocal(trackId, { ...settings, mode });
        return { ...track, mode };
      })
    );
    
    // Handle state transitions when switching modes
    if (mode === 'loop') {
      // Default-arm when switching to loop mode
      setArmedLoopTrackIds(prev => new Set(prev).add(trackId));
      // If switching to loop mode, fall back to another cue track or clear selection
      if (selectedCueTrackId === trackId) {
        const otherCueTrack = tracks.find((t) => t.mode === 'cue' && t.id !== trackId);
        setSelectedCueTrackId(otherCueTrack?.id ?? null);
      }
      setShowCueThumbs(prev => ({ ...prev, [trackId]: false }));
    } else if (mode === 'cue') {
      // If switching to cue mode, remove from armed loops and show cue thumbs
      setArmedLoopTrackIds(prev => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
      setShowCueThumbs(prev => ({ ...prev, [trackId]: true }));
      
      // Always auto-select this track when switching to Chop mode
      setSelectedCueTrackId(trackId);
    } else if (mode === 'preview') {
      // If switching to preview mode, remove from armed loops, fall back to another cue track, hide cue thumbs
      setArmedLoopTrackIds(prev => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
      if (selectedCueTrackId === trackId) {
        const otherCueTrack = tracks.find((t) => t.mode === 'cue' && t.id !== trackId);
        setSelectedCueTrackId(otherCueTrack?.id ?? null);
      }
      setShowCueThumbs(prev => ({ ...prev, [trackId]: false }));
    }
  };

  const handleChopTriggerStyleChange = (trackId: string, chopTriggerStyle: 'cue' | 'hold' | 'one-shot') => {
    if (chopTriggerStyle !== 'cue' && tier.id === 'guest') {
      openSignupModal('trigger_styles');
      return;
    }
    setTracks(prev =>
      prev.map(track =>
        track.id === trackId ? { ...track, chopTriggerStyle } : track
      )
    );
    const settings = loadTrackSettingsFromLocal(trackId) || {};
    saveTrackSettingsToLocal(trackId, { ...settings, chopTriggerStyle });
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

  // Add this function to handle loop arm toggle (multiple loops can be armed)
  const handleLoopArmToggle = (trackId: string) => {
    setArmedLoopTrackIds(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  // Add handler for playback time updates
  const handlePlaybackTimeChange = (trackId: string, time: number) => {
    setPlaybackTimes(prev => ({
      ...prev,
      [trackId]: time
    }));
    // Sync loopPlayhead/samplePlayhead so both playhead and playbackTime stay consistent during playback.
    // Without this, WaveformDisplay can briefly show stale playhead during React's batched updates.
    const track = tracks.find(t => t.id === trackId);
    if (track?.mode === 'loop') {
      setLoopPlayhead(time);
    } else {
      setSamplePlayhead(time);
    }
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

  const handleZoomChange = (trackId: string, level: number) => {
    setZoomLevels(prev => ({ ...prev, [trackId]: Math.max(1, Math.min(8, level)) }));
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
    if (isGuestMode && tracks.length >= 1) {
      setIsDragOver(false);
      setDragTarget(null);
      setDragData(null);
      openSignupModal('add_second_source');
      return;
    }

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
        await handleAddFromLibrary(asset, 'cue');
        return;
      }
      
      // Handle user track or recording drops (from SidePanel) - have fileKey in payload
      if (trackData?.fileKey && (trackData.type === 'user-track' || trackData.type === 'recording')) {
        const userTrack: UserTrack = {
          id: trackData.id || trackId,
          name: trackData.name || 'Recording',
          file: null,
          fileKey: trackData.fileKey,
          type: trackData.fileType || 'audio/wav',
          size: '-',
          uploadedAt: Date.now(),
          bpm: trackData.bpm,
          key: trackData.key,
          beats: trackData.beats
        };
        await handleAddUserTrack(userTrack, 'cue');
        return;
      }
      
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

  // Creative metrics: debounced parameter_changed (500ms)
  const trackParameterChangeDebounced = useCallback(
    (trackId: string, parameterType: string) => {
      const key = `${trackId}-${parameterType}`;
      const existing = parameterChangeTimeoutsRef.current[key];
      if (existing) clearTimeout(existing);
      parameterChangeTimeoutsRef.current[key] = setTimeout(() => {
        trackEvent('parameter_changed', {
          trackId,
          parameterType,
          userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro',
        });
        delete parameterChangeTimeoutsRef.current[key];
      }, 500);
    },
    [trackEvent, tier]
  );

  // Handle volume changes
  const handleVolumeChange = (trackId: string, newVolume: number) => {
    setVolume(prev => ({ ...prev, [trackId]: newVolume }));
    setLastUsedVolume(newVolume);
    trackParameterChangeDebounced(trackId, 'volume');
  };

  // Handle filter changes
  const handleLowpassFreqChange = (trackId: string, freq: number) => {
    setLowpassFreqs(prev => ({ ...prev, [trackId]: freq }));
    trackParameterChangeDebounced(trackId, 'lowpass');
  };

  const handleHighpassFreqChange = (trackId: string, freq: number) => {
    setHighpassFreqs(prev => ({ ...prev, [trackId]: freq }));
    trackParameterChangeDebounced(trackId, 'highpass');
  };

  const handleFilterEnabledChange = (trackId: string, enabled: boolean) => {
    setFilterEnabled(prev => ({ ...prev, [trackId]: enabled }));
  };

  // Handle save current studio state (full state for restore: fileKey, volume, tempo, filters; excludes zoom, playbackTime)
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

    const assets = availableAssets || [];
    const studioState = {
      tracks: tracks.map(track => {
        let fileKey = track.fileKey ?? (track.sourceAssetId && assets.find(a => a.id === track.sourceAssetId)?.fileKey);
        if (!fileKey && (track.sourceAssetId || track.id)) {
          const lookupId = track.sourceAssetId ?? track.id;
          const basePrefix = String(lookupId).replace(/-?\d{10,}$/, '');
          let fallbackAsset = assets.find(a => a.id === basePrefix || a.id.startsWith(basePrefix + '-'));
          if (!fallbackAsset && track.file?.name) {
            const fn = (track.file.name as string).toLowerCase().replace(/\s+/g, '-').replace(/\.\w+$/, '');
            fallbackAsset = assets.find(a =>
              a.name.toLowerCase().replace(/\s+/g, '-').includes(fn) || a.id.toLowerCase().includes(fn)
            ) ?? undefined;
          }
          fileKey = fallbackAsset?.fileKey;
        }
        return {
          id: track.id,
          sourceAssetId: track.sourceAssetId ?? track.id,
          fileKey: fileKey ?? undefined,
          fileName: track.file.name,
          fileSize: track.file.size,
          fileType: track.file.type,
          mode: track.mode,
          loopStart: track.loopStart,
          loopEnd: track.loopEnd,
          cuePoints: track.cuePoints,
          tempo: track.tempo,
          timeSignature: track.timeSignature,
          firstMeasureTime: track.firstMeasureTime,
          showMeasures: showMeasures[track.id] || false,
          showCueThumbs: (showCueThumbs[track.id] ?? true),
          beats: track.beats,
          playbackSpeed: playbackSpeeds[track.id] || 1,
          volume: volume[track.id] || 1,
          lowpassFreq: lowpassFreqs[track.id] || 20000,
          highpassFreq: highpassFreqs[track.id] || 20,
          filterEnabled: filterEnabled[track.id] || false,
          expandedControls: expandedControls[track.id] || false,
          chopTriggerStyle: track.chopTriggerStyle ?? 'cue'
        };
      }),
      selectedCueTrackId,
      armedLoopTrackIds: [...armedLoopTrackIds],
      currentTrackIndex,
      lastUsedVolume,
      timestamp: Date.now(),
      version: 1
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
  const handleUploadTrack = async (file: File, trackType: 'preview' | 'loop' | 'cue' = 'cue') => {
    const placeholderId = `loading-${Date.now()}`;
    addingTrackIdRef.current = null;
    setLoadingTrackPlaceholder({ id: placeholderId, displayName: file.name, mode: 'add' });
    try {
      setIsManuallyAddingTrack(true);
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
      
      // Guest uploads are session-only and replace the current demo track.
      if (isGuestMode) {
        const trackId = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const cuePoints = Array.from({ length: 10 }, (_, i) => buffer.duration * (i / 10));

        const newTrack: Track = {
          id: trackId,
          file,
          buffer,
          peaks: extractPeaksFromBuffer(buffer),
          mode: 'cue',
          chopTriggerStyle: 'cue',
          loopStart: 0,
          loopEnd: buffer.duration,
          cuePoints,
          tempo: currentGuestTrack?.bpm || 120,
          timeSignature: { numerator: 4, denominator: 4 },
          firstMeasureTime: 0,
          showMeasures: false,
        };

        setTracks([newTrack]);
        setCurrentTrackIndex(0);
        setShowMeasures((prev) => ({ ...prev, [trackId]: false }));
        setShowCueThumbs((prev) => ({ ...prev, [trackId]: true }));
        setSelectedCueTrackId(trackId);
        setArmedLoopTrackIds(new Set());
        setZoomLevels((prev) => ({ ...prev, [trackId]: 1 }));
        setPlaybackSpeeds((prev) => ({ ...prev, [trackId]: 1 }));
        setVolume((prev) => ({ ...prev, [trackId]: lastUsedVolumeRef.current }));
        setExpandedControls((prev) => ({ ...prev, [trackId]: false }));
        setPlaybackTimes((prev) => ({ ...prev, [trackId]: 0 }));
        setPlaybackStates((prev) => ({ ...prev, [trackId]: false }));
        setLowpassFreqs((prev) => ({ ...prev, [trackId]: 20000 }));
        setHighpassFreqs((prev) => ({ ...prev, [trackId]: 20 }));
        setFilterEnabled((prev) => ({ ...prev, [trackId]: false }));

        // Creative metrics: sampler_ready + track_loaded (guest upload replaces)
        if (!hasEmittedSamplerReady.current) {
          trackEvent('sampler_ready', { trackId, userTier: 'guest' });
          hasEmittedSamplerReady.current = true;
        }
        trackEvent('track_loaded', { trackId, trackIndex: 0, source: 'upload', userTier: 'guest' });

        addingTrackIdRef.current = trackId; // Defer clearing placeholder until waveform is ready
        return;
      }

      // Create a new track
      const newTrack: Track = {
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file: file,
        buffer: buffer,
        peaks: extractPeaksFromBuffer(buffer),
        mode: trackType,
        chopTriggerStyle: trackType === 'cue' ? 'cue' : undefined,
        loopStart: 0,
        loopEnd: buffer.duration,
        cuePoints: [],
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        firstMeasureTime: 0,
        showMeasures: false
      };

      // Add the track to the beginning of the tracks array
      const isFirstTrack = tracks.length === 0;
      setTracks(prev => {
        const updatedTracks = [newTrack, ...prev];
        
        // If the new track is in preview mode and there's an existing preview track, change it to cue mode
        if (trackType === 'preview' && prev.length > 0 && prev[0].mode === 'preview') {
          updatedTracks[1] = { ...prev[0], mode: 'cue' };
        }
        
        return updatedTracks;
      });
      addingTrackIdRef.current = newTrack.id; // Defer clearing placeholder until waveform is ready

      // Creative metrics: sampler_ready (if first) + track_loaded + track_added
      if (isFirstTrack && !hasEmittedSamplerReady.current) {
        trackEvent('sampler_ready', { trackId: newTrack.id, userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
        hasEmittedSamplerReady.current = true;
      }
      trackEvent('track_loaded', { trackId: newTrack.id, trackIndex: 0, source: 'upload', userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
      trackEvent('track_added', { trackId: newTrack.id, trackIndex: 0, mode: trackType, source: 'upload', userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });

      // Initialize default values for the new track
      setPlaybackTimes(prev => ({ ...prev, [newTrack.id]: 0 }));
      setZoomLevels(prev => ({ ...prev, [newTrack.id]: 1 }));
      setPlaybackSpeeds(prev => ({ ...prev, [newTrack.id]: 1 }));
      setVolume(prev => ({ ...prev, [newTrack.id]: lastUsedVolumeRef.current }));
      setShowMeasures(prev => ({ ...prev, [newTrack.id]: false }));
      setShowCueThumbs(prev => ({ ...prev, [newTrack.id]: true }));
      setPlaybackStates(prev => ({ ...prev, [newTrack.id]: false }));
      setExpandedControls(prev => ({ ...prev, [newTrack.id]: false }));
      if (trackType === 'cue') setSelectedCueTrackId(newTrack.id);
      if (trackType === 'loop') setArmedLoopTrackIds(prev => new Set(prev).add(newTrack.id));
      
      // Initialize filter state
      setLowpassFreqs(prev => ({ ...prev, [newTrack.id]: 20000 }));
      setHighpassFreqs(prev => ({ ...prev, [newTrack.id]: 20 }));
      setFilterEnabled(prev => ({ ...prev, [newTrack.id]: false }));
      
    } catch (error) {
      console.error('Error uploading track:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload track');
      setLoadingTrackPlaceholder(null);
    } finally {
      setIsManuallyAddingTrack(false);
    }
  };

  const handleAddFromLibrary = async (asset: AudioAsset, trackType: 'preview' | 'loop' | 'cue' = 'cue') => {
    const placeholderId = `loading-${Date.now()}`;
    setLoadingTrackPlaceholder({ id: placeholderId, displayName: asset.name, mode: 'add' });
    try {
      setIsManuallyAddingTrack(true);
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
        const msg = error instanceof Error ? error.message : '';
        throw new Error(msg.includes('429') ? 'Too many requests. Please wait a moment and try again.' : 'Failed to access audio file. Please try again.');
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
      
      // Use track tempo from library metadata if valid, otherwise default to 120
      const trackTempo = asset.bpm != null && asset.bpm >= 40 && asset.bpm <= 300 ? asset.bpm : 120;

      // Create a new track
      const newTrack: Track = {
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sourceAssetId: asset.id,
        fileKey: asset.fileKey,
        file: file,
        buffer: buffer,
        mode: trackType,
        chopTriggerStyle: trackType === 'cue' ? 'cue' : undefined,
        loopStart: 0,
        loopEnd: buffer.duration,
        cuePoints: trackType === 'cue' ? Array.from({ length: 10 }, (_, i) => 
          buffer.duration * (i / 10)
        ) : [],
        tempo: trackTempo,
        timeSignature: { numerator: 4, denominator: 4 },
        firstMeasureTime: 0,
        showMeasures: false,
        key: asset.key,
        beats: asset.beats
      };

      // Add the track to the beginning of the tracks array
      const isFirstTrack = tracks.length === 0;
      setTracks(prev => {
        const updatedTracks = [newTrack, ...prev];
        
        // If the new track is in preview mode and there's an existing preview track, change it to cue mode
        if (trackType === 'preview' && prev.length > 0 && prev[0].mode === 'preview') {
          updatedTracks[1] = { ...prev[0], mode: 'cue' };
        }
        
        return updatedTracks;
      });
      addingTrackIdRef.current = newTrack.id; // Defer clearing placeholder until waveform is ready

      // Creative metrics: sampler_ready (if first) + track_loaded + track_added
      if (isFirstTrack && !hasEmittedSamplerReady.current) {
        trackEvent('sampler_ready', { trackId: newTrack.id, userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
        hasEmittedSamplerReady.current = true;
      }
      trackEvent('track_loaded', { trackId: newTrack.id, trackIndex: 0, source: 'library', userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
      trackEvent('track_added', { trackId: newTrack.id, trackIndex: 0, mode: trackType, source: 'library', userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });

      // Initialize default values for the new track
      setPlaybackTimes(prev => ({ ...prev, [newTrack.id]: 0 }));
      setZoomLevels(prev => ({ ...prev, [newTrack.id]: 1 }));
      setPlaybackSpeeds(prev => ({ ...prev, [newTrack.id]: 1 }));
      setVolume(prev => ({ ...prev, [newTrack.id]: lastUsedVolumeRef.current }));
      setShowMeasures(prev => ({ ...prev, [newTrack.id]: false }));
      setShowCueThumbs(prev => ({ ...prev, [newTrack.id]: true }));
      setPlaybackStates(prev => ({ ...prev, [newTrack.id]: false }));
      setExpandedControls(prev => ({ ...prev, [newTrack.id]: false }));
      if (trackType === 'cue') setSelectedCueTrackId(newTrack.id);
      if (trackType === 'loop') setArmedLoopTrackIds(prev => new Set(prev).add(newTrack.id));
      
      // Initialize filter state
      setLowpassFreqs(prev => ({ ...prev, [newTrack.id]: 20000 }));
      setHighpassFreqs(prev => ({ ...prev, [newTrack.id]: 20 }));
      setFilterEnabled(prev => ({ ...prev, [newTrack.id]: false }));
      
    } catch (error) {
      console.error('Error adding from library:', error);
      setError(error instanceof Error ? error.message : 'Failed to add track from library');
      setLoadingTrackPlaceholder(null);
    } finally {
      setIsManuallyAddingTrack(false);
    }
  };

  const handleUploadAnalysisUpdated = useCallback((uploadId: string, data: { bpm?: number; key?: string; beats?: number[] }) => {
    const { bpm, key, beats } = data;
    // Clear any pending timeout for this upload
    const timeoutId = analysisTimeoutIdsRef.current[uploadId];
    if (timeoutId) {
      clearTimeout(timeoutId);
      delete analysisTimeoutIdsRef.current[uploadId];
    }
    setTracks((prev) =>
      prev.map((t) =>
        t.sourceAssetId === uploadId
          ? {
              ...t,
              tempo: bpm != null && bpm >= 40 && bpm <= 300 ? bpm : t.tempo,
              key: key ?? t.key,
              beats: Array.isArray(beats) && beats.length > 0 ? beats : t.beats,
              isAnalyzing: false,
            }
          : t
      )
    );
  }, []);

  const handleAddUserTrack = async (userTrack: UserTrack, trackType: 'preview' | 'loop' | 'cue' = 'cue') => {
    if (!userTrack.file && !userTrack.fileKey) {
      setError('File or file key not available for this track');
      return;
    }

    const placeholderId = `loading-${Date.now()}`;
    addingTrackIdRef.current = null;
    setLoadingTrackPlaceholder({ id: placeholderId, displayName: userTrack.name, mode: 'add' });
    try {
      setIsManuallyAddingTrack(true);
      setError(null);
      
      // Use existing audio context if available
      let context = audioContext;
      if (!context) {
        context = await initializeAudio();
        setIsAudioInitialized(true);
      } else if (context.state === 'suspended') {
        await resumeAudioContext();
      }

      // Resolve file: use in-memory file if present, otherwise fetch from R2 via fileKey
      let file: File;
      if (userTrack.file) {
        file = userTrack.file;
      } else {
        const url = await getSignedUrl(userTrack.fileKey);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch recording: ${res.status}`);
        const blob = await res.blob();
        file = new File([blob], userTrack.name || 'recording.wav', { type: userTrack.type || 'audio/wav' });
      }

      // Load the audio buffer from the user track's file
      const buffer = await loadAudioBuffer(file, context);
      
      // Create a new track
      const isAnalyzing = userTrack.isAnalyzing ?? false;
      const newTrack: Track = {
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sourceAssetId: userTrack.id,
        fileKey: userTrack.fileKey,
        file,
        buffer: buffer,
        peaks: extractPeaksFromBuffer(buffer),
        mode: trackType,
        chopTriggerStyle: trackType === 'cue' ? 'cue' : undefined,
        loopStart: 0,
        loopEnd: buffer.duration,
        cuePoints: trackType === 'cue' ? Array.from({ length: 10 }, (_, i) => 
          buffer.duration * (i / 10)
        ) : [],
        tempo: userTrack.bpm != null && userTrack.bpm >= 40 && userTrack.bpm <= 300 ? userTrack.bpm : 120,
        timeSignature: { numerator: 4, denominator: 4 },
        firstMeasureTime: 0,
        showMeasures: false,
        key: userTrack.key,
        beats: userTrack.beats,
        isAnalyzing,
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

      // 60s timeout: clear isAnalyzing if analysis never completes
      if (isAnalyzing) {
        const uploadId = userTrack.id;
        const timeoutId = setTimeout(() => {
          setTracks((prev) =>
            prev.map((t) =>
              t.sourceAssetId === uploadId ? { ...t, isAnalyzing: false } : t
            )
          );
          delete analysisTimeoutIdsRef.current[uploadId];
        }, 60000);
        analysisTimeoutIdsRef.current[uploadId] = timeoutId;
      }
      
      // Initialize default values for the new track
      setPlaybackTimes(prev => ({ ...prev, [newTrack.id]: 0 }));
      setZoomLevels(prev => ({ ...prev, [newTrack.id]: 1 }));
      setPlaybackSpeeds(prev => ({ ...prev, [newTrack.id]: 1 }));
      setVolume(prev => ({ ...prev, [newTrack.id]: lastUsedVolumeRef.current }));
      setShowMeasures(prev => ({ ...prev, [newTrack.id]: false }));
      setShowCueThumbs(prev => ({ ...prev, [newTrack.id]: true }));
      setPlaybackStates(prev => ({ ...prev, [newTrack.id]: false }));
      setExpandedControls(prev => ({ ...prev, [newTrack.id]: false }));
      if (trackType === 'cue') setSelectedCueTrackId(newTrack.id);
      if (trackType === 'loop') setArmedLoopTrackIds(prev => new Set(prev).add(newTrack.id));
      
      // Initialize filter state
      setLowpassFreqs(prev => ({ ...prev, [newTrack.id]: 20000 }));
      setHighpassFreqs(prev => ({ ...prev, [newTrack.id]: 20 }));
      setFilterEnabled(prev => ({ ...prev, [newTrack.id]: false }));
      addingTrackIdRef.current = newTrack.id; // Defer clearing placeholder until waveform is ready
      
    } catch (error) {
      console.error('Error adding user track:', error);
      setError(error instanceof Error ? error.message : 'Failed to add user track');
      setLoadingTrackPlaceholder(null);
    } finally {
      setIsManuallyAddingTrack(false);
    }
  };


  const handleUserInteraction = useCallback(async () => {
    if (needsUserInteraction && audioContext) {
      try {
        await resumeAudioContext();
        setNeedsUserInteraction(false);
        // Retry loading the track after audio context is resumed
        if (isGuestMode && currentGuestTrack && tracks.length === 0) {
          loadRandomTrack();
        }
      } catch (error) {
        console.error('Failed to resume audio context:', error);
      }
    }
  }, [needsUserInteraction, audioContext, resumeAudioContext, isGuestMode, currentGuestTrack, tracks.length, loadRandomTrack]);

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

  const handleInitializeAudio = async (preferredMode?: 'loop' | 'cue') => {
    try {
      setNeedsUserInteraction(false);
      setIsInitializingAudio(true);
      setError(null);
      
      const context = await initializeAudio();
      setIsAudioInitialized(true);
      
      if (isGuestMode) {
        // For demo mode, use DemoProvider bundled tracks
        if (!currentGuestTrack) {
          // Load a bundled track first if none is loaded
          await loadRandomGuestTrack();
          if (!currentGuestTrack) {
            throw new Error('Failed to load bundled track. Please try again.');
          }
        }
        

        
        // Fetch the bundled track from DemoProvider
        const response = await fetch(currentGuestTrack.file);
        const blob = await response.blob();
        const file = new File([blob], `${currentGuestTrack.name}.${currentGuestTrack.type}`, { 
          type: `audio/${currentGuestTrack.type}` 
        });
        
        const buffer = await loadAudioBuffer(file, context);
        const trackId = currentGuestTrack.id;
        const mode: 'cue' | 'loop' = preferredMode ?? 'cue';
        
        const newTrack: Track = {
          id: trackId,
          file,
          buffer,
          peaks: extractPeaksFromBuffer(buffer),
          mode,
          chopTriggerStyle: mode === 'cue' ? 'cue' : undefined,
          loopStart: 0,
          loopEnd: buffer.duration,
          cuePoints: Array.from({ length: 10 }, (_, i) => 
            buffer.duration * (i / 10)
          ),
          tempo: currentGuestTrack.bpm || 120,
          timeSignature: { numerator: 4, denominator: 4 },
          firstMeasureTime: 0,
          showMeasures: false
        };
        
        setTracks([newTrack]);
        setCurrentTrackIndex(0);
        setShowMeasures(prev => ({ ...prev, [trackId]: false }));
        setShowCueThumbs(prev => ({ ...prev, [trackId]: mode === 'cue' }));
        setArmedLoopTrackIds(mode === 'loop' ? new Set([trackId]) : new Set());
        setZoomLevels(prev => ({ ...prev, [trackId]: 1 }));
        setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
        setVolume(prev => ({ ...prev, [trackId]: lastUsedVolumeRef.current }));
        setExpandedControls(prev => ({ ...prev, [trackId]: false }));
        if (mode === 'cue') setSelectedCueTrackId(trackId);
        
        // Track demo event
        trackGuestEvent('session_started', { 
          trackId: currentGuestTrack.id,
          timestamp: Date.now()
        });
        
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
        const msg = error instanceof Error ? error.message : '';
        throw new Error(msg.includes('429') ? 'Too many requests. Please wait a moment and try again.' : 'Failed to access audio file. Please try again.');
      }

      // Fetch the audio file using the signed URL
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const file = new File([blob], `${asset.name}.${asset.type}`, { type: `audio/${asset.type}` });
      
      const buffer = await loadAudioBuffer(file, context);
      const trackId = asset.id;
      const settings = loadTrackSettingsFromLocal(trackId) || {};
      const mode = preferredMode ?? settings.mode ?? loadPreferredMode() ?? 'cue';
      const chopStyle = (settings.chopTriggerStyle && ['cue', 'hold', 'one-shot'].includes(settings.chopTriggerStyle))
        ? settings.chopTriggerStyle
        : 'cue';
      const trackTempo = (asset.bpm != null && asset.bpm >= 40 && asset.bpm <= 300)
        ? asset.bpm
        : (settings.tempo || 120);
      const newTrack: Track = {
        id: trackId,
        sourceAssetId: asset.id,
        fileKey: asset.fileKey,
        file,
        buffer,
        peaks: extractPeaksFromBuffer(buffer),
        mode,
        chopTriggerStyle: mode === 'cue' ? chopStyle : undefined,
        loopStart: settings.loopStart || 0,
        loopEnd: settings.loopEnd || buffer.duration,
        cuePoints: settings.cuePoints || Array.from({ length: 10 }, (_, i) => 
          buffer.duration * (i / 10)
        ),
        tempo: trackTempo,
        timeSignature: settings.timeSignature || { numerator: 4, denominator: 4 },
        firstMeasureTime: settings.firstMeasureTime || 0,
        showMeasures: settings.showMeasures || false,
        key: asset.key,
        beats: asset.beats
      };
      
      setTracks([newTrack]);
      setCurrentTrackIndex(0);
      setShowMeasures(prev => ({ ...prev, [trackId]: !!settings.showMeasures }));
      setShowCueThumbs(prev => ({ ...prev, [trackId]: settings.showCueThumbs !== undefined ? !!settings.showCueThumbs : true }));
      setZoomLevels(prev => ({ ...prev, [trackId]: settings.zoomLevel || 1 }));
      setPlaybackSpeeds(prev => ({ ...prev, [trackId]: 1 }));
      const trackVolume = newTrack.mode === 'preview' 
        ? lastUsedVolumeRef.current 
        : (typeof settings.volume === 'number' ? settings.volume : lastUsedVolumeRef.current);
      setVolume(prev => ({ ...prev, [trackId]: trackVolume }));
      setExpandedControls(prev => ({ ...prev, [trackId]: false }));
      if (mode === 'cue') setSelectedCueTrackId(trackId);
      else if (mode === 'loop') setArmedLoopTrackIds(prev => new Set(prev).add(trackId));
      
      setIsInitializingAudio(false);
    } catch (error) {
      console.error('Error initializing audio:', error);
      const msg = error instanceof Error ? error.message : '';
      setError(msg.startsWith('Too many requests') ? msg : 'Failed to initialize audio. Please try again.');
      setNeedsUserInteraction(true);
      setIsInitializingAudio(false);
    }
  };

  const effectiveSuggestionReferenceTrackId =
    tracks.length > 0
      ? suggestionReferenceTrackId ?? selectedCueTrackId ?? tracks[0].id
      : null;

  const suggestionReferenceTrackOptions = useMemo(
    () =>
      tracks.map((t, i) => ({
        id: t.id,
        label: t.file?.name?.replace(/\.[^/.]+$/, '') || `Track ${i + 1}`,
      })),
    [tracks]
  );

  const referenceForSuggestions = useMemo((): SuggestionReference | null => {
    if (tracks.length === 0 || !effectiveSuggestionReferenceTrackId) return null;
    const t = tracks.find((tr) => tr.id === effectiveSuggestionReferenceTrackId) ?? tracks[0];
    if (t.isAnalyzing && !t.key?.trim()) return null;
    const speed = playbackSpeeds[t.id] ?? 1;
    const effectiveBpmRaw = t.tempo * speed;
    const bpm =
      effectiveBpmRaw >= 40 && effectiveBpmRaw <= 300
        ? Math.round(effectiveBpmRaw)
        : undefined;
    const key = t.key?.trim()
      ? (transposeKey(t.key, semitonesFromPlaybackSpeed(speed)) ?? undefined)
      : undefined;
    if (!key && bpm === undefined) return null;
    const ref: SuggestionReference = {
      excludeTrackId: t.sourceAssetId,
      excludeFileKey: t.fileKey,
      referencePlaybackSpeed: speed,
    };
    if (key) ref.key = key;
    if (bpm !== undefined) ref.bpm = bpm;
    return ref;
  }, [tracks, effectiveSuggestionReferenceTrackId, playbackSpeeds]);

  const handleSuggestionReferenceTrackChange = useCallback((trackId: string) => {
    setSuggestionReferenceTrackId(trackId);
  }, []);

  // Memoize the callback functions to prevent SidePanel re-mounting
  const memoizedSidePanelProps = useMemo(
    () => ({
      isOpen: isSidePanelOpen,
      onToggle: toggleSidePanel,
      onUploadTrack: handleUploadTrack,
      onAddFromLibrary: handleAddFromLibrary,
      onAddUserTrack: handleAddUserTrack,
      onUploadAnalysisUpdated: handleUploadAnalysisUpdated,
      onRestoreSession: handleRestoreSession,
      referenceForSuggestions,
      suggestionReferenceTrackOptions,
      effectiveSuggestionReferenceTrackId: effectiveSuggestionReferenceTrackId ?? undefined,
      onSuggestionReferenceTrackChange: handleSuggestionReferenceTrackChange,
    }),
    [
      isSidePanelOpen,
      toggleSidePanel,
      handleUploadTrack,
      handleAddFromLibrary,
      handleAddUserTrack,
      handleUploadAnalysisUpdated,
      handleRestoreSession,
      referenceForSuggestions,
      suggestionReferenceTrackOptions,
      effectiveSuggestionReferenceTrackId,
      handleSuggestionReferenceTrackChange,
    ]
  );

  
  // Loading state - only show full-page loader when NO tracks exist (initial load).
  // When adding a track mid-playback, we keep the studio mounted so playback continues.
  const showLoadingState = (isLoading || isTrackLoading || userLoading) && tracks.length === 0;

  // Single SidePanel instance - never unmounts when transitioning between states.
  // Preserves panel state (active tab, scroll position) when a track loads.
  const sidePanelEl = (user || isGuestMode) && <SidePanel {...memoizedSidePanelProps} />;

  return (
    <>
      {sidePanelEl}

      {/* Loading state */}
      {showLoadingState && (
        <>
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

          <HelpButton
            onStartTutorial={onboarding.startOnboarding}
            onShowHelp={() => setShowHelpModal(true)}
            hideTutorial={false}
          />
          <HelpModal
            isOpen={showHelpModal}
            onClose={() => setShowHelpModal(false)}
          />
        </>
      )}

      {/* Error state */}
      {error && !showLoadingState && (
        <>
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

          <HelpButton
            onStartTutorial={onboarding.startOnboarding}
            onShowHelp={() => setShowHelpModal(true)}
            hideTutorial={false}
          />
          <HelpModal
            isOpen={showHelpModal}
            onClose={() => setShowHelpModal(false)}
          />
        </>
      )}

      {/* Audio context needs user interaction state */}
      {needsUserInteraction && !showLoadingState && (
        <>
        
        {/* Verification UI - Show even during audio initialization if needed */}
        {showVerificationUI && (
          <div className="fixed inset-0 z-50 bg-audafact-surface-1 bg-opacity-95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-2xl w-full audafact-card-enhanced p-8 text-center">
              {/* Success Icon */}
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-audafact-accent-cyan to-audafact-accent-purple mb-4 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Main Content */}
              <h1 className="text-4xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-6 tracking-tight">
                Welcome to Audafact!
              </h1>
              
              <div className="max-w-xl mx-auto">
                <p className="text-lg text-slate-300 mb-6 leading-relaxed">
                  Your email has been verified successfully. You're now ready to start creating amazing music with Audafact Studio.
                </p>
                
                <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-slate-400">
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎵 Your tracks & available sounds</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🔄 Create seamless loops</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎯 Set custom cue points</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎛️ Real-time mixing</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">📤 Upload your samples</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎙️ Record performances</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">📚 Interactive tutorial</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleStartCreating}
                  disabled={isVerificationLoading}
                  className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isVerificationLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        Start Creating
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                </button>

                <button
                  onClick={handleStartDemo}
                  disabled={isVerificationLoading}
                  className="group relative inline-flex items-center justify-center px-8 py-4 bg-slate-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-slate-600 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isVerificationLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Start Tutorial
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        <HelpButton
          onStartTutorial={onboarding.startOnboarding}
          onShowHelp={() => setShowHelpModal(true)}
          hideTutorial={false}
        />
        <HelpModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
        />
        
        <div 
          className={`mx-auto p-4 lg:p-6 space-y-6 relative transition-all duration-300 ease-in-out ${
            (user || isGuestMode) && isSidePanelOpen 
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
                onClick={() => handleInitializeAudio()}
                className="audafact-button-primary"
                disabled={isInitializingAudio}
              >
                {isInitializingAudio ? 'Initializing...' : 'Initialize Audio & Load Track'}
              </button>
            </div>
          </div>
        </div>

 
        </>
      )}

      {/* No tracks state */}
      {tracks.length === 0 && !showLoadingState && !error && !needsUserInteraction && (
        <>
        {/* Verification UI - Show even when no tracks are loaded */}
        {showVerificationUI && (
          <div className="fixed inset-0 z-50 bg-audafact-surface-1 bg-opacity-95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-2xl w-full audafact-card-enhanced p-8 text-center">
              {/* Success Icon */}
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-audafact-accent-cyan to-audafact-accent-purple mb-4 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Main Content */}
              <h1 className="text-4xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-6 tracking-tight">
                Welcome to Audafact!
              </h1>
              
              <div className="max-w-xl mx-auto">
                <p className="text-lg text-slate-300 mb-6 leading-relaxed">
                  Your email has been verified successfully. You're now ready to start creating amazing music with Audafact Studio.
                </p>
                
                <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-slate-400">
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎵 Your tracks & available sounds</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🔄 Create seamless loops</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎯 Set custom cue points</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎛️ Real-time mixing</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">📤 Upload your samples</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎙️ Record performances</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">📚 Interactive tutorial</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleStartCreating}
                  disabled={isVerificationLoading}
                  className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isVerificationLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        Start Creating
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                </button>

                <button
                  onClick={handleStartDemo}
                  disabled={isVerificationLoading}
                  className="group relative inline-flex items-center justify-center px-8 py-4 bg-slate-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-slate-600 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isVerificationLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Start Tutorial
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div 
          className={`mx-auto p-4 lg:p-6 space-y-6 relative transition-all duration-300 ease-in-out ${
            (user || isGuestMode) && isSidePanelOpen 
              ? 'lg:ml-[400px] lg:max-w-[calc(100vw-400px)] lg:bg-audafact-surface-2 lg:bg-opacity-30' 
              : 'max-w-6xl'
          }`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Full-page drag and drop overlay - covers entire viewport when SidePanel is closed */}
          {(user || isGuestMode) && !isSidePanelOpen && isDragOver && (
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          )}
          
          {/* Full-screen drag and drop overlay - only active when dragging and SidePanel is open */}
          {(user || isGuestMode) && isDragOver && isSidePanelOpen && (
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
            <div className={`fixed z-50 pointer-events-none flex items-center justify-center top-0 bottom-0 ${
              (user || isGuestMode) && isSidePanelOpen
                ? 'inset-0 lg:left-[400px]'
                : 'inset-0'
            }`}>
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
            {/* Static track skeleton - initial load interface */}
            <div
              key="static-track-skeleton"
              className="audafact-card overflow-hidden transition-all duration-300 relative border-audafact-accent-cyan shadow-card"
              style={{ transform: 'translateY(0)' }}
            >
              <div className="flex items-center justify-between bg-audafact-surface-2 border-b border-audafact-divider py-1 px-2">
                <div className="w-10 h-10" />
                <div className="w-10 h-10" />
                <div className="w-10 h-10" />
              </div>
              <div className="p-4 border-b border-audafact-divider bg-audafact-surface-1">
                <h3 className="font-medium audafact-heading">Drop a track. Find something new. Start creating.</h3>
                <p className="text-sm text-audafact-text-secondary mt-1">See what Audafact uncovers in every song.</p>
              </div>
              <div className="audafact-waveform-bg relative flex flex-col items-center justify-center gap-4 py-6 px-4" style={{ minHeight: '160px' }}>
                {getStartedStep === null && (
                  <>
                    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-sm text-audafact-text-secondary">I&apos;ve used this before?</span>
                        <button
                          onClick={() => handleInitializeAudio()}
                          className="group relative inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none w-full sm:w-auto"
                          disabled={(user ? isInitializingAudio || availableAssets.length === 0 : isInitializingAudio || isGuestLoading)}
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            {(user ? isInitializingAudio : isInitializingAudio || isGuestLoading) ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Loading...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                Start digging
                              </>
                            )}
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        </button>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-sm text-audafact-text-secondary">First time here?</span>
                        <button
                          onClick={() => setGetStartedStep('mode-choice')}
                          disabled={user ? availableAssets.length === 0 : isGuestLoading}
                          className="group relative inline-flex items-center justify-center px-6 py-3 bg-slate-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-slate-500 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none w-full sm:w-auto"
                        >
                          <span className="relative z-10 flex items-center gap-2">Get started</span>
                        </button>
                      </div>
                    </div>
                    {user && (() => {
                      const savedState = loadStudioStateFromLocal();
                      const hasSavedSession = savedState?.tracks?.length > 0;
                      if (!hasSavedSession) return null;
                      return (
                        <button
                          onClick={async () => {
                            try {
                              setIsInitializingAudio(true);
                              const restored = await restoreStudioStateFromLocal();
                              if (restored) {
                                hasLoadedTrack.current = true;
                                setIsInitializingAudio(false);
                                return;
                              }
                            } catch {
                              // Fall back to random track
                            }
                            handleInitializeAudio();
                          }}
                          className="group relative inline-flex items-center justify-center px-6 py-3 bg-slate-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-slate-500 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                          disabled={isInitializingAudio}
                        >
                          <span className="relative z-10 flex items-center gap-2">
                            {isInitializingAudio ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Loading...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Restore previous session
                              </>
                            )}
                          </span>
                        </button>
                      );
                    })()}
                  </>
                )}

                {getStartedStep === 'mode-choice' && (
                  <div className="w-full max-w-md space-y-4">
                    <p className="text-sm text-audafact-text-secondary text-center">
                      Find it. Dig it. Chop it. Loop it. Build something in seconds.
                    </p>
                    {isGuestMode && (
                      <p className="text-xs text-audafact-text-secondary text-center -mt-2">
                        Start digging loads chop/cue by default; choose loop/chop below anytime.
                      </p>
                    )}
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          savePreferredMode('loop');
                          setGetStartedStep(null);
                          handleInitializeAudio('loop');
                        }}
                        disabled={user ? isInitializingAudio || availableAssets.length === 0 : isInitializingAudio || isGuestLoading}
                        className="w-full text-left p-4 rounded-lg border border-audafact-divider bg-audafact-surface-2 hover:border-audafact-accent-cyan hover:bg-audafact-surface-2/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <h3 className="font-medium text-audafact-heading mb-1">Lock in a loop</h3>
                        <p className="text-sm text-audafact-text-secondary">
                          Set start and end on the waveform. Hit space to play.
                        </p>
                      </button>
                      <button
                        onClick={() => {
                          savePreferredMode('cue');
                          setGetStartedStep(null);
                          handleInitializeAudio('cue');
                        }}
                        disabled={user ? isInitializingAudio || availableAssets.length === 0 : isInitializingAudio || isGuestLoading}
                        className="w-full text-left p-4 rounded-lg border border-audafact-divider bg-audafact-surface-2 hover:border-audafact-accent-cyan hover:bg-audafact-surface-2/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <h3 className="font-medium text-audafact-heading mb-1">Play your samples</h3>
                        <p className="text-sm text-audafact-text-secondary">
                          Instant cue points. Trigger with keys 1–0, drag nodes to reshape.
                        </p>
                      </button>
                    </div>
                    <button
                      onClick={() => setGetStartedStep(null)}
                      className="text-sm text-audafact-text-secondary hover:text-audafact-text-primary transition-colors"
                    >
                      Back
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4 bg-audafact-surface-1">
                <div className="h-10 bg-audafact-surface-2 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Help Button - show with skeleton UI so users can access help before track loads */}
        <HelpButton
          onStartTutorial={onboarding.startOnboarding}
          onShowHelp={() => setShowHelpModal(true)}
          hideTutorial={false}
        />
        <HelpModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
        />
        </>
      )}

      {/* Main content - has tracks */}
      {tracks.length > 0 && !showLoadingState && !error && !needsUserInteraction && (
        <>
      {/* Demo Mode Indicator */}
      {shouldShowDemoIndicator && <DemoModeIndicator />}
      
      {/* Verification UI - Show when user has just verified their email */}
      {showVerificationUI && (
        <div className="fixed inset-0 z-50 bg-audafact-surface-1 bg-opacity-95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full audafact-card-enhanced p-8 text-center">
            {/* Success Icon */}
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-audafact-accent-cyan to-audafact-accent-purple mb-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Main Content */}
            <h1 className="text-4xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-6 tracking-tight">
              Welcome to Audafact!
            </h1>
            
            <div className="max-w-xl mx-auto">
              <p className="text-lg text-slate-300 mb-6 leading-relaxed">
                Your email has been verified successfully. You're now ready to start creating amazing music with Audafact Studio.
              </p>
              
              <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-slate-400">
                <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎵 Your tracks & available sounds</span>
                <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🔄 Create seamless loops</span>
                <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎯 Set custom cue points</span>
                <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎛️ Real-time mixing</span>
                <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">📤 Upload your samples</span>
                <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎙️ Record performances</span>
                <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">📚 Interactive tutorial</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleStartCreating}
                className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Start Creating
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </button>

              <button
                onClick={handleStartDemo}
                className="group relative inline-flex items-center justify-center px-8 py-4 bg-slate-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-slate-600 hover:border-slate-500"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Tutorial
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div 
        className={`mx-auto p-4 lg:p-6 space-y-6 relative transition-all duration-300 ease-in-out ${
          (user || isGuestMode) && isSidePanelOpen 
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
        {/* {isGuestMode && <DemoTrackInfo track={currentGuestTrack} />} */}
        {/* Full-page drag and drop overlay - covers entire viewport when SidePanel is closed */}
        {(user || isGuestMode) && !isSidePanelOpen && isDragOver && (
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        )}
        
        {/* Full-screen drag and drop overlay - only active when dragging and SidePanel is open */}
        {(user || isGuestMode) && isDragOver && isSidePanelOpen && (
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
          <div className={`fixed z-50 pointer-events-none flex items-center justify-center top-0 bottom-0 ${
            (user || isGuestMode) && isSidePanelOpen
              ? 'inset-0 lg:left-[400px]'
              : 'inset-0'
          }`}>
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

        {/* Global Controls: Save, Record, keyboard indicators */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <RecordingControls
            className="w-auto shrink-0"
            onSave={handleSaveCurrentState}
            audioContext={audioContext || undefined}
          />
          <span className="text-audafact-text-secondary text-xs border-l border-audafact-divider pl-4">
            {(() => {
              if (armedLoopTrackIds.size === 0) return 'Space: Arm loop tracks to enable';
              const nums = [...armedLoopTrackIds]
                .map(id => tracks.findIndex(t => t.id === id) + 1)
                .filter(n => n > 0)
                .sort((a, b) => a - b);
              if (nums.length === 0) return 'Space: Arm loop tracks to enable';
              const label = nums.length === 1
                ? `Track ${nums[0]}`
                : nums.length === 2
                  ? `Track ${nums[0]} & ${nums[1]}`
                  : `Track ${nums.slice(0, -1).join(', ')} & ${nums[nums.length - 1]}`;
              return `Space: Play/Pause ${label} loop${nums.length === 1 ? '' : 's'}`;
            })()}
          </span>
          <span className="text-audafact-text-secondary text-xs border-l border-audafact-divider pl-4">
            {selectedCueTrackId
              ? (() => {
                  const idx = tracks.findIndex(t => t.id === selectedCueTrackId);
                  if (idx < 0) return '1-0: Trigger Chop track cue points';
                  return `1-0: Trigger Track ${idx + 1} cue points`;
                })()
              : tracks.some(t => t.mode === 'cue')
                ? '1-0: Select Chop track to trigger cues'
                : '1-0: Switch to Chop mode to trigger cues'}
          </span>
        </div>

        {/* Track skeleton - shown while waveforms load to prevent flicker */}
        {showTrackSkeletons && tracksToRender.map((track, idx) => (
          <div
            key={`skeleton-${track.id}`}
            className="audafact-card overflow-hidden transition-all duration-300 relative border-audafact-divider shadow-sm"
            style={{ transform: idx > 0 ? 'translateY(10px)' : 'translateY(0)' }}
          >
            <div className="flex items-center justify-between bg-audafact-surface-2 border-b border-audafact-divider py-1 px-2">
              <div className="w-10 h-10" />
              <div className="flex items-center gap-2 text-audafact-text-secondary">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-audafact-accent-cyan" />
                <span className="text-xs">Loading...</span>
              </div>
              <div className="w-10 h-10" />
            </div>
            <div className="p-4 border-b border-audafact-divider bg-audafact-surface-1">
              <div className="flex items-center gap-3">
                <div className="h-5 w-48 bg-audafact-surface-2 rounded animate-pulse" />
              </div>
            </div>
            <div className="audafact-waveform-bg relative flex items-center justify-center" style={{ height: '120px' }}>
              <div className="flex items-end gap-1 h-12" aria-hidden>
                {[...Array(24)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-audafact-accent-cyan/30 rounded-sm animate-pulse"
                    style={{ height: `${20 + Math.sin(i * 0.5) * 30}%`, animationDelay: `${i * 50}ms` }}
                  />
                ))}
              </div>
            </div>
            <div className="p-4 bg-audafact-surface-1">
              <div className="h-10 bg-audafact-surface-2 rounded animate-pulse" />
            </div>
          </div>
        ))}

        {/* Add-track skeleton - shows immediately when add action triggered, before track data loads */}
        {loadingTrackPlaceholder?.mode === 'add' && (addingTrackIdRef.current === null || tracks[0]?.id !== addingTrackIdRef.current) && (
          <div
            key="add-track-skeleton"
            className="audafact-card overflow-hidden transition-all duration-300 relative border-audafact-accent-cyan shadow-card"
            style={{ transform: 'translateY(0)' }}
          >
            <div className="flex items-center justify-between bg-audafact-surface-2 border-b border-audafact-divider py-1 px-2">
              <div className="w-10 h-10" />
              <div className="w-10 h-10" />
              <div className="w-10 h-10" />
            </div>
            <div className="p-4 border-b border-audafact-divider bg-audafact-surface-1">
              <h3 className="font-medium audafact-heading truncate">{loadingTrackPlaceholder.displayName}</h3>
              <p className="text-xs audafact-text-secondary flex items-center gap-2 mt-1">
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-audafact-accent-cyan" />
                Loading waveform...
              </p>
            </div>
            <div className="audafact-waveform-bg relative flex items-center justify-center" style={{ height: '120px' }}>
              <div className="flex items-end gap-1 h-12" aria-hidden>
                {[...Array(24)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-audafact-accent-cyan/30 rounded-sm animate-pulse"
                    style={{ height: `${20 + Math.sin(i * 0.5) * 30}%`, animationDelay: `${i * 50}ms` }}
                  />
                ))}
              </div>
            </div>
            <div className="p-4 bg-audafact-surface-1">
              <div className="h-10 bg-audafact-surface-2 rounded animate-pulse" />
            </div>
          </div>
        )}

        {/* Render all tracks - first track shows skeleton overlay on waveform until loaded when adding/replacing
            Tracks are rendered but hidden while waveforms load (skeleton shown above) to avoid flicker */}
        <div
          className={showTrackSkeletons ? 'fixed -left-[9999px] top-0 w-full opacity-0 pointer-events-none' : undefined}
          aria-hidden={showTrackSkeletons}
        >
        {tracks.map((track, index) => {
          const isSuggestionRef = track.id === effectiveSuggestionReferenceTrackId;
          return (
          <div
            key={track.id}
            onClick={tracks.length > 1 ? (e) => {
              if ((e.target as HTMLElement).closest?.('button, input, select, a, [role=button], [role=slider], .audafact-waveform-bg')) return;
              setSuggestionReferenceTrackId(track.id);
            } : undefined}
            className={`audafact-card overflow-hidden transition-all duration-300 relative ${
              isSuggestionRef
                ? 'border-audafact-accent-cyan shadow-card' // Suggestion reference track
                : 'border-audafact-divider shadow-sm'
            } ${isDragOver ? 'ring-2 ring-audafact-accent-cyan ring-opacity-50' : ''} ${tracks.length > 1 ? 'cursor-pointer' : ''}`}
            style={{
              transform: (loadingTrackPlaceholder || (isAddingTrack && index > 0)) ? 'translateY(10px)' : 'translateY(0)'
            }}
            data-testid={index === 0 ? 'main-track-card' : `track-card-${index}`}
            title={tracks.length > 1 ? (isSuggestionRef ? 'Suggestions match this track — click another to match to it' : 'Click to match suggestions to this track') : undefined}
          >
            {/* Add Track and Navigation Controls - Only show on first track */}
            {index === 0 && (
              <div 
                className="relative flex justify-center items-center py-1 px-2 bg-audafact-surface-2 border-b border-audafact-divider min-h-[44px]"
                style={{ touchAction: 'pan-y pinch-zoom' }}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                data-testid="track-loader-bar"
              >
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-audafact-text-secondary">
                  <span className="sm:hidden">Switch/add</span>
                  <span className="hidden sm:inline">Switch & add tracks</span>
                </span>
                <div
                  className="flex items-center w-full max-w-2xl mx-auto"
                  style={{ justifyContent: 'space-evenly', transform: 'translateX(16px)' }}
                >
                  <Tooltip content="Go to previous track" position="top" delay={150}>
                    <button
                      onClick={handlePreviousTrack}
                      disabled={isTrackLoading}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                        isTrackLoading
                          ? 'text-audafact-text-secondary cursor-not-allowed'
                          : 'text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-1 shadow-sm'
                      }`}
                      data-testid="previous-track-button"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span className="text-[10px] mt-0.5">Prev</span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={
                      isGuestMode
                        ? tracks.length >= 1
                          ? 'Sign up to add more tracks'
                          : 'Add track (demo mode)'
                        : canAddTrack
                          ? 'Add a new track'
                          : 'Add track (change mode first)'
                    }
                    position="top"
                    delay={150}
                  >
                    <span>
                      <button
                        onClick={addNewTrack}
                        disabled={
                          isAddingTrack ||
                          isTrackLoading ||
                          (isGuestMode ? false : !canAddTrack)
                        }
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                          isAddingTrack ||
                          isTrackLoading ||
                          (!isGuestMode && !canAddTrack)
                            ? 'text-audafact-text-secondary cursor-not-allowed'
                            : 'text-audafact-accent-cyan hover:text-audafact-accent-cyan hover:bg-audafact-surface-1 shadow-sm'
                        } ${addTrackAnimation ? 'animate-pulse' : ''}`}
                        data-testid="add-track-button"
                      >
                        {isAddingTrack ? (
                          <span className="text-xs">Adding...</span>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-[10px] mt-0.5">Add</span>
                          </>
                        )}
                      </button>
                    </span>
                  </Tooltip>
                  <Tooltip content="Go to next track" position="top" delay={150}>
                    <button
                      onClick={handleNextTrack}
                      disabled={isTrackLoading}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                        isTrackLoading
                          ? 'text-audafact-text-secondary cursor-not-allowed'
                          : 'text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-1 shadow-sm'
                      }`}
                      data-testid="next-track-button"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-[10px] mt-0.5">Next</span>
                    </button>
                  </Tooltip>
                </div>
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
                {/* Row 2: Song name (truncated) + mode + key & BPM */}
                <div className="min-w-0">
                  <h3 className="font-medium audafact-heading truncate">
                    {track.file.name}
                  </h3>
                  <p className="text-xs audafact-text-secondary truncate flex items-center gap-2 flex-wrap">
                    {loadingTrackPlaceholder && index === 0 && !waveformReadyTrackIds.has(track.id) ? (
                      <span className="flex items-center gap-1">
                        <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-audafact-accent-cyan" />
                        Loading waveform...
                      </span>
                    ) : (
                      <>
                        {track.mode === 'preview' ? 'Preview Mode' : track.mode === 'loop' ? 'Loop Mode' : 'Cue Mode'}
                        {track.isAnalyzing && !track.key ? (
                          <> • <span className="text-audafact-accent-cyan">Analyzing...</span></>
                        ) : (
                          <>
                            {track.key && <> • {transposeKey(track.key, semitonesFromPlaybackSpeed(playbackSpeeds[track.id] || 1))}</>}
                            {' • '}
                            {Math.round(track.tempo * (playbackSpeeds[track.id] || 1))} BPM
                          </>
                        )}
                      </>
                    )}
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
                        (showCueThumbs[track.id] ?? true)
                          ? 'bg-audafact-alert-red text-audafact-text-primary'
                          : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                      }`}
                      title={(showCueThumbs[track.id] ?? true) ? 'Hide Cue Points' : 'Show Cue Points'}
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
                  {track.mode === 'loop' && (
                    <button
                      onClick={() => handleLoopArmToggle(track.id)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                        armedLoopTrackIds.has(track.id)
                          ? 'bg-audafact-accent-cyan text-audafact-text-primary'
                          : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                      }`}
                      title={armedLoopTrackIds.has(track.id) ? 'Armed for Space — Disarm to remove from Space control' : 'Arm — add to Space control'}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Arm</span>
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
                    <p className="text-sm audafact-text-secondary flex items-center gap-2 flex-wrap">
                      {loadingTrackPlaceholder && index === 0 && !waveformReadyTrackIds.has(track.id) ? (
                        <span className="flex items-center gap-1">
                          <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-audafact-accent-cyan" />
                          Loading waveform...
                        </span>
                    ) : (
                      <>
                        {track.mode === 'preview' ? 'Preview Mode' : track.mode === 'loop' ? 'Loop Mode' : 'Cue Mode'}
                        {track.isAnalyzing && !track.key ? (
                          <> • <span className="text-audafact-accent-cyan">Analyzing...</span></>
                        ) : (
                          <>
                            {track.key && <> • {transposeKey(track.key, semitonesFromPlaybackSpeed(playbackSpeeds[track.id] || 1))}</>}
                            {' • '}
                            {Math.round(track.tempo * (playbackSpeeds[track.id] || 1))} BPM
                          </>
                        )}
                      </>
                    )}
                      <div className="flex items-end gap-2">
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
                              (showCueThumbs[track.id] ?? true)
                                ? 'bg-audafact-alert-red text-audafact-text-primary'
                                : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                            }`}
                            title={(showCueThumbs[track.id] ?? true) ? 'Hide Cue Points' : 'Show Cue Points'}
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

                        {/* Loop Arm Indicator */}
                        {track.mode === 'loop' && (
                          <button
                            onClick={() => handleLoopArmToggle(track.id)}
                            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                              armedLoopTrackIds.has(track.id)
                                ? 'bg-audafact-accent-cyan text-audafact-bg-primary'
                                : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                            }`}
                            title={armedLoopTrackIds.has(track.id) ? 'Armed for Space — Disarm to remove from Space control' : 'Arm — add to Space control'}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>Arm</span>
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
                    </p>
                  </div>
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
              {loadingTrackPlaceholder && index === 0 && !waveformReadyTrackIds.has(track.id) && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-audafact-waveform-bg" aria-hidden>
                  <div className="flex items-end gap-1 h-12" aria-hidden>
                    {[...Array(24)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-audafact-accent-cyan/30 rounded-sm animate-pulse"
                        style={{ height: `${20 + Math.sin(i * 0.5) * 30}%`, animationDelay: `${i * 50}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <WaveformDisplay
                audioFile={track.file}
                peaks={track.peaks}
                duration={track.peaks ? track.buffer.duration : undefined}
                mode={track.mode}
                loopStart={track.loopStart}
                loopEnd={track.loopEnd}
                cuePoints={track.cuePoints}
                onLoopPointsChange={(start, end) => handleLoopPointsChange(track.id, start, end)}
                onLoopDragStateChange={(start, end) => handleLoopDragStateChange(track.id, start, end)}
                onCuePointChange={(index, time) => handleCuePointChange(track.id, index, time)}
                playhead={track.mode === 'loop' ? loopPlayhead : samplePlayhead}
                playbackTime={playbackTimes[track.id] || 0}
                zoomLevel={zoomLevels[track.id] || 1}
                onZoomIn={() => handleZoomIn(track.id)}
                onZoomOut={() => handleZoomOut(track.id)}
                onResetZoom={() => handleResetZoom(track.id)}
                onZoomChange={(level) => handleZoomChange(track.id, level)}
                trackId={track.id}
                showMeasures={showMeasures[track.id]}
                tempo={track.tempo}
                timeSignature={track.timeSignature}
                firstMeasureTime={track.firstMeasureTime}
                onFirstMeasureChange={(time) => handleFirstMeasureChange(track.id, time)}
                showCueThumbs={(showCueThumbs[track.id] ?? true)}
                isPlaying={playbackStates[track.id] || false}
                onPlayheadChange={(time) => handlePlayheadChange(track.id, time)}
                onScrollStateChange={(isScrolling) => handleWaveformScrollStateChange(track.id, isScrolling)}
                isGuestMode={isGuestMode}
                chopTriggerStyle={track.chopTriggerStyle ?? 'cue'}
                onCueDragStateChange={(index, time) => handleCueDragStateChange(track.id, index, time)}
                onReady={() => handleWaveformReady(track.id)}
                suppressLoadingOverlay={!!(loadingTrackPlaceholder && index === 0 && !waveformReadyTrackIds.has(track.id))}
                beats={track.beats}
                cueDragTime={cueDragStates[track.id] ? (Object.values(cueDragStates[track.id])[0] ?? null) : null}
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
                loopDragState={loopDragStates[track.id] || null}
                cuePoints={track.cuePoints}
                ensureAudio={ensureAudioBeforeAction}
                primeIosSessionForWebAudio={primeIosSessionForWebAudio}
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
                togglePlaybackFunctionRef={getTogglePlaybackRef(track.id)}
                recordingDestination={isRecordingPerformance ? getRecordingDestination() : null}
                cueDragState={cueDragStates[track.id] || null}
                chopTriggerStyle={track.chopTriggerStyle ?? 'cue'}
              />

              {track.mode === 'cue' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs audafact-text-secondary">Trigger style:</span>
                  <div className="flex rounded-md border border-audafact-divider p-0.5 bg-audafact-surface-2">
                    {(['cue', 'hold', 'one-shot'] as const).map((style) => {
                      const locked = style !== 'cue' && tier.id === 'guest';
                      return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => handleChopTriggerStyleChange(track.id, style)}
                        title={
                          locked
                            ? 'Sign up to unlock Hold and One-Shot modes'
                            : style === 'cue'
                              ? 'Jump to cue and continue'
                              : style === 'hold'
                                ? 'Play while held'
                                : 'Play slice once'
                        }
                        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                          (track.chopTriggerStyle ?? 'cue') === style
                            ? 'bg-audafact-alert-red text-audafact-text-primary shadow-sm'
                            : locked
                              ? 'text-audafact-text-secondary opacity-50 hover:opacity-80'
                              : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                        }`}
                      >
                        {style === 'one-shot' ? 'One-Shot' : style.charAt(0).toUpperCase() + style.slice(1)}
                        {locked ? ' 🔒' : ''}
                      </button>
                    )})}
                  </div>
                </div>
              )}
              {track.mode === 'cue' && track.id === selectedCueTrackId && (
                <div className="mt-3 bg-audafact-accent-blue bg-opacity-10 p-2 rounded text-audafact-accent-blue text-xs">
                  Press keyboard keys 1-0 to trigger cue points
                </div>
              )}
              {track.mode === 'loop' && armedLoopTrackIds.has(track.id) && (
                <div className="mt-3 bg-audafact-accent-cyan bg-opacity-10 p-2 rounded text-audafact-accent-cyan text-xs">
                  Armed — Space controls playback
                </div>
              )}
            </div>
          </div>
          );
        })}
        </div>
      </div>

      {/* Signup Modal */}
      {showEarlyCreatorModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-xl audafact-card-enhanced p-6">
            <h2 className="text-2xl font-bold audafact-heading mb-3">
              You&apos;ve been given Pro access as an early creator
            </h2>
            <p className="audafact-text-secondary mb-4">
              You&apos;re part of a small group helping shape where Audafact goes next.
            </p>
            <div className="rounded-lg bg-audafact-surface-2 p-4 mb-6">
              <p className="text-sm font-semibold audafact-heading mb-2">Try one of these now:</p>
              <ul className="text-sm audafact-text-secondary space-y-1">
                <li>- Chop one library track and test trigger styles</li>
                <li>- Record a short performance and export it</li>
                <li>- Share one piece of honest feedback after your session</li>
              </ul>
            </div>
            <div className="flex justify-end">
              <button type="button" className="audafact-button-primary" onClick={closeEarlyCreatorModal}>
                Let&apos;s create
              </button>
            </div>
          </div>
        </div>
      )}

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
        hideTutorial={false}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
        </>
      )}
    </>
  );
};

export default Studio; 