import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import MeasureDisplay from './MeasureDisplay';
import GridLines from './GridLines';
import { TimeSignature } from '../types/music';
import { showSignupModal } from '../hooks/useSignupModal';

const PINCH_ZOOM_CONFIG = {
  enabled: true,
  mode: 'discrete' as 'discrete' | 'continuous',
  throttleMs: 70,
  maxDeltaPerTick: 0.35,
  discreteThreshold: 70,
  discreteCooldownMs: 120,
};
const WAVEFORM_DEBUG_LOGS = false;

interface WaveformDisplayProps {
  audioFile: File;
  mode: 'preview' | 'loop' | 'cue';
  loopStart: number;
  loopEnd: number;
  cuePoints: number[];
  onLoopPointsChange: (start: number, end: number) => void;
  onCuePointChange: (index: number, time: number) => void;
  playhead?: number;
  playbackTime?: number;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  /** Optional: smooth pinch zoom callback (staged via PINCH_ZOOM_CONFIG in this component). */
  onZoomChange?: (level: number) => void;
  trackId?: string;
  // Measure display props
  showMeasures?: boolean;
  tempo?: number;
  timeSignature?: TimeSignature;
  firstMeasureTime?: number;
  onFirstMeasureChange?: (time: number) => void;
  // Cue thumb props
  showCueThumbs?: boolean;
  // Playback control
  isPlaying?: boolean;
  // Playhead position change callback
  onPlayheadChange?: (time: number) => void;
  // Scroll state callback
  onScrollStateChange?: (isScrolling: boolean) => void;
  // Demo mode
  isGuestMode?: boolean;
  /** When 'one-shot', invalid trigger nodes (past next node) are shown greyed on the waveform */
  chopTriggerStyle?: 'cue' | 'hold' | 'one-shot';
  // Drag state callback for real-time timestamp updates
  onCueDragStateChange?: (index: number, time: number | null) => void;
  /** Loop drag state: (start, end) when dragging, (null, null) when drag ends */
  onLoopDragStateChange?: (start: number | null, end: number | null) => void;
  // Called when waveform has finished loading and is ready for display
  onReady?: () => void;
  // When true, hide the internal loading overlay (parent provides its own, e.g. skeleton)
  suppressLoadingOverlay?: boolean;
  /** Pre-decoded peaks - skips WaveSurfer decode for faster load */
  peaks?: number[][];
  /** Duration in seconds - required when peaks provided */
  duration?: number;
  /** Beat positions in seconds for adaptive grid (from audio analysis) */
  beats?: number[];
  /** Current cue drag time for nearest-beat highlight (null when not dragging) */
  cueDragTime?: number | null;
}

