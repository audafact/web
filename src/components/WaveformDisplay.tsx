import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import MeasureDisplay from './MeasureDisplay';
import GridLines from './GridLines';
import { TimeSignature } from '../types/music';
import { showSignupModal } from '../hooks/useSignupModal';

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
  // Drag state callback for real-time timestamp updates
  onCueDragStateChange?: (index: number, time: number | null) => void;
}

const WaveformDisplay = ({
  audioFile,
  mode,
  playhead,
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
  trackId,
  // Measure display props
  showMeasures = false,
  tempo = 120,
  timeSignature = { numerator: 4, denominator: 4 },
  firstMeasureTime = 0,
  onFirstMeasureChange,
  // Cue thumb props
  showCueThumbs = false,
  // Playback control
  isPlaying = false,
  // Playhead position change callback
  onPlayheadChange,
  // Scroll state callback
  onScrollStateChange,
  // Demo mode
  isGuestMode = false,
  // Drag state callback for real-time timestamp updates
  onCueDragStateChange,
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
  
  // Track previous values to detect changes
  const prevLoopStartRef = useRef<number>(loopStart);
  const prevLoopEndRef = useRef<number>(loopEnd);
  const prevCuePointsRef = useRef<number[]>(cuePoints);
  const prevModeRef = useRef<string>(mode);
  const prevPlayheadRef = useRef<number | undefined>(playhead);
  const prevPlaybackTimeRef = useRef<number>(playbackTime);
  
  // Ref to track current cuePoints value for use in createRegions callback
  // This avoids stale closure issues when cuePoints values change but length doesn't
  const currentCuePointsRef = useRef<number[]>(cuePoints);
  
  // Flag to track when we're updating cue points internally (from drag operations)
  // This prevents the effect from recreating regions when the change originates from our own drag
  const isInternalCueUpdateRef = useRef<boolean>(false);

  const onLoopPointsChangeRef = useRef(onLoopPointsChange);
  const onCuePointChangeRef = useRef(onCuePointChange);

  useEffect(() => {
    onLoopPointsChangeRef.current = onLoopPointsChange;
  }, [onLoopPointsChange]);

  useEffect(() => {
    onCuePointChangeRef.current = onCuePointChange;
  }, [onCuePointChange]);

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

    return () => {
      regionsPluginRef.current = null;
      currentRegionsRef.current = [];
      setPlugins([]);
    };
  }, [audioUrl]);

  // useWavesurfer hook
  const { wavesurfer, isReady, currentTime } = useWavesurfer({
    container: containerRef,
    url: audioUrl,
    waveColor: '#008CFF',
    progressColor: '#00F5C3',
    cursorColor: '#00F5C3',
    height: 120,
    normalize: true,
    autoplay: false,
    plugins: plugins,
  });



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

    wavesurfer.on('play', handlePlay);
    wavesurfer.on('pause', handlePause);
    wavesurfer.on('finish', handleFinish);

    return () => {
      wavesurfer.un('play', handlePlay);
      wavesurfer.un('pause', handlePause);
      wavesurfer.un('finish', handleFinish);
    };
  }, [wavesurfer]);

  // Track manual playhead position changes
  useEffect(() => {
    if (!wavesurfer || !onPlayheadChange) return;

    const handleSeek = () => {
      // Allow position changes during both playback and when paused
      const newTime = wavesurfer.getCurrentTime();
      onPlayheadChange(newTime);
    };

    wavesurfer.on('interaction', handleSeek);

    return () => {
      wavesurfer.un('interaction', handleSeek);
    };
  }, [wavesurfer, onPlayheadChange]);

  // Calculate the appropriate minPxPerSec for the current zoom level
  const calculateMinPxPerSec = useCallback(() => {
    if (!wavesurfer || !isReady || !containerRef.current) return 40 * zoomLevel;
    
    const duration = wavesurfer.getDuration();
    if (zoomLevel <= 1) {
      // At 1x zoom, calculate the minPxPerSec needed to fit the entire waveform
      // We need to get the actual scroll container width (the immediate parent)
      const scrollContainer = containerRef.current.parentElement;
      if (scrollContainer) {
        const availableWidth = scrollContainer.clientWidth;
        // Ensure the waveform fits exactly within the available width
        return availableWidth / duration;
      }
    }
    return 40 * zoomLevel;
  }, [wavesurfer, isReady, zoomLevel]);

  // Set initial width for both containers when ready
  useEffect(() => {
    if (wavesurfer && isReady && !initialSetupDoneRef.current) {
      const minPxPerSec = calculateMinPxPerSec();
      
      // Simply set minPxPerSec - WaveSurfer's multicanvas renderer will handle
      // splitting into multiple canvases automatically when width exceeds 8000px
      // Only set initial value, don't update on zoom changes (handled by zoom effect)
      wavesurfer.setOptions({ minPxPerSec });
    }
  }, [wavesurfer, isReady, calculateMinPxPerSec]);

  // Sync container width to WaveSurfer's wrapper width when zoomed in
  // This prevents scrolling past the end of the waveform
  useEffect(() => {
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
          // Single delay to ensure wrapper width is fully updated (especially after zoom)
          setTimeout(syncContainerWidth, 200);
          // Refresh loop region position after zoom - forces DOM/handles to re-sync
          // without recreating (which was causing duplicate regions)
          if (mode === 'loop' && currentRegionsRef.current.length === 1) {
            const region = currentRegionsRef.current[0];
            if (region?.element) {
              const duration = wavesurfer.getDuration();
              const start = Math.max(0, Math.min(region.start, duration - 0.05));
              const end = Math.max(start + 0.1, Math.min(region.end, duration));
              region.setOptions({ start, end });
            }
          }
        };
        
        renderer.on('rendered', handleRendered);
        
        // Initial sync if waveform is already loaded
        if (wavesurfer.getDuration() > 0) {
          setTimeout(syncContainerWidth, 200);
        }
        
        return () => {
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
      setTimeout(syncContainerWidth, 200);
    }
    
    const intervalId = setInterval(syncContainerWidth, 1000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [wavesurfer, isReady, zoomLevel, mode, calculateMinPxPerSec]);

  // Auto-scroll to follow playhead during playback with center-lock behavior
  useEffect(() => {
    if (!wavesurfer || !isReady || !containerRef.current) return;

    const parentContainer = containerRef.current.parentElement;
    if (!parentContainer) return;

    // Only auto-scroll if playing
    if (!isPlaying) return;

    const pxPerSec = calculateMinPxPerSec();
    const playheadPosition = (currentTime ?? 0) * pxPerSec;
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
  }, [currentTime, wavesurfer, isReady, zoomLevel, isPlaying]);

  // Improved playhead centering function
  const centerPlayheadAfterZoom = useCallback((targetZoomLevel = zoomLevel) => {
    if (!wavesurfer || !isReady || !containerRef.current) return;
    
    // Get current time directly from wavesurfer instance for accuracy
    const centerTime = wavesurfer.getCurrentTime();
    const pxPerSec = calculateMinPxPerSec();
    const playheadPosition = centerTime * pxPerSec;
    const parentContainer = containerRef.current.parentElement;
    
    if (!parentContainer) return;
    
    const containerWidth = parentContainer.clientWidth;
    const totalWidth = wavesurfer.getDuration() * pxPerSec;
    const scrollTarget = playheadPosition - containerWidth / 2;
    
    // Ensure scroll target is within bounds
    const maxScrollLeft = Math.max(0, totalWidth - containerWidth);
    const clampedScrollTarget = Math.max(0, Math.min(scrollTarget, maxScrollLeft));
    
    // Use smooth scrolling for better UX
    parentContainer.scrollTo({
      left: clampedScrollTarget,
      behavior: 'smooth'
    });
  }, [wavesurfer, isReady, zoomLevel, calculateMinPxPerSec]);

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
  const clearRegions = useCallback(async () => {
    
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
    return new Promise(resolve => setTimeout(resolve, 5));
  }, [trackId, isPlaying]);

  // Function to create regions based on mode
  const createRegions = useCallback(async () => {
    if (!wavesurfer || !isReady || !regionsPluginRef.current) return;

    await clearRegions();

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

      region.on('update-end', () => {
        const duration = wavesurfer.getDuration();
        const epsilon = 0.05;
        // Clamp to valid bounds - prevents corrupted values from zoom sync issues
        const start = Math.max(0, Math.min(region.start, duration - epsilon));
        const end = Math.max(start + 0.1, Math.min(region.end, duration));

        debouncedUpdate(() => {
          onLoopPointsChangeRef.current(start, end);
          // Update refs to prevent recreation
          prevLoopStartRef.current = start;
          prevLoopEndRef.current = end;
        });
      });



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
        const region = regionsPluginRef.current.addRegion({
          start: clampedStart,
          end: regionEnd,
          color: 'rgba(255, 77, 79, 0.3)',
          drag: !isGuestMode, // Disable dragging in demo mode
          resize: false,
          id: `cue-${trackId || 'default'}-${index}`,
          // Add visual styling for better interaction
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

        // Add thumb after region is created
        if (showCueThumbs) {
          // Use a more reliable method to add thumb
          setTimeout(() => {
            addThumbToRegion(region, index);
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

      currentRegionsRef.current = newRegions;
    }
  }, [wavesurfer, isReady, mode, loopStart, loopEnd, cuePoints.length, trackId, showCueThumbs, isGuestMode]);

  // Improved function to add thumb element to a region
  // Alternative approach: Use WaveSurfer's internal region management
  const addThumbToRegion = useCallback((region: any, index: number) => {
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

    // Create the visible node
    const thumb = document.createElement('div');
    thumb.className = `cue-thumb cue-thumb-${trackId || 'default'}`;
    thumb.style.cssText = `
      width: 24px;
      height: 24px;
      background-color: #FF4D4F;
      border: 2px solid #FF4D4F;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: bold;
      pointer-events: none;
      position: relative;
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
        // Remove any existing thumbs first
        removeThumbsFromRegions();
        
        // Add thumbs with a delay to ensure regions are fully rendered
        setTimeout(() => {
          currentRegionsRef.current.forEach((region, index) => {
            addThumbToRegion(region, index);
          });
        }, 200);
      } else {
        removeThumbsFromRegions();
      }
    } else {
      // When not in cue mode, make sure to clean up any thumbs
      removeThumbsFromRegions();
    }
  }, [showCueThumbs, mode, wavesurfer, isReady, addThumbToRegion, removeThumbsFromRegions]);

  // Handle mode changes explicitly to ensure proper region cleanup
  useEffect(() => {
    const handleModeChange = async () => {
      if (!wavesurfer || !isReady || !initialSetupDoneRef.current) return;
      
      const modeChanged = prevModeRef.current !== mode;
      if (modeChanged) {
        // Clear regions immediately when mode changes
        await clearRegions();
        // Create new regions after clearing is complete
        await createRegions();
        
        // Update mode ref immediately
        prevModeRef.current = mode;
      }
    };
    
    handleModeChange();
  }, [mode, wavesurfer, isReady, createRegions, clearRegions]);

  // Recreate regions when relevant parameters change (but not mode changes)
  useEffect(() => {
    const handleParameterChange = async () => {
      if (!wavesurfer || !isReady || !initialSetupDoneRef.current) return;
      
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
      
      // If this is an internal update from a drag operation, skip the effect
      // The region position is already correct, and we've already updated the refs
      if (mode === 'cue' && cuePointsChanged && isInternalCueUpdateRef.current) {
        // Just sync the refs to match the prop (which should already match, but be safe)
        prevCuePointsRef.current = [...cuePoints];
        currentCuePointsRef.current = [...cuePoints];
        return; // Skip any region updates
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
        if (changeCount === 1 && changedIndex >= 0 && currentRegionsRef.current[changedIndex]) {
          const region = currentRegionsRef.current[changedIndex];
          const duration = wavesurfer.getDuration();
          const epsilon = 0.05;
          const clampedStart = Math.max(0, Math.min(cuePoints[changedIndex], duration - epsilon));
          const regionEnd = Math.min(clampedStart + 0.01, duration);
          
          // Update the region position
          region.setOptions({
            start: clampedStart,
            end: regionEnd
          });
          
          // Update the refs to reflect the change
          prevCuePointsRef.current = [...cuePoints];
          currentCuePointsRef.current = [...cuePoints];
          return; // Early return - no need to recreate all regions
        }
      }
      
      const needsUpdate = loopChanged || cuePointsChanged;
      
      if (needsUpdate) {
        // Clear regions first, then create new ones to prevent duplicates
        await clearRegions();
        await createRegions();
        // Update all refs to prevent unnecessary recreations
        prevLoopStartRef.current = loopStart;
        prevLoopEndRef.current = loopEnd;
        prevCuePointsRef.current = [...cuePoints];
        currentCuePointsRef.current = [...cuePoints];
      }
    };
    
    handleParameterChange();
  }, [wavesurfer, isReady, mode, loopStart, loopEnd, cuePoints, createRegions, clearRegions]);

  // Effect to handle initial setup when waveform becomes ready
  useEffect(() => {
    const setupRegions = async () => {
      if (wavesurfer && isReady && !initialSetupDoneRef.current) {
        // Set initial zoom level using calculated minPxPerSec
        const newMinPxPerSec = calculateMinPxPerSec();
        wavesurfer.setOptions({ minPxPerSec: newMinPxPerSec });
        
        // Create initial regions
        await createRegions();
        
        // Set initial position
        const initialTime = currentTime || playbackTime || 0;
        setTimeout(() => {
          if (wavesurfer && isReady) {
            wavesurfer.setTime(initialTime);
          }
        }, 100);
        
        initialSetupDoneRef.current = true;
        
        // Update previous values
        prevLoopStartRef.current = loopStart;
        prevLoopEndRef.current = loopEnd;
        prevCuePointsRef.current = [...cuePoints];
        currentCuePointsRef.current = [...cuePoints];
        prevModeRef.current = mode;
      }
    };
    
    setupRegions();
  }, [wavesurfer, isReady, zoomLevel, currentTime, playbackTime, loopStart, loopEnd, cuePoints, mode, createRegions, calculateMinPxPerSec]);

  // Effect to handle zoom changes
  useEffect(() => {
    if (wavesurfer && isReady && initialSetupDoneRef.current) {
      const newMinPxPerSec = calculateMinPxPerSec();
      
      // For zoom levels 2x–4x, immediately update container width (makes zoom out feel instant)
      // Skip for 1x: sync effect clears width first; we defer zoom until after layout below
      if (zoomLevel > 1 && zoomLevel <= 4 && containerRef.current) {
        const duration = wavesurfer.getDuration();
        const expectedWidth = duration * newMinPxPerSec;
        if (expectedWidth > 0) {
          containerRef.current.style.width = `${expectedWidth}px`;
          containerRef.current.style.minWidth = `${expectedWidth}px`;
          containerRef.current.style.maxWidth = `${expectedWidth}px`;
        }
      }
      
      const applyZoom = (minPxPerSec: number) => {
        try {
          if (typeof wavesurfer.zoom === 'function') {
            wavesurfer.zoom(minPxPerSec);
          } else {
            wavesurfer.setOptions({ minPxPerSec });
          }
        } catch (e) {
          wavesurfer.setOptions({ minPxPerSec });
        }
        setTimeout(() => centerPlayheadAfterZoom(zoomLevel), 50);
      };
      
      if (zoomLevel <= 1) {
        // Defer until layout is complete: the sync effect clears container width first;
        // WaveSurfer needs to read fresh dimensions. Without this, the first 2x→1x
        // transition can fail because the renderer uses stale/cached dimensions.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!containerRef.current || !wavesurfer) return;
            const scrollContainer = containerRef.current.parentElement;
            const minPxPerSec = scrollContainer
              ? scrollContainer.clientWidth / wavesurfer.getDuration()
              : newMinPxPerSec;
            applyZoom(minPxPerSec);
          });
        });
      } else {
        applyZoom(newMinPxPerSec);
      }
    }
  }, [zoomLevel, wavesurfer, isReady, centerPlayheadAfterZoom, calculateMinPxPerSec]);

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

  // Optimized playhead update with throttling
  useEffect(() => {
    if (!wavesurfer || !isReady) return;

    const prevPlaybackTime = prevPlaybackTimeRef.current;
    
    // Detect significant jumps (cue triggers) - threshold of 0.5 seconds
    const jumpThreshold = 0.5;
    const isSignificantJump = Math.abs(playbackTime - prevPlaybackTime) > jumpThreshold;
    
    const now = performance.now();
    // For significant jumps, don't throttle - update immediately
    // For normal playback, throttle updates to 30fps for smoother performance
    if (!isSignificantJump && now - lastUpdateTimeRef.current < 33) {
      return;
    }

    wavesurfer.setTime(playbackTime);
    lastUpdateTimeRef.current = now;
    
    // If there's a significant jump and we're zoomed in, scroll to the playhead
    if (isSignificantJump && zoomLevel > 1) {
      // Use a small delay to ensure wavesurfer has updated
      setTimeout(() => {
        scrollToPlayhead(playbackTime);
      }, 10);
    }
    
    prevPlaybackTimeRef.current = playbackTime;
  }, [playbackTime, wavesurfer, isReady, zoomLevel, scrollToPlayhead]);

  // Handle explicit playhead updates (less frequent)
  useEffect(() => {
    if (wavesurfer && isReady && typeof playhead === 'number') {
      const prevPlayhead = prevPlayheadRef.current;
      
      // Detect significant jumps (cue triggers) - threshold of 0.5 seconds
      const jumpThreshold = 0.5;
      const isSignificantJump = prevPlayhead !== undefined && Math.abs(playhead - prevPlayhead) > jumpThreshold;
      
      wavesurfer.setTime(playhead);
      
      // If there's a significant jump and we're zoomed in, scroll to the playhead
      if (isSignificantJump && zoomLevel > 1) {
        // Use a small delay to ensure wavesurfer has updated
        setTimeout(() => {
          scrollToPlayhead(playhead);
        }, 10);
      }
      
      prevPlayheadRef.current = playhead;
    }
  }, [playhead, wavesurfer, isReady, zoomLevel, scrollToPlayhead]);

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
    
    // Base pixels per second is 40 (WaveSurfer's actual default minPxPerSec)
    const basePixelsPerSecond = 40;
    const zoomedPixelsPerSecond = basePixelsPerSecond * zoomLevel;
    
    // Calculate pixels per beat (this scales with zoom)
    const pixelsPerBeat = beatDuration * zoomedPixelsPerSecond;
    
    // Round to nearest pixel and ensure minimum size
    return Math.max(10, Math.round(pixelsPerBeat));
  }, [tempo, timeSignature, zoomLevel]);

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
      {!isReady && (
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
                timeSignature={timeSignature}
                firstMeasureTime={firstMeasureTime}
                visible={true}
                showMeasures={internalShowMeasures}
              />
            )}
            
            {/* Measure Display Overlay */}
            {isReady && wavesurfer && (
              <MeasureDisplay
                key={`measure-display-${trackId || 'default'}-${tempo}`}
                duration={wavesurfer.getDuration()}
                tempo={tempo}
                zoomLevel={zoomLevel}
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