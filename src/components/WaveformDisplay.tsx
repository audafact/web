import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import MeasureDisplay from './MeasureDisplay';
import { TimeSignature } from '../types/music';

interface WaveformDisplayProps {
  audioFile: File;
  mode: 'preview' | 'loop' | 'cue';
  audioContext: AudioContext | null;
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
  onTimeSignatureChange?: (timeSignature: TimeSignature) => void;
  // Cue thumb props
  showCueThumbs?: boolean;
  // Volume
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  // Playback control
  isPlaying?: boolean;
  // Playhead position change callback
  onPlayheadChange?: (time: number) => void;
}

const WaveformDisplay = ({
  audioFile,
  mode,
  playhead,
  audioContext,
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
  onTimeSignatureChange,
  // Cue thumb props
  showCueThumbs = false,
  // Volume
  volume = 1,
  onVolumeChange,
  // Playback control
  isPlaying = false,
  // Playhead position change callback
  onPlayheadChange,
}: WaveformDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [internalShowMeasures, setInternalShowMeasures] = useState(false);
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  
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

  const onLoopPointsChangeRef = useRef(onLoopPointsChange);
  const onCuePointChangeRef = useRef(onCuePointChange);

  useEffect(() => {
    onLoopPointsChangeRef.current = onLoopPointsChange;
  }, [onLoopPointsChange]);

  useEffect(() => {
    onCuePointChangeRef.current = onCuePointChange;
  }, [onCuePointChange]);

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

  const shouldUpdateRegions = useMemo(() => {
    const modeChanged = prevModeRef.current !== mode;
    const loopChanged = mode === 'loop' && (
      prevLoopStartRef.current !== loopStart || 
      prevLoopEndRef.current !== loopEnd
    );
    const cuePointsChanged = mode === 'cue' && (
      prevCuePointsRef.current.length !== cuePoints.length ||
      prevCuePointsRef.current.some((point, index) => point !== cuePoints[index])
    );
    
    // In preview mode, we don't need to update regions
    if (mode === 'preview') {
      return modeChanged;
    }
    
    return modeChanged || loopChanged || cuePointsChanged;
  }, [mode, loopStart, loopEnd, cuePoints]);

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
    const timelinePlugin = TimelinePlugin.create();
    const regionsPlugin = RegionsPlugin.create();
    regionsPluginRef.current = regionsPlugin;

    setPlugins([timelinePlugin, regionsPlugin]);

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
    waveColor: '#E5E7EB',
    progressColor: '#4F46E5',
    cursorColor: '#4F46E5',
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
      // Only notify of position changes when not playing
      // During playback, position changes are handled by the audio system
      if (!isPlaying && !internalIsPlaying) {
        const newTime = wavesurfer.getCurrentTime();
        onPlayheadChange(newTime);
      }
    };

    wavesurfer.on('interaction', handleSeek);

    return () => {
      wavesurfer.un('interaction', handleSeek);
    };
  }, [wavesurfer, onPlayheadChange, isPlaying, internalIsPlaying]);

  // Set initial width for both containers when ready
  useEffect(() => {
    if (wavesurfer && isReady) {
      const duration = wavesurfer.getDuration();
      const initialWidth = duration * 20 * zoomLevel; // 20 is the base minPxPerSec
      
      if (containerRef.current) {
        containerRef.current.style.width = `${initialWidth}px`;
      }
    }
  }, [wavesurfer, isReady, zoomLevel]);

  // Auto-scroll to follow playhead during playback with center-lock behavior
  useEffect(() => {
    if (!wavesurfer || !isReady || !containerRef.current) return;

    const parentContainer = containerRef.current.parentElement;
    if (!parentContainer) return;

    const pxPerSec = 20 * zoomLevel;
    const playheadPosition = (currentTime ?? 0) * pxPerSec;
    const containerWidth = parentContainer.clientWidth;
    const containerCenter = containerWidth / 2;
    
    // Only auto-scroll if playing
    if (isPlaying) {
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
    }
  }, [currentTime, wavesurfer, isReady, zoomLevel, isPlaying]);

  // Improved playhead centering function
  const centerPlayheadAfterZoom = useCallback((targetZoomLevel = zoomLevel) => {
    if (!wavesurfer || !isReady || !containerRef.current) return;
    
    // Get current time directly from wavesurfer instance for accuracy
    const centerTime = wavesurfer.getCurrentTime();
    const pxPerSec = 20 * targetZoomLevel;
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
  }, [wavesurfer, isReady, zoomLevel]);

  // Function to clear all regions
  const clearRegions = () => {
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
    
    // Also clean up any orphaned thumbs
    if (containerRef.current) {
      const orphanedThumbs = containerRef.current.querySelectorAll('.cue-thumb');
      orphanedThumbs.forEach((thumb: Element) => thumb.remove());
    }
  };

  // Function to create regions based on mode
  const createRegions = useCallback(() => {
    if (!wavesurfer || !isReady || !regionsPluginRef.current) return;

    clearRegions();

    if (mode === 'loop') {
      const region = regionsPluginRef.current.addRegion({
        start: loopStart,
        end: loopEnd,
        color: 'rgba(79, 70, 229, 0.2)',
        drag: true,
        resize: true,
        id: `loop-region-${trackId || 'default'}`,
        // Add visual styling for better interaction
        handleStyle: {
          left: {
            backgroundColor: 'rgba(79, 70, 229, 0.8)',
            border: '2px solid #4f46e5',
            borderRadius: '2px',
          },
          right: {
            backgroundColor: 'rgba(79, 70, 229, 0.8)',
            border: '2px solid #4f46e5',
            borderRadius: '2px',
          }
        }
      });

      region.on('update-end', () => {
        // Ensure the region bounds are valid
        const start = Math.max(0, region.start);
        const end = Math.max(start + 0.1, region.end);
        
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
      const newRegions = cuePoints.map((point, index) => {
        // Clamp start to [0, duration - epsilon]
        const clampedStart = Math.max(0, Math.min(point, duration - epsilon));
        // Ensure region end does not exceed duration
        const regionEnd = Math.min(clampedStart + 0.01, duration);
        const region = regionsPluginRef.current.addRegion({
          start: clampedStart,
          end: regionEnd,
          color: 'rgba(239, 68, 68, 0.3)',
          drag: true,
          resize: false,
          id: `cue-${trackId || 'default'}-${index}`,
          // Add visual styling for better interaction
          handleStyle: {
            left: {
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              border: '2px solid #ef4444',
              borderRadius: '2px',
            },
            right: {
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              border: '2px solid #ef4444',
              borderRadius: '2px',
            }
          }
        });

        // Only update the cue point and region position, do not recreate all regions
        region.on('update-end', () => {
          const cuePoint = region.start + (region.end - region.start) / 2;
          const clampedCuePoint = Math.max(0, Math.min(wavesurfer.getDuration(), cuePoint));
          debouncedUpdate(() => {
            onCuePointChangeRef.current(index, clampedCuePoint);
            const newCuePoints = [...prevCuePointsRef.current];
            newCuePoints[index] = clampedCuePoint;
            prevCuePointsRef.current = newCuePoints;
          });
        });

        // Add thumb after region is created
        if (showCueThumbs) {
          // Use a more reliable method to add thumb
          setTimeout(() => {
            addThumbToRegion(region, index);
          }, 100);
        }

        return region;
      });

      currentRegionsRef.current = newRegions;
    }
  }, [wavesurfer, isReady, mode, loopStart, loopEnd, cuePoints.length, trackId, showCueThumbs]);

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
    
    // Also remove any existing thumb elements in the region
    const existingThumbs = regionElement.querySelectorAll('.cue-thumb');
    existingThumbs.forEach((thumb: Element) => thumb.remove());

    // Create the hitbox
    const hitbox = document.createElement('div');
    hitbox.style.cssText = `
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 40px;
      cursor: grab;
      z-index: 31;
      pointer-events: auto;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create the visible node
    const thumb = document.createElement('div');
    thumb.className = 'cue-thumb';
    thumb.style.cssText = `
      width: 24px;
      height: 24px;
      background-color: #ef4444;
      border: 2px solid #dc2626;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: bold;
      pointer-events: none;
    `;

    thumb.textContent = index === 9 ? '0' : (index + 1).toString();

    hitbox.appendChild(thumb);
    regionElement.appendChild(hitbox);

    // Store reference to the hitbox (which contains the thumb) for cleanup
    region.thumbElement = hitbox;
  }, [trackId]);

  // Function to remove thumbs from regions
  const removeThumbsFromRegions = useCallback(() => {
    currentRegionsRef.current.forEach(region => {
      if (region.thumbElement) {
        region.thumbElement.remove();
        region.thumbElement = null;
      }
    });
    
    // Also remove any orphaned thumbs from the container
    if (containerRef.current) {
      const orphanedThumbs = containerRef.current.querySelectorAll('.cue-thumb');
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

  // Recreate regions when mode changes or when relevant parameters change
  useEffect(() => {
    if (!wavesurfer || !isReady || !initialSetupDoneRef.current) return;
    
    // Check if we need to update regions
    const modeChanged = prevModeRef.current !== mode;
    const needsUpdate = modeChanged || shouldUpdateRegions || 
      (mode === 'cue' && prevCuePointsRef.current.length !== cuePoints.length);
    
    if (needsUpdate) {
      createRegions();
      // Update all refs to prevent unnecessary recreations
      prevLoopStartRef.current = loopStart;
      prevLoopEndRef.current = loopEnd;
      prevCuePointsRef.current = [...cuePoints];
      prevModeRef.current = mode;
    }
  }, [wavesurfer, isReady, shouldUpdateRegions, cuePoints.length, mode, loopStart, loopEnd, cuePoints]);

  // Effect to handle initial setup when waveform becomes ready
  useEffect(() => {
    if (wavesurfer && isReady && !initialSetupDoneRef.current) {
      // Set initial zoom level
      const newMinPxPerSec = 20 * zoomLevel;
      wavesurfer.setOptions({ minPxPerSec: newMinPxPerSec });
      
      // Create initial regions
      createRegions();
      
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
      prevModeRef.current = mode;
    }
  }, [wavesurfer, isReady, zoomLevel, currentTime, playbackTime, loopStart, loopEnd, cuePoints, mode]);

  // Effect to handle zoom changes
  useEffect(() => {
    if (wavesurfer && isReady && initialSetupDoneRef.current) {
      const newMinPxPerSec = 20 * zoomLevel;
      wavesurfer.setOptions({ minPxPerSec: newMinPxPerSec });
      
      // Update container width to match new zoom level
      if (containerRef.current) {
        const duration = wavesurfer.getDuration();
        const newWidth = duration * newMinPxPerSec;
        containerRef.current.style.width = `${newWidth}px`;
      }
      
      // Use improved centering with small delay for layout updates
      setTimeout(() => centerPlayheadAfterZoom(zoomLevel), 10);
    }
  }, [zoomLevel, wavesurfer, isReady, centerPlayheadAfterZoom]);

  // Optimized playhead update with throttling
  useEffect(() => {
    if (!wavesurfer || !isReady) return;

    const now = performance.now();
    // Throttle updates to 30fps for smoother performance
    if (now - lastUpdateTimeRef.current < 33) return;

    wavesurfer.setTime(playbackTime);
    lastUpdateTimeRef.current = now;
  }, [playbackTime, wavesurfer, isReady]);

  // Handle explicit playhead updates (less frequent)
  useEffect(() => {
    if (wavesurfer && isReady && typeof playhead === 'number') {
      wavesurfer.setTime(playhead);
    }
  }, [playhead, wavesurfer, isReady]);

  useEffect(() => {
    if (wavesurfer && isReady && initialSetupDoneRef.current) {
      setInternalShowMeasures(showMeasures || false);
    }
  }, [showMeasures, wavesurfer, isReady]);

  return (
    <div className="w-full box-border overflow-hidden relative">
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-50 z-10">
          Loading waveform...
        </div>
      )}

      <div className={`transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
        <div 
          style={{ 
            overflowX: 'auto', 
            overflowY: 'hidden'
          }}
        >
          <div
            key={audioUrl || 'no-url'}
            ref={containerRef}
            className="w-full box-border"
            style={{ 
              height: '170px', 
              minWidth: '100%',
              position: 'relative'
            }}
          />
        </div>
        
        {/* Measure Display Overlay */}
        {isReady && wavesurfer && (
          <MeasureDisplay
            key={`measure-display-${trackId || 'default'}`}
            duration={wavesurfer.getDuration()}
            tempo={tempo}
            zoomLevel={zoomLevel}
            onFirstMeasureChange={onFirstMeasureChange || (() => {})}
            timeSignature={timeSignature}
            onTimeSignatureChange={onTimeSignatureChange || (() => {})}
            firstMeasureTime={firstMeasureTime}
            visible={internalShowMeasures}
          />
        )}
      </div>
    </div>
  );
};

const WaveformDisplayContainer = (props: WaveformDisplayProps) => {
  return (
     <div className="w-full relative box-border overflow-hidden bg-gray-50" style={{ height: '190px' }}>
       <WaveformDisplay {...props} />
     </div>
  );
}

export default WaveformDisplayContainer;