const WaveformDisplay = ({
  audioFile,
  mode,
  playhead: _playhead, // Not used: we use playbackTime as single source of truth
  loopStart,
  loopEnd,
  cuePoints,
  onLoopPointsChange,
  onCuePointChange,
  playbackTime = 0,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onZoomChange,
  trackId,
  // Measure display props
  showMeasures = false,
  tempo = 120,
  timeSignature = { numerator: 4, denominator: 4 },
  firstMeasureTime = 0,
  onFirstMeasureChange,
  // Cue thumb props
  showCueThumbs = true,
  // Playback control
  isPlaying = false,
  // Playhead position change callback
  onPlayheadChange,
  // Scroll state callback
  onScrollStateChange,
  // Demo mode
  isGuestMode = false,
  chopTriggerStyle,
  // Drag state callback for real-time timestamp updates
  onCueDragStateChange,
  onLoopDragStateChange,
  onReady,
  suppressLoadingOverlay = false,
  peaks: peaksProp,
  duration: durationProp,
  beats,
  cueDragTime,
}: WaveformDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [internalShowMeasures, setInternalShowMeasures] = useState(false);
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs to track regions and prevent recreation
  const regionsPluginRef = useRef<any>(null);
  const currentRegionsRef = useRef<any[]>([]);
  const lastUpdateTimeRef = useRef<number>(0);
  const initialSetupDoneRef = useRef<boolean>(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const oneXRetryTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const zoomChangeRetryTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const zoomLevelRef = useRef<number>(zoomLevel);
  const zoomRenderedHandlerRef = useRef<(() => void) | null>(null);
  const widthSyncTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const widthSyncGenerationRef = useRef<number>(0);
  const regionOpSeqRef = useRef<number>(0);
  
  // Track previous values to detect changes
  const prevLoopStartRef = useRef<number>(loopStart);
  const prevLoopEndRef = useRef<number>(loopEnd);
  const prevCuePointsRef = useRef<number[]>(cuePoints);
  const prevModeRef = useRef<string>(mode);
  /** Latest mode for comparing with effect closures (debug + stale-handler checks). */
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const prevChopTriggerStyleRef = useRef<string | undefined>(chopTriggerStyle);
  const prevPlaybackTimeRef = useRef<number>(playbackTime);
  
  // Ref to track current cuePoints value for use in createRegions callback
  // This avoids stale closure issues when cuePoints values change but length doesn't
  const currentCuePointsRef = useRef<number[]>(cuePoints);
  
  // Flag to track when we're updating cue points internally (from drag operations)
  // This prevents the effect from recreating regions when the change originates from our own drag
  const isInternalCueUpdateRef = useRef<boolean>(false);
  // Flag to track when loop region is being dragged/resized - skip recreation during active drag
  const isInternalLoopUpdateRef = useRef<boolean>(false);

  const onLoopPointsChangeRef = useRef(onLoopPointsChange);
  const onLoopDragStateChangeRef = useRef(onLoopDragStateChange);
  const onCuePointChangeRef = useRef(onCuePointChange);
  const lastLoopDragUpdateRef = useRef(0);
  const lastLoopTrackUpdateRef = useRef(0);
  const lastSentLoopStartRef = useRef<number | undefined>(undefined);
  const lastSentLoopEndRef = useRef<number | undefined>(undefined);
  const onReadyRef = useRef(onReady);
  const onReadyCalledRef = useRef(false);
  const pinchLastStepAtRef = useRef<number>(0);

  const debugLog = useCallback((label: string, details?: unknown) => {
    if (!WAVEFORM_DEBUG_LOGS) return;
    if (details !== undefined) {
      console.debug(`[WaveformDisplay:${trackId || 'default'}] ${label}`, details);
      return;
    }
    console.debug(`[WaveformDisplay:${trackId || 'default'}] ${label}`);
  }, [trackId]);

  const beginRegionOp = useCallback((reason: string) => {
    const token = ++regionOpSeqRef.current;
    debugLog('region-op begin', { token, reason, mode: modeRef.current, zoom: zoomLevelRef.current });
    return token;
  }, [debugLog]);

  const isRegionOpCurrent = useCallback((token: number) => token === regionOpSeqRef.current, []);

  useEffect(() => {
    onLoopPointsChangeRef.current = onLoopPointsChange;
  }, [onLoopPointsChange]);

  useEffect(() => {
    onLoopDragStateChangeRef.current = onLoopDragStateChange;
  }, [onLoopDragStateChange]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onCuePointChangeRef.current = onCuePointChange;
  }, [onCuePointChange]);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  // Keep currentCuePointsRef in sync with cuePoints prop
  useEffect(() => {
    currentCuePointsRef.current = [...cuePoints];
  }, [cuePoints]);

  // Debounced update function to prevent rapid changes
  const debouncedUpdate = useCallback((callback: () => void, delay: number = 100) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(callback, delay);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Effect to create/revoke Blob URL
  useEffect(() => {
    const newUrl = URL.createObjectURL(audioFile);
    setAudioUrl(newUrl);
    onReadyCalledRef.current = false; // Reset when loading new file

    return () => {
      URL.revokeObjectURL(newUrl);
    };
  }, [audioFile]);

  // Effect to instantiate plugins only once per file
  useEffect(() => {
    const regionsPlugin = RegionsPlugin.create();
    regionsPluginRef.current = regionsPlugin;

    setPlugins([regionsPlugin]);

    // Reset setup flag when file changes
    initialSetupDoneRef.current = false;
    oneXRetryTimeoutsRef.current.forEach((id) => clearTimeout(id));
    oneXRetryTimeoutsRef.current = [];

    return () => {
      regionsPluginRef.current = null;
      currentRegionsRef.current = [];
      setPlugins([]);
      oneXRetryTimeoutsRef.current.forEach((id) => clearTimeout(id));
      oneXRetryTimeoutsRef.current = [];
    };
  }, [audioUrl]);

  // useWavesurfer hook - peaks+duration skip decode for faster waveform display
  const { wavesurfer, isReady, currentTime } = useWavesurfer({
    container: containerRef,
    url: audioUrl,
    ...(peaksProp && durationProp ? { peaks: peaksProp, duration: durationProp } : {}),
    waveColor: '#008CFF',
    progressColor: '#00F5C3',
    cursorColor: '#00F5C3',
    height: 120,
    normalize: true,
    autoplay: false,
    plugins: plugins,
  });

  // Notify parent when waveform is ready for display (only once per load to prevent infinite loop)
  useEffect(() => {
    if (!isReady || !onReady || onReadyCalledRef.current) return;
    onReadyCalledRef.current = true;
    onReady();
  }, [isReady, onReady]);

  // Track playback state internally
  useEffect(() => {
    if (!wavesurfer) return;

    const handlePlay = () => {
      setInternalIsPlaying(true);
    };
    const handlePause = () => {
      setInternalIsPlaying(false);
    };
    const handleFinish = () => {
      setInternalIsPlaying(false);
    };
    const handleError = (err: Error) => {
      console.warn('WaveSurfer load error, clearing loading state:', err?.message);
      if (!onReadyCalledRef.current && onReadyRef.current) {
        onReadyCalledRef.current = true;
        onReadyRef.current();
      }
    };

    wavesurfer.on('play', handlePlay);
    wavesurfer.on('pause', handlePause);
    wavesurfer.on('finish', handleFinish);
    wavesurfer.on('error', handleError);

    return () => {
      wavesurfer.un('play', handlePlay);
      wavesurfer.un('pause', handlePause);
      wavesurfer.un('finish', handleFinish);
      wavesurfer.un('error', handleError);
    };
  }, [wavesurfer]);

  // Track manual playhead position changes
  useEffect(() => {
    if (!wavesurfer || !onPlayheadChange) return;

    // Use newTime from event - getCurrentTime() can have timing race with async updates
    const handleSeek = (newTime: number) => {
      onPlayheadChange(newTime);
    };

    wavesurfer.on('interaction', handleSeek);

    return () => {
      wavesurfer.un('interaction', handleSeek);
    };
  }, [wavesurfer, onPlayheadChange]);

  // Calculate the appropriate minPxPerSec for the current zoom level
  // 1x = waveform fits viewport; 2x = 2× that width; etc. (scale is continuous from 1x baseline)
  const calculateMinPxPerSec = useCallback(() => {
    if (!wavesurfer || !isReady || !containerRef.current) return 40 * zoomLevel;
    
    const duration = wavesurfer.getDuration();
    const scrollContainer = containerRef.current.parentElement;
    if (!scrollContainer) return 40 * zoomLevel;

    const basePxPerSec = scrollContainer.clientWidth / duration;
    // Scale from 1x baseline so 2x is exactly 2× the width of 1x (no abrupt jump)
    return basePxPerSec * zoomLevel;
  }, [wavesurfer, isReady, zoomLevel]);

  // Pixels per second for measure/grid overlays - must match WaveSurfer's actual scale for alignment
  const [pixelsPerSecond, setPixelsPerSecond] = useState(() => 40 * zoomLevel);
  useEffect(() => {
    const update = () => {
      const px = calculateMinPxPerSec();
      setPixelsPerSecond(px);
    };
    update();
    const scrollContainer = scrollContainerRef.current ?? containerRef.current?.parentElement;
    if (!scrollContainer) return;
    const ro = new ResizeObserver(update);
    ro.observe(scrollContainer);
    return () => ro.disconnect();
  }, [zoomLevel, calculateMinPxPerSec, wavesurfer, isReady]);

  // Sync container width to WaveSurfer's wrapper width when zoomed in
  // This prevents scrolling past the end of the waveform
  useEffect(() => {
    const widthSyncGeneration = ++widthSyncGenerationRef.current;
    if (!wavesurfer || !isReady || !containerRef.current) return;
    
    // Only sync width when zoomed in (zoomLevel > 1)
    // At 1x zoom, the container fits naturally
    if (zoomLevel <= 1) {
      // At 1x, ensure container doesn't have a fixed width that could cause issues
      containerRef.current.style.width = '';
      containerRef.current.style.minWidth = '';
      containerRef.current.style.maxWidth = '';
      return;
    }
    
    // For zoom levels 2x and below, immediately update container width
    // This makes zoom out feel instant instead of waiting for renderer (which has to clear many canvases)
    if (zoomLevel <= 2) {
      const duration = wavesurfer.getDuration();
      const expectedMinPxPerSec = calculateMinPxPerSec();
      const expectedWidth = duration * expectedMinPxPerSec;
      if (expectedWidth > 0) {
        containerRef.current.style.width = `${expectedWidth}px`;
        containerRef.current.style.minWidth = `${expectedWidth}px`;
        containerRef.current.style.maxWidth = `${expectedWidth}px`;
      }
      // Still set up the sync listener for any corrections after render completes
    }

    const syncContainerWidth = () => {
      if (!containerRef.current || !wavesurfer) return;
      if (zoomLevelRef.current <= 1) return;
      
      try {
        const renderer = (wavesurfer as any).renderer;
        if (renderer && renderer.wrapper) {
          // Get the actual wrapper width that WaveSurfer calculated and rendered
          const wrapperWidth = renderer.wrapper.getBoundingClientRect().width || 
                              parseFloat(getComputedStyle(renderer.wrapper).width);
          
          // Also verify this matches the expected width based on minPxPerSec
          const duration = wavesurfer.getDuration();
          const expectedMinPxPerSec = calculateMinPxPerSec();
          const expectedWidth = duration * expectedMinPxPerSec;
          
          // Use the wrapper width if available and close to expected, otherwise use expected
          const targetWidth = (wrapperWidth > 0 && Math.abs(wrapperWidth - expectedWidth) < expectedWidth * 0.1) 
            ? wrapperWidth 
            : expectedWidth;
          
          if (targetWidth > 0) {
            // Sync containerRef width to match WaveSurfer's wrapper exactly
            // This ensures the scroll container knows where the waveform ends
            containerRef.current.style.width = `${targetWidth}px`;
            containerRef.current.style.minWidth = `${targetWidth}px`;
            containerRef.current.style.maxWidth = `${targetWidth}px`;
          }
        }
      } catch (e) {
        // If we can't access renderer, use calculated width as fallback
        const duration = wavesurfer.getDuration();
        const minPxPerSec = calculateMinPxPerSec();
        const calculatedWidth = duration * minPxPerSec;
        if (containerRef.current && calculatedWidth > 0) {
          containerRef.current.style.width = `${calculatedWidth}px`;
          containerRef.current.style.minWidth = `${calculatedWidth}px`;
          containerRef.current.style.maxWidth = `${calculatedWidth}px`;
        }
      }
    };

    // Sync width after WaveSurfer renders
    // Use a single delay after 'rendered' event to ensure wrapper width is fully updated
    try {
      const renderer = (wavesurfer as any).renderer;
      if (renderer && typeof renderer.on === 'function') {
        // Listen to the 'rendered' event - sync width once after render completes
        const handleRendered = () => {
          if (widthSyncGeneration !== widthSyncGenerationRef.current) return;
          debugLog('rendered(width-sync)', { generation: widthSyncGeneration, mode: modeRef.current, regions: currentRegionsRef.current.length });
          // Single delay to ensure wrapper width is fully updated (especially after zoom)
          const timeoutId = setTimeout(() => {
            if (widthSyncGeneration !== widthSyncGenerationRef.current) return;
            syncContainerWidth();
            widthSyncTimeoutsRef.current = widthSyncTimeoutsRef.current.filter((id) => id !== timeoutId);
          }, 200);
          widthSyncTimeoutsRef.current.push(timeoutId);
          // Refresh loop region position after zoom - forces DOM/handles to re-sync
          // without recreating (which was causing duplicate regions).
          // Use modeRef to avoid stale closure: after loop→cue switch, an old handler
          // could still fire with mode==='loop'; we must not refresh in cue mode.
          const region = currentRegionsRef.current[0];
          if (
            widthSyncGeneration === widthSyncGenerationRef.current &&
            modeRef.current === 'loop' &&
            currentRegionsRef.current.length === 1 &&
            region?.element &&
            region?.id?.includes?.('loop-region')
          ) {
            const duration = wavesurfer.getDuration();
            const start = Math.max(0, Math.min(region.start, duration - 0.05));
            const end = Math.max(start + 0.1, Math.min(region.end, duration));
            region.setOptions({ start, end });
          }
        };
        
        renderer.on('rendered', handleRendered);
        
        // Initial sync if waveform is already loaded
        if (wavesurfer.getDuration() > 0) {
          const timeoutId = setTimeout(() => {
            if (widthSyncGeneration !== widthSyncGenerationRef.current) return;
            syncContainerWidth();
            widthSyncTimeoutsRef.current = widthSyncTimeoutsRef.current.filter((id) => id !== timeoutId);
          }, 200);
          widthSyncTimeoutsRef.current.push(timeoutId);
        }
        
        return () => {
          widthSyncGenerationRef.current++;
          widthSyncTimeoutsRef.current.forEach((id) => clearTimeout(id));
          widthSyncTimeoutsRef.current = [];
          if (renderer && typeof renderer.un === 'function') {
            renderer.un('rendered', handleRendered);
          }
        };
      }
    } catch (e) {
      // If renderer events aren't available, fallback to periodic syncing
    }
    
    // Fallback: periodic sync if renderer events aren't available
    if (wavesurfer.getDuration() > 0) {
      const timeoutId = setTimeout(() => {
        if (widthSyncGeneration !== widthSyncGenerationRef.current) return;
        syncContainerWidth();
        widthSyncTimeoutsRef.current = widthSyncTimeoutsRef.current.filter((id) => id !== timeoutId);
      }, 200);
      widthSyncTimeoutsRef.current.push(timeoutId);
    }
    
    const intervalId = setInterval(syncContainerWidth, 1000);
    
    return () => {
      widthSyncGenerationRef.current++;
      widthSyncTimeoutsRef.current.forEach((id) => clearTimeout(id));
      widthSyncTimeoutsRef.current = [];
      clearInterval(intervalId);
    };
  }, [wavesurfer, isReady, zoomLevel, mode, calculateMinPxPerSec, debugLog]);

  // Auto-scroll to follow playhead during playback with center-lock behavior
  useEffect(() => {
    if (!wavesurfer || !isReady || !containerRef.current) return;

    const parentContainer = containerRef.current.parentElement;
    if (!parentContainer) return;

    // Only auto-scroll if playing
    if (!isPlaying) return;

    const pxPerSec = calculateMinPxPerSec();
    // Use playbackTime (canonical) not WaveSurfer's currentTime - keeps scroll in sync with actual audio
    const playheadPosition = playbackTime * pxPerSec;
    const containerWidth = parentContainer.clientWidth;
    const containerCenter = containerWidth / 2;
    
    // Calculate where the playhead should be relative to the scroll position
    // We want the playhead to be at the center of the container once it reaches there
    const targetScrollLeft = playheadPosition - containerCenter;
    
    // Only start scrolling once the playhead would reach the center
    if (playheadPosition >= containerCenter) {
      const totalWidth = wavesurfer.getDuration() * pxPerSec;
      const maxScrollLeft = Math.max(0, totalWidth - containerWidth);
      const clampedScrollTarget = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
      
      // Smoothly scroll to keep playhead at center
      parentContainer.scrollTo({
        left: clampedScrollTarget,
        behavior: 'auto' // Use 'auto' for immediate scrolling during playback
      });
    }
  }, [playbackTime, wavesurfer, isReady, zoomLevel, isPlaying]);

  // Scroll to keep playhead centered - used when zoom changes. Instant (no animation) so zoom
  // appears to target the playhead rather than zoom-then-scroll. Uses actual scrollWidth so
  // we match the rendered waveform (fixes 7x→8x where calculated width can diverge).
  const scrollToCenterPlayhead = useCallback((
    minPxPerSec: number,
    playheadTime = wavesurfer?.getCurrentTime() ?? 0
  ) => {
    if (!containerRef.current?.parentElement) return;
    const parentContainer = containerRef.current.parentElement;
    const duration = wavesurfer?.getDuration() ?? 0;
    if (duration <= 0) return;
    const viewportWidth = parentContainer.clientWidth;
    const scrollWidth = parentContainer.scrollWidth;
    const actualPxPerSec = scrollWidth > 0 ? scrollWidth / duration : minPxPerSec;
    const playheadPx = playheadTime * actualPxPerSec;
    const maxScrollLeft = Math.max(0, scrollWidth - viewportWidth);
    const scrollTarget = playheadPx - viewportWidth / 2;
    parentContainer.scrollTo({
      left: Math.max(0, Math.min(scrollTarget, maxScrollLeft)),
      behavior: 'auto'
    });
  }, [wavesurfer]);

  // Function to scroll viewport to playhead position (used when cues are triggered)
  const scrollToPlayhead = useCallback((targetTime: number) => {
    if (!wavesurfer || !isReady || !containerRef.current || zoomLevel <= 1) return;
    
    const parentContainer = containerRef.current.parentElement;
    if (!parentContainer) return;
    
    const pxPerSec = calculateMinPxPerSec();
    const playheadPosition = targetTime * pxPerSec;
    const containerWidth = parentContainer.clientWidth;
    const containerCenter = containerWidth / 2;
    const totalWidth = wavesurfer.getDuration() * pxPerSec;
    
    // Calculate scroll position to center the playhead
    const scrollTarget = playheadPosition - containerCenter;
    
    // Ensure scroll target is within bounds
    const maxScrollLeft = Math.max(0, totalWidth - containerWidth);
    const clampedScrollTarget = Math.max(0, Math.min(scrollTarget, maxScrollLeft));
    
    // Always scroll to center the playhead when this function is called
    // (it's only called for significant jumps like cue triggers)
    parentContainer.scrollTo({
      left: clampedScrollTarget,
      behavior: 'auto' // Use 'auto' for immediate scrolling when cues are triggered
    });
  }, [wavesurfer, isReady, zoomLevel, calculateMinPxPerSec]);

  // Function to clear all regions
  const clearRegions = useCallback(async (token?: number) => {
    if (token !== undefined && !isRegionOpCurrent(token)) return;
    debugLog('clearRegions start', { token, mode: modeRef.current, count: currentRegionsRef.current.length });

    // First, clear tracked regions
    if (regionsPluginRef.current && currentRegionsRef.current.length > 0) {
      currentRegionsRef.current.forEach(region => {
        try {
          // Remove thumb element if it exists
          if (region.thumbElement) {
            region.thumbElement.remove();
            region.thumbElement = null;
          }
          // Remove all event listeners before removing the region
          region.unAll();
          region.remove();
        } catch (e) {
          // Region might already be removed
          console.warn('Region removal warning:', e);
        }
      });
      currentRegionsRef.current = [];
    }
    
    // Then, clear ALL regions from the plugin to ensure no leftover regions
    if (regionsPluginRef.current) {
      try {
        const allRegions = regionsPluginRef.current.getRegions();
        
        // Try using the plugin's clearRegions method first
        try {
          regionsPluginRef.current.clearRegions();
        } catch (e) {
          console.warn('plugin.clearRegions() failed, trying manual removal:', e);
          
          // Fallback to manual removal
          Object.values(allRegions).forEach((region: any) => {
            try {
              // Remove thumb element if it exists
              if (region.thumbElement) {
                region.thumbElement.remove();
                region.thumbElement = null;
              }
              
              // Remove all event listeners
              region.unAll();
              
              // Try to remove the region element from DOM directly
              if (region.element && region.element.parentNode) {
                region.element.parentNode.removeChild(region.element);
              }
              
              // Remove the region from the plugin
              region.remove();
            } catch (e) {
              console.warn('Region removal warning:', e);
            }
          });
        }
        
        // Force a small delay to ensure removal is complete
        await new Promise(resolve => setTimeout(resolve, 10));
        
      } catch (e) {
        console.warn('Error clearing all regions:', e);
      }
    }
    
    // Also clean up any orphaned thumbs for this track
    if (containerRef.current) {
      const currentTrackId = trackId || 'default';
      const orphanedThumbs = containerRef.current.querySelectorAll(`.cue-thumb-${currentTrackId}`);
      orphanedThumbs.forEach((thumb: Element) => thumb.remove());
    }
    
    // Force a small delay to ensure DOM updates are complete
    await new Promise(resolve => setTimeout(resolve, 5));
    if (token !== undefined && !isRegionOpCurrent(token)) return;
    debugLog('clearRegions done', { token });
  }, [trackId, isPlaying, isRegionOpCurrent, debugLog]);

  // Function to create regions based on mode
  const createRegions = useCallback(async (token?: number) => {
    if (token !== undefined && !isRegionOpCurrent(token)) return;
    debugLog('createRegions start', { token, mode: modeRef.current });
    if (!wavesurfer || !isReady || !regionsPluginRef.current) return;

    await clearRegions(token);
    if (token !== undefined && !isRegionOpCurrent(token)) return;

    if (mode === 'loop') {
      const duration = wavesurfer.getDuration();
      const epsilon = 0.05;
      // Clamp loop region to valid bounds - prevents region extending past waveform
      // (can happen when WaveSurfer's regions plugin gets out of sync during zoom)
      const clampedStart = Math.max(0, Math.min(loopStart, duration - epsilon));
      const clampedEnd = Math.max(clampedStart + 0.01, Math.min(loopEnd, duration));

      const region = regionsPluginRef.current.addRegion({
        start: clampedStart,
        end: clampedEnd,
        color: 'rgba(0, 245, 195, 0.2)',
        drag: true, // Always allow dragging for loop regions
        resize: true, // Always allow resizing for loop regions
        id: `loop-region-${trackId || 'default'}`,
        // Add visual styling for better interaction
        handleStyle: {
          left: {
            backgroundColor: 'rgba(0, 245, 195, 0.8)',
            border: '2px solid #00F5C3',
            borderRadius: '2px',
          },
          right: {
            backgroundColor: 'rgba(0, 245, 195, 0.8)',
            border: '2px solid #00F5C3',
            borderRadius: '2px',
          }
        }
      });

      // Update parent state only on drop to avoid playback glitching during drag.
      // onLoopDragStateChange provides display-only live values during drag.
      region.on('update-start', () => {
        isInternalLoopUpdateRef.current = true;
        const duration = wavesurfer.getDuration();
        const epsilon = 0.05;
        const start = Math.max(0, Math.min(region.start, duration - epsilon));
        const end = Math.max(start + 0.01, Math.min(region.end, duration));
        onLoopDragStateChangeRef.current?.(start, end);
        lastLoopTrackUpdateRef.current = -Infinity;
      });

      region.on('update', () => {
        isInternalLoopUpdateRef.current = true;
        const now = performance.now();
        const duration = wavesurfer.getDuration();
        const epsilon = 0.05;
        const start = Math.max(0, Math.min(region.start, duration - epsilon));
        const end = Math.max(start + 0.01, Math.min(region.end, duration));
        if (now - lastLoopDragUpdateRef.current >= 50) {
          lastLoopDragUpdateRef.current = now;
          onLoopDragStateChangeRef.current?.(start, end);
        }
        if (now - lastLoopTrackUpdateRef.current >= 600) {
          const prevStart = lastSentLoopStartRef.current;
          const prevEnd = lastSentLoopEndRef.current;
          const meaningfulChange = prevStart === undefined || prevEnd === undefined || Math.abs(start - prevStart) > 0.02 || Math.abs(end - prevEnd) > 0.02;
          if (meaningfulChange) {
            lastLoopTrackUpdateRef.current = now;
            lastSentLoopStartRef.current = start;
            lastSentLoopEndRef.current = end;
            onLoopPointsChangeRef.current(start, end);
          }
        }
      });

      region.on('update-end', () => {
        const duration = wavesurfer.getDuration();
        const epsilon = 0.05;
        // Clamp to valid bounds - prevents corrupted values from zoom sync issues
        const start = Math.max(0, Math.min(region.start, duration - epsilon));
        const end = Math.max(start + 0.1, Math.min(region.end, duration));

        if (onLoopDragStateChangeRef.current) {
          onLoopDragStateChangeRef.current(null, null);
        }

        // Update refs immediately to prevent recreation when effect runs
        prevLoopStartRef.current = start;
        prevLoopEndRef.current = end;

        lastSentLoopStartRef.current = start;
        lastSentLoopEndRef.current = end;
        debouncedUpdate(() => {
          onLoopPointsChangeRef.current(start, end);
          // Clear flag after parent callback so effect can run for external changes
          setTimeout(() => {
            isInternalLoopUpdateRef.current = false;
          }, 150);
        });
      });

      if (token !== undefined && !isRegionOpCurrent(token)) return;
      currentRegionsRef.current = [region];
    } else if (mode === 'cue') {
      const duration = wavesurfer.getDuration();
      const epsilon = 0.05; // slightly larger to avoid float issues
      // Use ref to get current cuePoints to avoid stale closure issues
      const currentCuePoints = currentCuePointsRef.current;
      const newRegions = currentCuePoints.map((point, index) => {
        // Clamp start to [0, duration - epsilon]
        const clampedStart = Math.max(0, Math.min(point, duration - epsilon));
        // Ensure region end does not exceed duration
        const regionEnd = Math.min(clampedStart + 0.01, duration);
        // One-Shot: grey out thumb node if it is at or past the next node (invalid trigger)
        const currNum = Number(point);
        const nextNum = index < currentCuePoints.length - 1 ? Number(currentCuePoints[index + 1]) : NaN;
        const isInvalidOneShotTrigger = chopTriggerStyle === 'one-shot' && !Number.isNaN(nextNum) && currNum >= nextNum;
        const region = regionsPluginRef.current.addRegion({
          start: clampedStart,
          end: regionEnd,
          color: 'rgba(255, 77, 79, 0.3)',
          drag: !isGuestMode, // Disable dragging in demo mode
          resize: false,
          id: `cue-${trackId || 'default'}-${index}`,
          handleStyle: {
            left: {
              backgroundColor: 'rgba(255, 77, 79, 0.8)',
              border: '2px solid #FF4D4F',
              borderRadius: '2px',
            },
            right: {
              backgroundColor: 'rgba(255, 77, 79, 0.8)',
              border: '2px solid #FF4D4F',
              borderRadius: '2px',
            }
          }
        });

        // Add drag event listeners for real-time timestamp updates
        region.on('update-start', () => {
          if (onCueDragStateChange) {
            const cuePoint = region.start + (region.end - region.start) / 2;
            const clampedCuePoint = Math.max(0, Math.min(wavesurfer.getDuration(), cuePoint));
            onCueDragStateChange(index, clampedCuePoint);
          }
        });

        region.on('update', () => {
          if (onCueDragStateChange) {
            const cuePoint = region.start + (region.end - region.start) / 2;
            const clampedCuePoint = Math.max(0, Math.min(wavesurfer.getDuration(), cuePoint));
            onCueDragStateChange(index, clampedCuePoint);
          }
        });

        // Only update the cue point and region position, do not recreate all regions
        region.on('update-end', () => {
          const cuePoint = region.start + (region.end - region.start) / 2;
          const clampedCuePoint = Math.max(0, Math.min(wavesurfer.getDuration(), cuePoint));
          
          // Clear drag state when drag ends
          if (onCueDragStateChange) {
            onCueDragStateChange(index, null);
          }
          
          // Set flag to indicate this is an internal update from drag
          // This prevents the effect from recreating/updating regions
          isInternalCueUpdateRef.current = true;
          
          // Update the refs IMMEDIATELY (synchronously) to prevent the effect from recreating regions
          // This must happen before the parent callback to ensure refs are up-to-date
          // when the parent state update triggers the effect
          const newCuePoints = [...prevCuePointsRef.current];
          newCuePoints[index] = clampedCuePoint;
          prevCuePointsRef.current = newCuePoints;
          currentCuePointsRef.current = newCuePoints; // Also update current ref for createRegions
          
          // Debounce the parent callback to prevent rapid state updates
          debouncedUpdate(() => {
            onCuePointChangeRef.current(index, clampedCuePoint);
            // Clear the flag after the parent callback has been called
            // Use a small delay to ensure the effect has had a chance to run and see the flag
            setTimeout(() => {
              isInternalCueUpdateRef.current = false;
            }, 150);
          });
        });

        // Add thumb after region is created (pass invalid-one-shot so thumb is grey when invalid)
        if (showCueThumbs) {
          setTimeout(() => {
            addThumbToRegion(region, index, isInvalidOneShotTrigger);
          }, 100);
        }

        // Add demo mode event listeners to the region itself (cue points only)
        if (isGuestMode) {
          region.on('mousedown', (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            showSignupModal('custom_cue_points');
          });
          
          region.on('touchstart', (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            showSignupModal('custom_cue_points');
          });

          region.on('click', (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            showSignupModal('custom_cue_points');
          });
        }

        return region;
      });

      if (token !== undefined && !isRegionOpCurrent(token)) return;
      currentRegionsRef.current = newRegions;
    }
    debugLog('createRegions done', { token, mode: modeRef.current, count: currentRegionsRef.current.length });
  }, [wavesurfer, isReady, mode, loopStart, loopEnd, cuePoints.length, trackId, showCueThumbs, isGuestMode, chopTriggerStyle, clearRegions, isRegionOpCurrent, debugLog]);

  // Improved function to add thumb element to a region
  // When isInvalidOneShotTrigger is true (One-Shot mode, node at or past next), style thumb grey
  const addThumbToRegion = useCallback((region: any, index: number, isInvalidOneShotTrigger = false) => {
    // Use region.element directly
    const regionElement = region.element;

    if (!regionElement) {
      console.warn(`Could not find region element for index ${index}. Region object:`, region);
      return;
    }

    // Remove existing thumb if it exists (both from the region and cleanup reference)
    if (region.thumbElement) {
      region.thumbElement.remove();
      region.thumbElement = null;
    }
    
    // Also remove any existing thumb elements in the region for this track
    const currentTrackId = trackId || 'default';
    const existingThumbs = regionElement.querySelectorAll(`.cue-thumb-${currentTrackId}`);
    existingThumbs.forEach((thumb: Element) => thumb.remove());

    // Create the hitbox
    const hitbox = document.createElement('div');
    
    // Set cursor and pointer events based on demo mode
    const cursor = isGuestMode ? 'pointer' : 'grab';
    const pointerEvents = 'auto';
    
    hitbox.style.cssText = `
      position: absolute;
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 40px;
      cursor: ${cursor};
      z-index: 31;
      pointer-events: ${pointerEvents};
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create the visible node (grey when invalid One-Shot trigger)
    const thumb = document.createElement('div');
    thumb.className = `cue-thumb cue-thumb-${trackId || 'default'}`;
    const thumbBg = isInvalidOneShotTrigger ? 'rgba(80, 80, 80, 0.95)' : '#FF4D4F';
    const thumbBorder = isInvalidOneShotTrigger ? 'rgba(60, 60, 60, 1)' : '#FF4D4F';
    const thumbOpacity = isInvalidOneShotTrigger ? '0.9' : '1';
    thumb.style.cssText = `
      width: 24px;
      height: 24px;
      background-color: ${thumbBg};
      border: 2px solid ${thumbBorder};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: bold;
      pointer-events: none;
      position: relative;
      opacity: ${thumbOpacity};
    `;

    thumb.textContent = index === 9 ? '0' : (index + 1).toString();

    // Add lock icon in demo mode
    if (isGuestMode) {
      const lockIcon = document.createElement('div');
      lockIcon.style.cssText = `
        position: absolute;
        bottom: -3px;
        right: -3px;
        width: 16px;
        height: 16px;
        background-color: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #FFD700;
        font-weight: bold;
        z-index: 32;
        pointer-events: none;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
      `;
      lockIcon.innerHTML = '🔒';
      thumb.appendChild(lockIcon);
    }

    hitbox.appendChild(thumb);
    regionElement.appendChild(hitbox);

    // Add event listeners based on demo mode
    if (isGuestMode) {
      // In demo mode, prevent dragging and show signup modal on click
      hitbox.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showSignupModal('custom_cue_points');
      });
      
      hitbox.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showSignupModal('custom_cue_points');
      });

      // Also add click event for better user experience
      hitbox.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showSignupModal('custom_cue_points');
      });
    } else {
      // In normal mode, allow dragging by not preventing default behavior
      // The region's built-in drag functionality will work
    }

    // Store reference to the hitbox (which contains the thumb) for cleanup
    region.thumbElement = hitbox;
  }, [trackId, isGuestMode]);

  // Function to remove thumbs from regions
  const removeThumbsFromRegions = useCallback(() => {
    currentRegionsRef.current.forEach(region => {
      if (region.thumbElement) {
        region.thumbElement.remove();
        region.thumbElement = null;
      }
    });
    
    // Also remove any orphaned thumbs from the container for this track
    if (containerRef.current) {
      const currentTrackId = trackId || 'default';
      const orphanedThumbs = containerRef.current.querySelectorAll(`.cue-thumb-${currentTrackId}`);
      orphanedThumbs.forEach((thumb: Element) => thumb.remove());
    }
  }, []);

  // Handle thumb visibility and ensure proper cleanup/recreation
  useEffect(() => {
    if (!wavesurfer || !isReady || !initialSetupDoneRef.current) return;

    if (mode === 'cue') {
      if (showCueThumbs) {
        removeThumbsFromRegions();
        const pts = currentCuePointsRef.current;
        setTimeout(() => {
          currentRegionsRef.current.forEach((region, index) => {
            const currNum = Number(pts[index]);
            const nextNum = index < pts.length - 1 ? Number(pts[index + 1]) : NaN;
            const isInvalidOneShotTrigger = chopTriggerStyle === 'one-shot' && !Number.isNaN(nextNum) && currNum >= nextNum;
            addThumbToRegion(region, index, isInvalidOneShotTrigger);
          });
        }, 200);
      } else {
        removeThumbsFromRegions();
      }
    } else {
      removeThumbsFromRegions();
    }
  }, [showCueThumbs, mode, wavesurfer, isReady, chopTriggerStyle, addThumbToRegion, removeThumbsFromRegions]);

  // Handle mode changes explicitly to ensure proper region cleanup
  useEffect(() => {
    const handleModeChange = async () => {
      if (!wavesurfer || !isReady || !initialSetupDoneRef.current) return;
      
      const modeChanged = prevModeRef.current !== mode;
      if (modeChanged) {
        const token = beginRegionOp('mode-change');
        // Clear regions immediately when mode changes
        await clearRegions(token);
        if (!isRegionOpCurrent(token)) return;
        // Create new regions after clearing is complete
        await createRegions(token);
        if (!isRegionOpCurrent(token)) return;
        
        // Update mode ref immediately
        prevModeRef.current = mode;
      }
    };
    
    handleModeChange();
  }, [mode, wavesurfer, isReady, createRegions, clearRegions, beginRegionOp, isRegionOpCurrent]);

  // Recreate regions when relevant parameters change (but not mode changes)
  useEffect(() => {
    const handleParameterChange = async () => {
      if (!wavesurfer || !isReady || !initialSetupDoneRef.current) return;
      debugLog('parameter-effect run', { mode, zoom: zoomLevelRef.current });
      
      // Only update if mode hasn't changed (mode changes are handled separately)
      const modeChanged = prevModeRef.current !== mode;
      if (modeChanged) return;
      
      // Check if only the parameters changed (not the mode)
      const loopChanged = mode === 'loop' && (
        prevLoopStartRef.current !== loopStart || 
        prevLoopEndRef.current !== loopEnd
      );
      
      // For cue points, check if they actually changed
      const cuePointsChanged = mode === 'cue' && (
        prevCuePointsRef.current.length !== cuePoints.length ||
        prevCuePointsRef.current.some((point, index) => point !== cuePoints[index])
      );
      const triggerStyleChanged = mode === 'cue' && prevChopTriggerStyleRef.current !== chopTriggerStyle;
      
      // If this is an internal update from a drag operation, skip the effect
      // The region position is already correct, and we've already updated the refs
      if (mode === 'cue' && cuePointsChanged && isInternalCueUpdateRef.current) {
        // Skip any region updates. (Important: don't overwrite refs here—during drag the refs
        // may already contain the new value before the parent state updates, and syncing
        // back to props can cause duplicate region creation / visual glitches.)
        return;
      }
      if (mode === 'loop' && loopChanged && isInternalLoopUpdateRef.current) {
        return;
      }

      // If loop points changed externally, update existing region in place to avoid recreate/visual ghost
      if (mode === 'loop' && loopChanged) {
        const loopRegion = currentRegionsRef.current[0];
        if (loopRegion) {
          const duration = wavesurfer.getDuration();
          const epsilon = 0.05;
          const clampedStart = Math.max(0, Math.min(loopStart, duration - epsilon));
          const clampedEnd = Math.max(clampedStart + 0.01, Math.min(loopEnd, duration));
          loopRegion.setOptions({ start: clampedStart, end: clampedEnd });
          prevLoopStartRef.current = loopStart;
          prevLoopEndRef.current = loopEnd;
          return;
        }
      }
      
      // If cue points changed, try to update just the changed region(s) instead of recreating all
      if (mode === 'cue' && cuePointsChanged && prevCuePointsRef.current.length === cuePoints.length) {
        // Check if only one cue point changed (typical drag operation)
        let changedIndex = -1;
        let changeCount = 0;
        for (let i = 0; i < cuePoints.length; i++) {
          if (prevCuePointsRef.current[i] !== cuePoints[i]) {
            changeCount++;
            changedIndex = i;
          }
        }
        
        // If exactly one cue point changed and we have a matching region, update just that region
        // In One-Shot mode skip this path so we do a full recreate and all nodes get correct grey/red
        if (changeCount === 1 && changedIndex >= 0 && currentRegionsRef.current[changedIndex] && chopTriggerStyle !== 'one-shot') {
          const region = currentRegionsRef.current[changedIndex];
          const duration = wavesurfer.getDuration();
          const epsilon = 0.05;
          const clampedStart = Math.max(0, Math.min(cuePoints[changedIndex], duration - epsilon));
          const regionEnd = Math.min(clampedStart + 0.01, duration);
          region.setOptions({
            start: clampedStart,
            end: regionEnd
          });
          prevCuePointsRef.current = [...cuePoints];
          currentCuePointsRef.current = [...cuePoints];
          return;
        }
      }
      
      const needsUpdate = loopChanged || cuePointsChanged || triggerStyleChanged;
      
      if (needsUpdate) {
        const token = beginRegionOp('parameter-change');
        // Sync refs with latest props so createRegions uses current cue points for invalid-one-shot logic
        prevLoopStartRef.current = loopStart;
        prevLoopEndRef.current = loopEnd;
        prevCuePointsRef.current = [...cuePoints];
        currentCuePointsRef.current = [...cuePoints];
        prevChopTriggerStyleRef.current = chopTriggerStyle;
        await clearRegions(token);
        if (!isRegionOpCurrent(token)) return;
        await createRegions(token);
      }
    };
    
    handleParameterChange();
  }, [wavesurfer, isReady, mode, loopStart, loopEnd, cuePoints, chopTriggerStyle, createRegions, clearRegions, beginRegionOp, isRegionOpCurrent, debugLog]);

  // Effect to handle initial setup when waveform becomes ready
  useEffect(() => {
    const setupRegions = async () => {
      if (wavesurfer && isReady && !initialSetupDoneRef.current) {
        const applyInitialZoomAndSetup = async () => {
          if (!containerRef.current || !wavesurfer || initialSetupDoneRef.current) return;
          const scrollContainer = containerRef.current.parentElement;
          const minPxPerSec =
            zoomLevel <= 1 && scrollContainer && scrollContainer.clientWidth > 0
              ? scrollContainer.clientWidth / wavesurfer.getDuration()
              : calculateMinPxPerSec();
          wavesurfer.setOptions({ minPxPerSec });
          const token = beginRegionOp('initial-setup');
          await createRegions(token);
          if (!isRegionOpCurrent(token)) return;
          const initialTime = currentTime || playbackTime || 0;
          setTimeout(() => {
            if (wavesurfer && isReady) {
              wavesurfer.setTime(initialTime);
            }
          }, 100);
          initialSetupDoneRef.current = true;
          prevLoopStartRef.current = loopStart;
          prevLoopEndRef.current = loopEnd;
          prevCuePointsRef.current = [...cuePoints];
          currentCuePointsRef.current = [...cuePoints];
          prevModeRef.current = mode;
          prevChopTriggerStyleRef.current = chopTriggerStyle;

          // Delayed retries for 1x: first track loads before Studio layout settles.
          // ResizeObserver only fires on size *change*; retries catch wrong initial size.
          if (zoomLevel <= 1) {
            const reapplyOneX = () => {
              if (zoomLevelRef.current > 1 || !containerRef.current || !wavesurfer) return;
              const sc = containerRef.current.parentElement;
              // Fallback to grandparent if scroll container has no width yet (layout not ready)
              const widthSource = sc?.clientWidth && sc.clientWidth > 0
                ? sc
                : sc?.parentElement;
              const width = widthSource?.clientWidth ?? widthSource?.getBoundingClientRect?.()?.width;
              if (!width || width <= 0) return;
              const duration = wavesurfer.getDuration();
              const newMinPxPerSec = width / duration;
              wavesurfer.setOptions({ minPxPerSec: newMinPxPerSec });
            };
            const delays = [50, 150, 350, 600];
            delays.forEach((delay) => {
              const id = setTimeout(() => {
                requestAnimationFrame(() => {
                  reapplyOneX();
                  oneXRetryTimeoutsRef.current = oneXRetryTimeoutsRef.current.filter((t) => t !== id);
                });
              }, delay);
              oneXRetryTimeoutsRef.current.push(id);
            });
          }
        };

        if (zoomLevel <= 1) {
          // Defer until layout is complete: scrollContainer.clientWidth may be stale
          // on first load. Same pattern used for zoom-out-to-1x.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              applyInitialZoomAndSetup();
            });
          });
        } else {
          await applyInitialZoomAndSetup();
        }
      }
    };

    setupRegions();
  }, [wavesurfer, isReady, zoomLevel, currentTime, playbackTime, loopStart, loopEnd, cuePoints, mode, createRegions, calculateMinPxPerSec, beginRegionOp, isRegionOpCurrent]);

  // Effect to handle zoom changes
  useEffect(() => {
    // Clear any pending zoom-change retries from a previous run
    zoomChangeRetryTimeoutsRef.current.forEach((id) => clearTimeout(id));
    zoomChangeRetryTimeoutsRef.current = [];

    if (!wavesurfer || !isReady || !initialSetupDoneRef.current) {
      return () => {};
    }

    const newMinPxPerSec = calculateMinPxPerSec();

    // Set container width before zoom so scroll dimensions are correct when rendered fires.
    // (At 5x–8x we used to rely on sync effect's 200ms delay, causing playhead to shift.)
    if (zoomLevel > 1 && containerRef.current) {
      const duration = wavesurfer.getDuration();
      const expectedWidth = duration * newMinPxPerSec;
      if (expectedWidth > 0) {
        containerRef.current.style.width = `${expectedWidth}px`;
        containerRef.current.style.minWidth = `${expectedWidth}px`;
        containerRef.current.style.maxWidth = `${expectedWidth}px`;
      }
    }

    const applyZoom = (minPxPerSec: number, shouldCenterPlayhead: boolean) => {
      try {
        if (typeof wavesurfer.zoom === 'function') {
          wavesurfer.zoom(minPxPerSec);
        } else {
          wavesurfer.setOptions({ minPxPerSec });
        }
      } catch (e) {
        wavesurfer.setOptions({ minPxPerSec });
      }
      if (!shouldCenterPlayhead) return;
      // Capture playhead time now - scroll will use this so zoom targets the playhead
      const playheadTime = wavesurfer.getCurrentTime();
      const doScroll = () => scrollToCenterPlayhead(minPxPerSec, playheadTime);
      // Remove previous handler if any (e.g. rapid pinch zoom)
      if (zoomRenderedHandlerRef.current) {
        try {
          const r = (wavesurfer as any).renderer;
          if (r?.un) r.un('rendered', zoomRenderedHandlerRef.current);
        } catch (_) {}
        zoomRenderedHandlerRef.current = null;
      }
      try {
        const renderer = (wavesurfer as any).renderer;
        if (renderer?.on) {
          const handler = () => {
            doScroll();
            zoomRenderedHandlerRef.current = null;
            try { renderer?.un?.('rendered', handler); } catch (_) {}
          };
          zoomRenderedHandlerRef.current = handler;
          renderer.on('rendered', handler);
        } else {
          requestAnimationFrame(() => requestAnimationFrame(doScroll));
        }
      } catch (_) {
        requestAnimationFrame(() => requestAnimationFrame(doScroll));
      }
    };

    const applyOneX = () => {
      const scrollContainer = containerRef.current?.parentElement;
      const widthSource = scrollContainer?.clientWidth && scrollContainer.clientWidth > 0
        ? scrollContainer
        : scrollContainer?.parentElement;
      const width = widthSource?.clientWidth ?? (widthSource as Element)?.getBoundingClientRect?.()?.width;
      const duration = wavesurfer?.getDuration?.() ?? 0;
      if (zoomLevelRef.current > 1 || !containerRef.current || !wavesurfer) return;
      if (!width || width <= 0) return;
      if (duration <= 0) return;
      applyZoom(width / duration, false);
    };

    const checkAndRetryIfNeeded = () => {
      if (zoomLevelRef.current > 1) return;
      const scrollContainer = containerRef.current?.parentElement;
      if (!scrollContainer || !wavesurfer) return;
      // If waveform still overflows after WaveSurfer had time to render, zoom didn't apply
      const overflowThreshold = 4;
      if (scrollContainer.scrollWidth > scrollContainer.clientWidth + overflowThreshold) {
        applyOneX();
        // One more check after WaveSurfer render - only retry if still needed
        const id = setTimeout(() => {
          if (zoomLevelRef.current > 1) return;
          const sc = containerRef.current?.parentElement;
          if (sc && sc.scrollWidth > sc.clientWidth + overflowThreshold) {
            applyOneX();
          }
          zoomChangeRetryTimeoutsRef.current = zoomChangeRetryTimeoutsRef.current.filter((t) => t !== id);
        }, 300);
        zoomChangeRetryTimeoutsRef.current.push(id);
      }
    };

    if (zoomLevel <= 1) {
      // Defer until layout is complete; then check if zoom applied, retry only if waveform still overflows.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyOneX();
          const id = setTimeout(checkAndRetryIfNeeded, 180);
          zoomChangeRetryTimeoutsRef.current.push(id);
        });
      });
    } else {
      applyZoom(newMinPxPerSec, true);
    }

    return () => {
      zoomChangeRetryTimeoutsRef.current.forEach((id) => clearTimeout(id));
      zoomChangeRetryTimeoutsRef.current = [];
      if (zoomRenderedHandlerRef.current) {
        try {
          const r = (wavesurfer as any).renderer;
          if (r?.un) r.un('rendered', zoomRenderedHandlerRef.current);
        } catch (_) {}
        zoomRenderedHandlerRef.current = null;
      }
    };
  }, [zoomLevel, wavesurfer, isReady, scrollToCenterPlayhead, calculateMinPxPerSec]);

  // Effect to handle window resize at 1x zoom
  useEffect(() => {
    if (zoomLevel > 1 || !wavesurfer || !isReady || !initialSetupDoneRef.current) return;

    const handleResize = () => {
      if (!containerRef.current || !scrollContainerRef.current) return;
      
      const scrollContainer = containerRef.current.parentElement;
      if (scrollContainer) {
        // Update WaveSurfer minPxPerSec to match the new container width
        const duration = wavesurfer.getDuration();
        const newMinPxPerSec = scrollContainer.clientWidth / duration;
        wavesurfer.setOptions({ minPxPerSec: newMinPxPerSec });
        
        // Update container width to match the new minPxPerSec
        const newWidth = duration * newMinPxPerSec;
        containerRef.current.style.width = `${newWidth}px`;
        
        // Update scroll container width to match the available space
        const parentContainer = scrollContainerRef.current.parentElement?.parentElement;
        if (parentContainer) {
          scrollContainerRef.current.style.width = '100%';
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [zoomLevel, wavesurfer, isReady]);

  // ResizeObserver at 1x zoom: fixes first-load case where scroll container had
  // wrong/zero dimensions when double rAF ran (e.g. cold start, empty-to-first-track).
  useEffect(() => {
    if (zoomLevel > 1 || !wavesurfer || !isReady || !initialSetupDoneRef.current) return;

    const scrollContainer = containerRef.current?.parentElement;
    if (!scrollContainer) return;

    const observer = new ResizeObserver(() => {
      if (zoomLevel > 1 || !wavesurfer || !containerRef.current) return;
      const sc = containerRef.current.parentElement;
      if (!sc || sc.clientWidth <= 0) return;
      // Waveform overflowing viewport = wrong minPxPerSec on initial load
      if (sc.scrollWidth > sc.clientWidth + 2) {
        const duration = wavesurfer.getDuration();
        const newMinPxPerSec = sc.clientWidth / duration;
        wavesurfer.setOptions({ minPxPerSec: newMinPxPerSec });
      }
    });

    observer.observe(scrollContainer);
    return () => observer.disconnect();
  }, [zoomLevel, wavesurfer, isReady]);

  // Effect to manage scroll container width at 1x zoom
  useEffect(() => {
    if (!scrollContainerRef.current || !wavesurfer || !isReady) return;
    
    if (zoomLevel <= 1) {
      // At 1x zoom, set the scroll container to fit the available space
      const parentContainer = scrollContainerRef.current.parentElement?.parentElement;
      if (parentContainer) {
        scrollContainerRef.current.style.width = '100%';
      }
    } else {
      // At higher zoom levels, let the scroll container be auto
      scrollContainerRef.current.style.width = 'auto';
    }
  }, [zoomLevel, wavesurfer, isReady]);

  // Trackpad pinch-to-zoom: staged rollout starts with discrete mode to reduce render churn.
  useEffect(() => {
    if (!PINCH_ZOOM_CONFIG.enabled) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const discreteSteps = [1, 2, 4, 8, 16];
    const applyDiscreteStep = (direction: 'in' | 'out') => {
      const now = Date.now();
      if (now - pinchLastStepAtRef.current < PINCH_ZOOM_CONFIG.discreteCooldownMs) return;
      pinchLastStepAtRef.current = now;
      const currentZoom = zoomLevelRef.current;
      const nearestIndex = discreteSteps.reduce((best, step, index) => (
        Math.abs(step - currentZoom) < Math.abs(discreteSteps[best] - currentZoom) ? index : best
      ), 0);
      const nextIndex = direction === 'in'
        ? Math.min(discreteSteps.length - 1, nearestIndex + 1)
        : Math.max(0, nearestIndex - 1);
      const nextZoom = discreteSteps[nextIndex];
      if (nextZoom === currentZoom) return;
      debugLog('pinch discrete step', { direction, from: currentZoom, to: nextZoom });
      if (onZoomChange) {
        onZoomChange(nextZoom);
        return;
      }
      if (direction === 'in') onZoomIn();
      else onZoomOut();
    };

    if (PINCH_ZOOM_CONFIG.mode === 'continuous' && onZoomChange) {
      const PINCH_SENSITIVITY = 0.012;
      let pendingZoom: number | null = null;
      let throttleId: ReturnType<typeof setTimeout> | null = null;

      const flushZoom = () => {
        throttleId = null;
        if (pendingZoom !== null) {
          const z = pendingZoom;
          pendingZoom = null;
          debugLog('pinch continuous flush', { to: z });
          if (z !== zoomLevelRef.current) onZoomChange(z);
        }
      };

      const handleWheel = (e: WheelEvent) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const current = pendingZoom ?? zoomLevelRef.current;
        const factor = Math.exp(-PINCH_SENSITIVITY * e.deltaY);
        const unclamped = Math.max(1, Math.min(8, current * factor));
        const maxDelta = PINCH_ZOOM_CONFIG.maxDeltaPerTick;
        const bounded = Math.max(current - maxDelta, Math.min(current + maxDelta, unclamped));
        pendingZoom = Math.max(1, Math.min(16, bounded));
        if (throttleId === null) {
          throttleId = setTimeout(flushZoom, PINCH_ZOOM_CONFIG.throttleMs);
        }
      };

      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        el.removeEventListener('wheel', handleWheel);
        if (throttleId !== null) clearTimeout(throttleId);
      };
    }
    if (!onZoomIn && !onZoomOut && !onZoomChange) return;
    let accumulatedDelta = 0;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      accumulatedDelta += e.deltaY;
      if (Math.abs(accumulatedDelta) >= PINCH_ZOOM_CONFIG.discreteThreshold) {
        const steps = Math.trunc(accumulatedDelta / PINCH_ZOOM_CONFIG.discreteThreshold);
        accumulatedDelta = accumulatedDelta % PINCH_ZOOM_CONFIG.discreteThreshold;
        for (let i = 0; i < Math.abs(steps); i++) {
          steps > 0 ? applyDiscreteStep('out') : applyDiscreteStep('in');
        }
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [onZoomIn, onZoomOut, onZoomChange, debugLog]);

  // Effect to handle scroll events and communicate scroll state
  useEffect(() => {
    if (!scrollContainerRef.current || !onScrollStateChange) return;

    const handleScroll = () => {
      setIsScrolling(true);
      onScrollStateChange(true);
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set a timeout to mark scrolling as finished after 150ms of no scroll events
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
        onScrollStateChange(false);
      }, 150);
    };

    const scrollContainer = scrollContainerRef.current;
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [onScrollStateChange]);

  // Single source of truth: always use playbackTime (canonical from TrackControls/Studio).
  // Studio now syncs loopPlayhead/samplePlayhead in handlePlaybackTimeChange, so playbackTime
  // is authoritative for both playing and paused states.
  const displayTime = playbackTime;

  // Optimized playhead update with throttling
  useEffect(() => {
    if (!wavesurfer || !isReady) return;

    const prevDisplayTime = prevPlaybackTimeRef.current;

    // Detect significant jumps (cue triggers) - threshold of 0.5 seconds
    const jumpThreshold = 0.5;
    const isSignificantJump = Math.abs(displayTime - prevDisplayTime) > jumpThreshold;

    const now = performance.now();
    // For significant jumps, don't throttle - update immediately
    // For normal playback, throttle updates to 30fps for smoother performance
    if (!isSignificantJump && now - lastUpdateTimeRef.current < 33) {
      return;
    }

    wavesurfer.setTime(displayTime);
    lastUpdateTimeRef.current = now;

    // If there's a significant jump and we're zoomed in, scroll to the playhead
    if (isSignificantJump && zoomLevel > 1) {
      // Use a small delay to ensure wavesurfer has updated
      setTimeout(() => {
        scrollToPlayhead(displayTime);
      }, 10);
    }

    prevPlaybackTimeRef.current = displayTime;
  }, [displayTime, wavesurfer, isReady, zoomLevel, scrollToPlayhead]);

  useEffect(() => {
    if (wavesurfer && isReady && initialSetupDoneRef.current) {
      setInternalShowMeasures(showMeasures || false);
    }
  }, [showMeasures, wavesurfer, isReady]);

  // Calculate horizontal grid size based on tempo (scales with zoom for vertical grid lines)
  const calculateHorizontalGridSize = useCallback(() => {
    // Convert tempo (BPM) to seconds per beat
    const secondsPerBeat = 60 / tempo;
    
    // The denominator tells us what note gets one beat
    // 4 = quarter note, 8 = eighth note, 2 = half note, etc.
    const beatNoteValue = 4 / timeSignature.denominator;
    
    // Calculate beat duration: duration per beat × beat note value
    const beatDuration = secondsPerBeat * beatNoteValue;
    
    // Use actual pixels per second for alignment with waveform and measure overlays
    const pixelsPerBeat = beatDuration * pixelsPerSecond;
    
    // Round to nearest pixel and ensure minimum size
    return Math.max(10, Math.round(pixelsPerBeat));
  }, [tempo, timeSignature, pixelsPerSecond]);

  // Vertical grid size is fixed (does NOT scale with zoom)
  // This prevents the appearance of vertical zoom
  const VERTICAL_GRID_SIZE = 20; // Fixed pixel spacing for horizontal grid lines

  const horizontalGridSize = calculateHorizontalGridSize();

  return (
    <div className="w-full box-border overflow-hidden relative">
      {/* Compact Zoom Controls Overlay */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-audafact-surface-2 bg-opacity-80 border border-audafact-divider rounded-md shadow-sm px-1 py-0.5">
        <button
          type="button"
          onClick={onZoomOut}
          className="p-1 rounded hover:bg-audafact-surface-1 text-audafact-text-secondary hover:text-audafact-accent-cyan focus:outline-none"
          title="Zoom Out (X)"
          aria-label="Zoom out"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onResetZoom}
          className="px-1.5 py-0.5 text-[10px] leading-none rounded hover:bg-audafact-surface-1 text-audafact-text-secondary hover:text-audafact-accent-cyan focus:outline-none"
          title="Reset Zoom (C)"
          aria-label="Reset zoom"
        >
          {(typeof zoomLevel === 'number' ? zoomLevel : 1).toFixed(2).replace(/\.00$/, '')}x
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          className="p-1 rounded hover:bg-audafact-surface-1 text-audafact-text-secondary hover:text-audafact-accent-cyan focus:outline-none"
          title="Zoom In (Z)"
          aria-label="Zoom in"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
      {!isReady && !suppressLoadingOverlay && (
        <div className="absolute inset-0 flex items-center justify-center audafact-text-secondary bg-audafact-surface-1 z-10">
          {`Loading waveform... ${mode}`}
        </div>
      )}

      <div className={`transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
        <div 
          ref={scrollContainerRef}
          style={{ 
            overflowX: zoomLevel <= 1 ? 'hidden' : 'auto', 
            overflowY: 'hidden'
          }}
        >
          <div
            key={audioUrl || 'no-url'}
            ref={containerRef}
            className={`box-border ${zoomLevel <= 1 ? 'w-full' : ''}`}
            style={{ 
              height: '170px', 
              minWidth: zoomLevel <= 1 ? '100%' : undefined,
              position: 'relative',
              backgroundColor: '#111827',
              backgroundImage: `
                linear-gradient(rgba(139, 148, 158, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(139, 148, 158, 0.1) 1px, transparent 1px)
              `,
              // Horizontal (first value): scales with zoom for vertical grid lines
              // Vertical (second value): fixed to prevent vertical zoom appearance
              backgroundSize: `${horizontalGridSize}px ${VERTICAL_GRID_SIZE}px`
            }}
          >
            {/* Grid Lines Overlay - Always visible */}
            {isReady && wavesurfer && (
              <GridLines
                key={`grid-lines-${trackId || 'default'}-${tempo}`}
                duration={wavesurfer.getDuration()}
                tempo={tempo}
                zoomLevel={zoomLevel}
                pixelsPerSecond={pixelsPerSecond}
                timeSignature={timeSignature}
                firstMeasureTime={firstMeasureTime}
                visible={true}
                showMeasures={internalShowMeasures}
                beats={beats}
                highlightTime={cueDragTime}
              />
            )}
            
            {/* Measure Display Overlay */}
            {isReady && wavesurfer && (
              <MeasureDisplay
                key={`measure-display-${trackId || 'default'}-${tempo}`}
                duration={wavesurfer.getDuration()}
                tempo={tempo}
                zoomLevel={zoomLevel}
                pixelsPerSecond={pixelsPerSecond}
                onFirstMeasureChange={onFirstMeasureChange || (() => {})}
                timeSignature={timeSignature}
                firstMeasureTime={firstMeasureTime}
                visible={internalShowMeasures}
                containerRef={containerRef}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const WaveformDisplayContainer = (props: WaveformDisplayProps) => {
  return (
     <div className="w-full relative box-border overflow-hidden audafact-waveform-bg" style={{ height: '190px' }}>
       <WaveformDisplay {...props} />
     </div>
  );
}

export default WaveformDisplayContainer;