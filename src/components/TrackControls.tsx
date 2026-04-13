import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';
import { isIOSWebAudioTarget } from '../context/AudioContext';
import { useRecording } from '../context/RecordingContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { useUser } from '../hooks/useUser';
import { logRegionDragTransport } from '../utils/regionDragTransportDiag';

// Utility function to format cue point timestamps
const formatCueTimestamp = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 100);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

// Frequency filter logarithmic scale helpers (20Hz - 20kHz)
const FREQ_MIN = 20;
const FREQ_MAX = 20000;
const FREQ_RATIO = FREQ_MAX / FREQ_MIN; // 1000

const sliderToFreq = (sliderValue: number): number => {
  const t = sliderValue / 100; // 0-100 -> 0-1
  return FREQ_MIN * Math.pow(FREQ_RATIO, t);
};

const freqToSlider = (freq: number): number => {
  const clamped = Math.max(FREQ_MIN, Math.min(FREQ_MAX, freq));
  return 100 * (Math.log(clamped / FREQ_MIN) / Math.log(FREQ_RATIO));
};

const formatFreqDisplay = (freq: number): string => {
  return freq >= 1000 ? `${(freq / 1000).toFixed(1)}kHz` : `${Math.round(freq)}Hz`;
};

const formatVolumeDisplay = (vol: number): string => `${Math.round(vol * 100)}%`;

const formatSpeedDisplay = (s: number): string => `${s.toFixed(2)}x`;

const parseFreqInput = (input: string): number | null => {
  const trimmed = input.replace(/\s/g, '').toLowerCase();
  const match = trimmed.match(/^([\d.]+)\s*(hz|khz|k)?$/);
  if (!match) return null;
  let val = parseFloat(match[1]);
  if (Number.isNaN(val)) return null;
  const unit = match[2];
  if (unit === 'k' || unit === 'khz') val *= 1000;
  return Math.max(FREQ_MIN, Math.min(FREQ_MAX, val));
};

const parseVolumeInput = (input: string): number | null => {
  const trimmed = input.replace(/\s/g, '');
  const match = trimmed.match(/^([\d.]+)\s*%?$/);
  if (!match) return null;
  let val = parseFloat(match[1]);
  if (Number.isNaN(val)) return null;
  if (val > 1) val /= 100;
  return Math.max(0, Math.min(1, val));
};

const parseSpeedInput = (
  input: string,
  minSpeed: number,
  maxSpeed: number,
  trackTempo: number
): number | null => {
  const trimmed = input.replace(/\s/g, '').toLowerCase();
  const match = trimmed.match(/^([\d.]+)\s*(x|bpm)?$/);
  if (!match) return null;
  let val = parseFloat(match[1]);
  if (Number.isNaN(val)) return null;
  const unit = match[2];
  if (unit === 'bpm' && trackTempo > 0) {
    val = val / trackTempo;
  }
  return Math.max(minSpeed, Math.min(maxSpeed, val));
};

// Helper function to get current timestamp for a cue point (considering drag state)
const getCurrentCueTimestamp = (cuePoints: number[], cueDragState: { [index: number]: number } | null, index: number): number => {
  // If this cue point is being dragged, use the drag state value
  if (cueDragState && cueDragState[index] !== undefined) {
    return cueDragState[index];
  }
  // Otherwise use the actual cue point value
  return cuePoints[index] || 0;
};

// Slice end for One-Shot: next cue or track end; clamped to (sliceStart, duration]
const getSliceEnd = (cuePoints: number[], index: number, duration: number, sliceStart: number): number => {
  const rawEnd = index < cuePoints.length - 1 ? cuePoints[index + 1] : duration;
  const end = Math.min(duration, Math.max(sliceStart + 0.001, rawEnd));
  return end;
};

interface TrackControlsProps {
  mode: 'preview' | 'loop' | 'cue';
  audioContext: AudioContext | null;
  audioBuffer: AudioBuffer;
  loopStart: number;
  loopEnd: number;
  cuePoints: number[];
  /** Resolves to the AudioContext to use immediately (avoids stale null from props after first init). */
  ensureAudio: () => Promise<AudioContext | null>;
  /** iOS: HTMLAudio warm-up before WebAudio (see AudioContext). Optional reason string is for debug logs. */
  primeIosSessionForWebAudio?: (reason?: string) => Promise<void>;
  isSelected?: boolean;
  onSelect?: () => void;
  onPlaybackTimeChange?: (time: number) => void;
  onSpeedChange?: (speed: number) => void;
  trackTempo?: number;
  // Add volume props
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  // Add playback speed prop
  playbackSpeed?: number;
  // Add playback state callback
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  // Add external playback time prop
  playbackTime?: number;
  // Add disabled prop
  disabled?: boolean;
  // Add filter props
  filterEnabled?: boolean;
  onFilterEnabledChange?: (enabled: boolean) => void;
  lowpassFreq?: number;
  onLowpassFreqChange?: (freq: number) => void;
  highpassFreq?: number;
  onHighpassFreqChange?: (freq: number) => void;
  // Add delete button props
  showDeleteButton?: boolean;
  onDelete?: () => void;
  // Add recording props
  trackId?: string;
  // Seek function ref
  seekFunctionRef?: React.MutableRefObject<((seekTime: number) => void) | null>;
  // Toggle playback function ref (for global space bar trigger)
  togglePlaybackFunctionRef?: React.MutableRefObject<(() => void) | null>;
  /** Imperative stop when loop/cue region drag starts (Waveform first `update`); keeps resume ref in sync. */
  suspendTransportForRegionDragSyncRef?: React.MutableRefObject<(() => void) | null>;
  /**
   * When false (Studio main deck), loop/cue handle drags do not pause Web Audio transport.
   * Default true for demos or overlays that need drag to suspend deck playback.
   */
  pauseTransportOnRegionDrag?: boolean;
  // Recording destination for audio capture
  recordingDestination?: MediaStreamAudioDestinationNode | null;
  // Add drag state props for real-time timestamp updates
  cueDragState?: { [index: number]: number } | null;
  /** When dragging loop region, live (start, end) for display only. Playback uses loopStart/loopEnd. */
  loopDragState?: { start: number; end: number } | null;
  /** When mode is 'cue', how pads trigger playback. Default 'cue'. */
  chopTriggerStyle?: 'cue' | 'hold' | 'one-shot';
  /** When set, shows Cue / Hold / One-Shot next to Audio Filters & Cue Points toggles (chop mode). */
  onChopTriggerStyleChange?: (style: 'cue' | 'hold' | 'one-shot') => void;
}

const TrackControls = ({ 
  mode, 
  audioContext, 
  audioBuffer, 
  loopStart, 
  loopEnd, 
  loopDragState = null,
  cuePoints, 
  ensureAudio,
  primeIosSessionForWebAudio,
  isSelected = false,
  onSelect,
  onPlaybackTimeChange,
  onSpeedChange,
  trackTempo = 120,
  volume = 1,
  onVolumeChange,
  playbackSpeed = 1,
  onPlaybackStateChange,
  playbackTime,
  disabled = false,
  lowpassFreq,
  onLowpassFreqChange,
  highpassFreq,
  onHighpassFreqChange,
  showDeleteButton = false,
  onDelete,
  trackId,
  seekFunctionRef,
  togglePlaybackFunctionRef,
  suspendTransportForRegionDragSyncRef,
  pauseTransportOnRegionDrag = true,
  recordingDestination,
  cueDragState = null,
  chopTriggerStyle = 'cue',
  onChopTriggerStyleChange,
}: TrackControlsProps) => {
  const {
    addRecordingEvent,
    unarmedRecordingTrackIds,
    toggleRecordingArmForTrack,
    performances,
    startLanePlayback,
    stopPerformancePlayback,
    playingPerformanceId,
    engagedTrackIds,
  } = useRecording();
  const { trackEvent } = useAnalytics();
  const { tier } = useUser();
  const [speed, setSpeed] = useState(playbackSpeed);
  const [isPlaying, setIsPlaying] = useState(false);

  const perfForLane = useMemo(() => {
    if (!trackId) return null;
    return performances.find((p) => p.events.some((e) => e.trackId === trackId)) ?? null;
  }, [performances, trackId]);

  const isArmedForRecord = !trackId || !unarmedRecordingTrackIds.includes(trackId);
  const isLaneLoopPlaying = !!(
    trackId &&
    perfForLane &&
    playingPerformanceId === perfForLane.id &&
    engagedTrackIds.length === 1 &&
    engagedTrackIds[0] === trackId
  );

  // Reconnect audio sources when recording destination changes
  useEffect(() => {
    if (recordingDestination && audioSourceRef.current && isPlaying && audioContext) {
      // Create a separate gain node for recording
      const recordingGain = audioContext.createGain();
      recordingGain.gain.value = gainNodeRef.current?.gain.value || 1;
      
      // Connect the audio source to the recording gain
      audioSourceRef.current.connect(recordingGain);
      recordingGain.connect(recordingDestination);
    }
  }, [recordingDestination, isPlaying, trackId, audioContext, mode]);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeCueIndex, setActiveCueIndex] = useState<number | null>(null);
  
  // Filter state
  const [internalLowpassFreq, setInternalLowpassFreq] = useState(lowpassFreq || 20000);
  const [internalHighpassFreq, setInternalHighpassFreq] = useState(highpassFreq || 20);
  const [isFilterSectionExpanded, setIsFilterSectionExpanded] = useState(false);
  const [isCueSectionExpanded, setIsCueSectionExpanded] = useState(false);
  const [lowpassInputValue, setLowpassInputValue] = useState(formatFreqDisplay(lowpassFreq || 20000));
  const [highpassInputValue, setHighpassInputValue] = useState(formatFreqDisplay(highpassFreq || 20));
  const [volumeInputValue, setVolumeInputValue] = useState(() => formatVolumeDisplay(volume));
  const [speedInputValue, setSpeedInputValue] = useState(() => formatSpeedDisplay(playbackSpeed));
  const volumeInputFocusedRef = useRef(false);
  const speedInputFocusedRef = useRef(false);
  const lowpassInputFocusedRef = useRef(false);
  const highpassInputFocusedRef = useRef(false);
  
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const currentVolumeRef = useRef<number>(volume);
  const currentSpeedRef = useRef<number>(playbackSpeed);
  const activeCueIndexRef = useRef<number | null>(null);
  const cueStartTimeRef = useRef<number>(0);
  // Track the actual starting position when playback begins
  const playbackStartTimeRef = useRef<number>(0);
  
  // Track mode changes to handle audio source updates
  const prevModeRef = useRef<string>(mode);
  // Track loop point changes for mid-playback restart
  const prevLoopStartRef = useRef<number>(loopStart);
  const prevLoopEndRef = useRef<number>(loopEnd);
  
  // Filter refs
  const lowpassFilterRef = useRef<BiquadFilterNode | null>(null);
  const highpassFilterRef = useRef<BiquadFilterNode | null>(null);
  
  // Current filter value refs for reliable state access
  const currentLowpassFreqRef = useRef<number>(lowpassFreq || 20000);
  const currentHighpassFreqRef = useRef<number>(highpassFreq || 20);
  
  // Hold style: which pad triggered playback (for keyup/pointerup stop)
  const holdTriggeredByRef = useRef<number | null>(null);
  const stopChopPlaybackRef = useRef<() => void>(() => {});
  // Track when we're processing a seek to prevent interference from update loop
  const isSeekingRef = useRef<boolean>(false);
  // Track if current source is looping - avoids stale currentTime in updatePlaybackTime closure
  const isSourceLoopingRef = useRef<boolean>(false);
  const playCuePointRef = useRef<(index: number) => void>(() => {});
  /**
   * iOS: `AudioContext` can be `running` (e.g. after early resume) while WebAudio still
   * has no speaker route until HTMLMediaElement.play runs in a user gesture. Track prime
   * per context so we do not skip warm-up when state is already "running".
   */
  const iosStudioWebAudioPrimedRef = useRef(false);

  useEffect(() => {
    iosStudioWebAudioPrimedRef.current = false;
  }, [audioContext]);

  const ensureIosPrimeForStudioPlayback = useCallback(
    async (reason: string, resolvedContext?: AudioContext | null) => {
      const ctx = resolvedContext ?? audioContext;
      if (!primeIosSessionForWebAudio || !ctx) return;
      if (!isIOSWebAudioTarget()) return;
      const needsPrime =
        !iosStudioWebAudioPrimedRef.current ||
        ctx.state !== 'running';
      if (!needsPrime) return;
      await primeIosSessionForWebAudio(reason);
      iosStudioWebAudioPrimedRef.current = true;
    },
    [audioContext, primeIosSessionForWebAudio],
  );

  // Sync internal filter state with external props
  useEffect(() => {
    if (lowpassFreq !== undefined) {
      setInternalLowpassFreq(lowpassFreq);
      currentLowpassFreqRef.current = lowpassFreq;
    }
  }, [lowpassFreq]);

  useEffect(() => {
    if (highpassFreq !== undefined) {
      setInternalHighpassFreq(highpassFreq);
      currentHighpassFreqRef.current = highpassFreq;
    }
  }, [highpassFreq]);

  // Sync editable input values when props change (when not focused)
  useEffect(() => {
    if (!lowpassInputFocusedRef.current) {
      setLowpassInputValue(formatFreqDisplay(lowpassFreq ?? internalLowpassFreq ?? 20000));
    }
  }, [lowpassFreq, internalLowpassFreq]);

  useEffect(() => {
    if (!highpassInputFocusedRef.current) {
      setHighpassInputValue(formatFreqDisplay(highpassFreq ?? internalHighpassFreq ?? 20));
    }
  }, [highpassFreq, internalHighpassFreq]);

  useEffect(() => {
    if (!volumeInputFocusedRef.current) {
      setVolumeInputValue(formatVolumeDisplay(volume));
    }
  }, [volume]);

  useEffect(() => {
    if (!speedInputFocusedRef.current) {
      setSpeedInputValue(formatSpeedDisplay(speed));
    }
  }, [speed]);

  // Keep local speed + ref aligned with parent (e.g. restored session) so WebAudio uses the same rate as the UI.
  useEffect(() => {
    if (speedInputFocusedRef.current) return;
    setSpeed(playbackSpeed);
    currentSpeedRef.current = playbackSpeed;
    setSpeedInputValue(formatSpeedDisplay(playbackSpeed));
  }, [playbackSpeed]);

  // Calculate tempo-based speed range and step size
  const getTempoSpeedRange = useCallback(() => {
    const minTempo = Math.max(40, Math.round(trackTempo * 0.5)); // Half tempo, minimum 40 BPM
    const maxTempo = Math.min(300, Math.round(trackTempo * 2)); // Double tempo, maximum 300 BPM
    
    // Calculate step size to ensure ~1 BPM change per step
    // We want the step size to be approximately 1/trackTempo
    const stepSize = Math.max(0.001, Math.min(0.05, 1 / trackTempo));
    
    return { minTempo, maxTempo, stepSize };
  }, [trackTempo]);

  // Convert speed multiplier to tempo
  const speedToTempo = useCallback((speedMultiplier: number) => {
    return Math.round(trackTempo * speedMultiplier);
  }, [trackTempo]);

  // Get current effective tempo
  const getCurrentEffectiveTempo = useCallback(() => {
    return speedToTempo(speed);
  }, [speed, speedToTempo]);

  const FILTER_RAMP_DURATION = 0.03; // 30ms smooth transition

  // Filter control functions
  const handleLowpassFreqChange = useCallback((freq: number) => {
    const clampedFreq = Math.max(FREQ_MIN, Math.min(FREQ_MAX, freq));
    setInternalLowpassFreq(clampedFreq);
    currentLowpassFreqRef.current = clampedFreq;
    if (lowpassFilterRef.current && audioContext) {
      const now = audioContext.currentTime;
      lowpassFilterRef.current.frequency.setValueAtTime(
        lowpassFilterRef.current.frequency.value,
        now
      );
      lowpassFilterRef.current.frequency.exponentialRampToValueAtTime(
        clampedFreq,
        now + FILTER_RAMP_DURATION
      );
    }
    if (onLowpassFreqChange) {
      onLowpassFreqChange(clampedFreq);
    }
  }, [audioContext, onLowpassFreqChange]);

  const handleHighpassFreqChange = useCallback((freq: number) => {
    const clampedFreq = Math.max(FREQ_MIN, Math.min(FREQ_MAX, freq));
    setInternalHighpassFreq(clampedFreq);
    currentHighpassFreqRef.current = clampedFreq;
    if (highpassFilterRef.current && audioContext) {
      const now = audioContext.currentTime;
      highpassFilterRef.current.frequency.setValueAtTime(
        highpassFilterRef.current.frequency.value,
        now
      );
      highpassFilterRef.current.frequency.exponentialRampToValueAtTime(
        clampedFreq,
        now + FILTER_RAMP_DURATION
      );
    }
    if (onHighpassFreqChange) {
      onHighpassFreqChange(clampedFreq);
    }
  }, [audioContext, onHighpassFreqChange]);

  const handleLowpassInputBlur = useCallback(() => {
    lowpassInputFocusedRef.current = false;
    const parsed = parseFreqInput(lowpassInputValue);
    if (parsed !== null) {
      handleLowpassFreqChange(parsed);
      setLowpassInputValue(formatFreqDisplay(parsed));
    } else {
      setLowpassInputValue(formatFreqDisplay(lowpassFreq ?? internalLowpassFreq ?? 20000));
    }
  }, [lowpassInputValue, lowpassFreq, internalLowpassFreq, handleLowpassFreqChange]);

  const handleHighpassInputBlur = useCallback(() => {
    highpassInputFocusedRef.current = false;
    const parsed = parseFreqInput(highpassInputValue);
    if (parsed !== null) {
      handleHighpassFreqChange(parsed);
      setHighpassInputValue(formatFreqDisplay(parsed));
    } else {
      setHighpassInputValue(formatFreqDisplay(highpassFreq ?? internalHighpassFreq ?? 20));
    }
  }, [highpassInputValue, highpassFreq, internalHighpassFreq, handleHighpassFreqChange]);

  const handleVolumeInputBlur = useCallback(() => {
    volumeInputFocusedRef.current = false;
    const parsed = parseVolumeInput(volumeInputValue);
    if (parsed !== null && onVolumeChange) {
      onVolumeChange(parsed);
      if (trackId) {
        addRecordingEvent({
          type: 'volume_change',
          trackId,
          data: { oldVolume: volume, newVolume: parsed, mode },
        });
      }
      setVolumeInputValue(formatVolumeDisplay(parsed));
    } else {
      setVolumeInputValue(formatVolumeDisplay(volume));
    }
  }, [volumeInputValue, volume, onVolumeChange, trackId, addRecordingEvent, mode]);

  // Check if filters are actually active (have non-default values)
  const areFiltersActive = useCallback(() => {
    const lowpassFreq = internalLowpassFreq;
    const highpassFreq = internalHighpassFreq;
    return lowpassFreq < 20000 || highpassFreq > 20;
  }, [internalLowpassFreq, internalHighpassFreq]);

  // Helper function to create audio chain with current volume and speed
  const createAudioChainWithCurrentSettings = useCallback((resolvedContext?: AudioContext | null) => {
    const ac = resolvedContext ?? audioContext;
    if (!ac || !audioBuffer) return null;

    const currentVolume = currentVolumeRef.current;
    const currentSpeed = currentSpeedRef.current;

    const sourceNode = ac.createBufferSource();
    const gainNode = ac.createGain();
    
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = currentSpeed;
    gainNode.gain.value = currentVolume;
    
    // Always create filter nodes so real-time adjustments work from first playback.
    // Passthrough values (20Hz highpass, 20kHz lowpass) when "inactive" are sonically equivalent to no filter.
    const lowpassFreq = currentLowpassFreqRef.current;
    const highpassFreq = currentHighpassFreqRef.current;
    
    const lowpassFilter = ac.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.value = lowpassFreq;
    lowpassFilter.Q.value = 1;
    
    const highpassFilter = ac.createBiquadFilter();
    highpassFilter.type = 'highpass';
    highpassFilter.frequency.value = highpassFreq;
    highpassFilter.Q.value = 1;
    
    // Store filter refs for real-time updates
    lowpassFilterRef.current = lowpassFilter;
    highpassFilterRef.current = highpassFilter;
    
    // Connect: source -> highpass -> lowpass -> gain -> destination
    sourceNode.connect(highpassFilter);
    highpassFilter.connect(lowpassFilter);
    lowpassFilter.connect(gainNode);
    gainNode.connect(ac.destination);

    // Also connect to recording destination if available
    if (recordingDestination) {
      const recordingGain = ac.createGain();
      recordingGain.gain.value = gainNode.gain.value;
      lowpassFilter.connect(recordingGain);
      recordingGain.connect(recordingDestination);
    }
    
    return { sourceNode, gainNode, lowpassFilter, highpassFilter };
  }, [audioContext, audioBuffer, recordingDestination, trackId, mode]);

  // Optimized time update function using requestAnimationFrame
  const updatePlaybackTime = useCallback(() => {
    if (!isPlaying || !audioContext || !audioSourceRef.current) return;
    
    // Skip updates if we're currently processing a seek
    if (isSeekingRef.current) {
      animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
      return;
    }

    const now = performance.now();
    // Only update if at least 16ms has passed (roughly 60fps)
    if (now - lastUpdateTimeRef.current < 16) {
      animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
      return;
    }

    // Get the current playback time using getOutputTimestamp
    const timestamp = audioContext.getOutputTimestamp();
    const contextTime = timestamp.contextTime;
    
    if (contextTime) {
      // Calculate time since playback started
      const elapsed = contextTime - startTimeRef.current;
      
      // Get the current playback position from the source node
      const sourceNode = audioSourceRef.current;
      const playbackRate = sourceNode.playbackRate.value;
      
      if (mode === 'loop') {
        // For loop mode, calculate position within loop region
        const loopDuration = loopEnd - loopStart;
        // Use isSourceLoopingRef - currentTime (React state) is stale in this rAF callback
        const isOutsideLoop = !isSourceLoopingRef.current;

        if (isOutsideLoop) {
          // If outside loop region, continue from current position until we reach the loop
          const currentPlaybackTime = playbackStartTimeRef.current + (elapsed * playbackRate);
          // Clamp to duration instead of wrapping to 0 - keeps playhead at end when playing post-loop to finish
          const finalTime = Math.min(currentPlaybackTime, audioBuffer.duration);
          setCurrentTime(finalTime);
          if (onPlaybackTimeChange) {
            onPlaybackTimeChange(finalTime);
          }
          
          // Check if we just entered the loop region
          if (finalTime >= loopStart && finalTime <= loopEnd && audioSourceRef.current) {
            // We've entered the loop region, restart audio source with looping enabled
            const currentSourceNode = audioSourceRef.current;
            
            // Stop current source
            currentSourceNode.stop();
            
            // Create new audio chain with looping enabled
            const audioChain = createAudioChainWithCurrentSettings();
            if (audioChain) {
              const { sourceNode, gainNode, lowpassFilter, highpassFilter } = audioChain;
              
              // Enable looping
              sourceNode.loop = true;
              sourceNode.loopStart = loopStart;
              sourceNode.loopEnd = loopEnd;
              isSourceLoopingRef.current = true;

              // Start from the current position within the loop
              const positionInLoop = finalTime - loopStart;
              sourceNode.start(0, loopStart + positionInLoop);

              // Update refs
              audioSourceRef.current = sourceNode;
              gainNodeRef.current = gainNode;
              lowpassFilterRef.current = lowpassFilter;
              highpassFilterRef.current = highpassFilter;
              
              // Update start time for accurate position calculation
              startTimeRef.current = audioContext.currentTime;
              playbackStartTimeRef.current = loopStart + positionInLoop;
            }
          }
        } else {
          // If inside loop region, calculate position from actual start (handles mid-loop restarts)
          const rawPosition = playbackStartTimeRef.current + (elapsed * playbackRate);
          const offsetInLoop = ((rawPosition - loopStart) % loopDuration + loopDuration) % loopDuration;
          const position = loopStart + offsetInLoop;
          setCurrentTime(position);
          if (onPlaybackTimeChange) {
            onPlaybackTimeChange(position);
          }
        }
      } else {
        // For non-loop mode, calculate position from the actual starting position
        const currentPlaybackTime = playbackStartTimeRef.current + (elapsed * playbackRate);
        // Clamp to duration instead of wrapping - keeps playhead at end until source stops
        const finalTime = Math.min(currentPlaybackTime, audioBuffer.duration);
        setCurrentTime(finalTime);
        if (onPlaybackTimeChange) {
          onPlaybackTimeChange(finalTime);
        }
      }
    }
    
    lastUpdateTimeRef.current = now;
    animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
  }, [isPlaying, audioContext, audioBuffer.duration, onPlaybackTimeChange, mode, loopStart, loopEnd]);

  /** Best-effort audible playhead (for resuming after region-drag pause). */
  const getLivePlayheadSeconds = useCallback((): number | null => {
    if (!audioContext || !audioBuffer) return null;
    if (!audioSourceRef.current) {
      if (typeof playbackTime === 'number' && Number.isFinite(playbackTime)) return playbackTime;
      return currentTime;
    }
    const ts = audioContext.getOutputTimestamp();
    const contextTime = ts.contextTime ?? audioContext.currentTime;
    const elapsed = contextTime - startTimeRef.current;
    const sourceNode = audioSourceRef.current;
    const playbackRate = sourceNode.playbackRate.value;

    if (mode === 'loop') {
      if (!isSourceLoopingRef.current) {
        const currentPlaybackTime = playbackStartTimeRef.current + elapsed * playbackRate;
        return Math.min(Math.max(0, currentPlaybackTime), audioBuffer.duration);
      }
      const loopDuration = loopEnd - loopStart;
      if (loopDuration <= 0) return Math.max(0, Math.min(loopStart, audioBuffer.duration));
      const rawPosition = playbackStartTimeRef.current + elapsed * playbackRate;
      const offsetInLoop = ((rawPosition - loopStart) % loopDuration + loopDuration) % loopDuration;
      return Math.min(Math.max(0, loopStart + offsetInLoop), audioBuffer.duration);
    }
    const currentPlaybackTime = playbackStartTimeRef.current + elapsed * playbackRate;
    return Math.min(Math.max(0, currentPlaybackTime), audioBuffer.duration);
  }, [audioContext, audioBuffer, mode, loopStart, loopEnd, playbackTime, currentTime]);

  // Update refs when activeCueIndex changes
  useEffect(() => {
    activeCueIndexRef.current = activeCueIndex;
    if (activeCueIndex !== null && activeCueIndex < cuePoints.length) {
      cueStartTimeRef.current = cuePoints[activeCueIndex];
    }
  }, [activeCueIndex, cuePoints]);

  // Function to seek directly during playback (called by waveform clicks)
  const seekToTime = useCallback((seekTime: number) => {
    if (!isPlaying || !audioSourceRef.current || !audioContext || isSeekingRef.current) {
      return;
    }
    

    
    isSeekingRef.current = true;
    const currentSourceNode = audioSourceRef.current;
    
    // Stop current source
    currentSourceNode.stop();
    
    // Create new audio chain with current settings
    const audioChain = createAudioChainWithCurrentSettings();
    if (audioChain) {
      const { sourceNode, gainNode, lowpassFilter, highpassFilter } = audioChain;
      
      // Configure based on current mode and new position
      if (mode === 'loop') {
        const isWithinLoop = seekTime >= loopStart && seekTime <= loopEnd;
        
        if (isWithinLoop) {
          // If seeking within loop region, enable looping
          sourceNode.loop = true;
          sourceNode.loopStart = loopStart;
          sourceNode.loopEnd = loopEnd;
          isSourceLoopingRef.current = true;
          sourceNode.start(0, seekTime);
        } else {
          // If seeking outside loop region, don't loop yet
          sourceNode.loop = false;
          isSourceLoopingRef.current = false;
          sourceNode.start(0, seekTime);
        }
      } else {
        // Preview or cue mode - no looping
        sourceNode.loop = false;
        isSourceLoopingRef.current = false;
        sourceNode.start(0, seekTime);
      }
      
      // Update refs
      audioSourceRef.current = sourceNode;
      gainNodeRef.current = gainNode;
      lowpassFilterRef.current = lowpassFilter;
      highpassFilterRef.current = highpassFilter;
      
      // Update timing references for accurate position calculation
      startTimeRef.current = audioContext.currentTime;
      playbackStartTimeRef.current = seekTime;
      
      // Update current time state
      setCurrentTime(seekTime);
      
      // Clear seeking flag after a brief delay to ensure audio source has started
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 10);
    } else {
      isSeekingRef.current = false;
    }
  }, [isPlaying, audioContext, mode, loopStart, loopEnd]);

  // Expose seek function to parent component
  useEffect(() => {
    if (seekFunctionRef) {
      seekFunctionRef.current = seekToTime;
    }
  }, [seekToTime, seekFunctionRef]);

  // Sync external playback time with internal state when not playing
  useEffect(() => {
    if (!isPlaying && typeof playbackTime === 'number') {
      setCurrentTime(playbackTime);
    }
  }, [playbackTime, isPlaying]);

  // Handle mode changes during playback
  useEffect(() => {
    if (isPlaying && prevModeRef.current !== mode && audioSourceRef.current) {
      // Mode changed during playback, restart audio source with new mode settings
      const currentSourceNode = audioSourceRef.current;
      
      // Stop current source
      currentSourceNode.stop();
      
      // Create new audio chain with current settings
      const audioChain = createAudioChainWithCurrentSettings();
      if (audioChain) {
        const { sourceNode, gainNode, lowpassFilter, highpassFilter } = audioChain;
        
        // Configure based on new mode
        if (mode === 'loop') {
          // Check if current position is within or after the loop region
          const isWithinLoop = currentTime >= loopStart && currentTime <= loopEnd;
          const isAfterLoop = currentTime > loopEnd;
          
          if (isWithinLoop) {
            // If within loop region, enable looping
            sourceNode.loop = true;
            sourceNode.loopStart = loopStart;
            sourceNode.loopEnd = loopEnd;
            isSourceLoopingRef.current = true;
            sourceNode.start(0, currentTime);
            playbackStartTimeRef.current = currentTime;
          } else if (isAfterLoop) {
            // If after loop region, continue without looping
            sourceNode.loop = false;
            isSourceLoopingRef.current = false;
            sourceNode.start(0, currentTime);
            playbackStartTimeRef.current = currentTime;
          } else {
            // If before loop region, start from current position but prepare for looping
            sourceNode.loop = false; // Don't loop yet
            isSourceLoopingRef.current = false;
            sourceNode.start(0, currentTime);
            playbackStartTimeRef.current = currentTime;
          }
        } else {
          // Preview or cue mode - no looping
          sourceNode.loop = false;
          isSourceLoopingRef.current = false;
          sourceNode.start(0, currentTime);
          playbackStartTimeRef.current = currentTime;
        }
        
        // Update refs
        audioSourceRef.current = sourceNode;
        gainNodeRef.current = gainNode;
        lowpassFilterRef.current = lowpassFilter;
        highpassFilterRef.current = highpassFilter;
        
        // Update start time for accurate position calculation
        startTimeRef.current = audioContext?.currentTime || 0;
      }
    }
    
    // Update prevModeRef
    prevModeRef.current = mode;
  }, [mode, isPlaying, currentTime, loopStart, loopEnd, audioContext]);

  // Handle loop point changes during playback - must restart audio source
  // since BufferSourceNode loop region cannot be changed after creation.
  // NOTE: Do NOT include currentTime in deps - it updates every rAF and would cause
  // this effect to run 60+ times/sec, creating race conditions. We use refs for position.
  const LOOP_EPSILON = 0.015;
  useEffect(() => {
    const prevStart = prevLoopStartRef.current;
    const prevEnd = prevLoopEndRef.current;
    const startChanged = Math.abs(loopStart - prevStart) >= LOOP_EPSILON;
    const endChanged = Math.abs(loopEnd - prevEnd) >= LOOP_EPSILON;

    if (
      mode !== 'loop' ||
      !isPlaying ||
      !audioSourceRef.current ||
      !audioContext ||
      (!startChanged && !endChanged)
    ) {
      prevLoopStartRef.current = loopStart;
      prevLoopEndRef.current = loopEnd;
      return;
    }

    const currentSourceNode = audioSourceRef.current;
    if (!currentSourceNode || !audioContext) return;

    const playbackRate = currentSourceNode.playbackRate.value;
    const elapsed = audioContext.currentTime - startTimeRef.current;
    const currentPosition = playbackStartTimeRef.current + elapsed * playbackRate;

    let newStartPosition: number;
    if (currentPosition < loopStart) {
      newStartPosition = loopStart;
    } else if (currentPosition > loopEnd) {
      newStartPosition = loopStart;
    } else {
      newStartPosition = currentPosition;
    }

    currentSourceNode.stop();

    const audioChain = createAudioChainWithCurrentSettings();
    if (audioChain) {
      const { sourceNode, gainNode, lowpassFilter, highpassFilter } = audioChain;

      sourceNode.loop = true;
      sourceNode.loopStart = loopStart;
      sourceNode.loopEnd = loopEnd;
      isSourceLoopingRef.current = true;
      sourceNode.start(0, newStartPosition);

      audioSourceRef.current = sourceNode;
      gainNodeRef.current = gainNode;
      if (lowpassFilter) lowpassFilterRef.current = lowpassFilter;
      if (highpassFilter) highpassFilterRef.current = highpassFilter;

      startTimeRef.current = audioContext.currentTime;
      playbackStartTimeRef.current = newStartPosition;
      setCurrentTime(newStartPosition);
      if (onPlaybackTimeChange) {
        onPlaybackTimeChange(newStartPosition);
      }
    }

    prevLoopStartRef.current = loopStart;
    prevLoopEndRef.current = loopEnd;
  }, [mode, isPlaying, loopStart, loopEnd, audioContext, createAudioChainWithCurrentSettings, onPlaybackTimeChange]);

  // Start/stop time updates
  useEffect(() => {
    if (isPlaying) {
      lastUpdateTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updatePlaybackTime]);

  // Stop chop playback (Hold style release). Cleans up source, nodes, rAF, and clears hold ref. Defined early so effects below can depend on it.
  const stopChopPlayback = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (_) {}
      audioSourceRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (lowpassFilterRef.current) {
      lowpassFilterRef.current.disconnect();
      lowpassFilterRef.current = null;
    }
    if (highpassFilterRef.current) {
      highpassFilterRef.current.disconnect();
      highpassFilterRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    holdTriggeredByRef.current = null;
    setIsPlaying(false);
    if (onPlaybackStateChange) {
      onPlaybackStateChange(false);
    }
  }, [onPlaybackStateChange]);

  const prevRegionDragRef = useRef(false);
  const wasPlayingWhenRegionDragRef = useRef(false);
  /** When pausing for region drag, resume `togglePlayback` from this time (seconds). */
  const resumePlayheadAfterRegionDragRef = useRef<number | null>(null);

  /** Called from Waveform on first region `update` each gesture (WS7 has no `update-start`). */
  const suspendTransportForRegionDragSync = useCallback(() => {
    if (!pauseTransportOnRegionDrag) return;
    const active = isPlaying || !!audioSourceRef.current;
    wasPlayingWhenRegionDragRef.current = wasPlayingWhenRegionDragRef.current || active;
    if (active) {
      const t = getLivePlayheadSeconds();
      if (t != null && Number.isFinite(t)) {
        resumePlayheadAfterRegionDragRef.current = t;
      }
      stopChopPlayback();
    }
  }, [pauseTransportOnRegionDrag, isPlaying, stopChopPlayback, getLivePlayheadSeconds]);

  /** Stop Hold playback for this pad and optionally log `cue_release` (live performance only). */
  const endHoldAtCueIndex = useCallback(
    (cueIndex: number, recordRelease: boolean) => {
      if (holdTriggeredByRef.current !== cueIndex) return;
      stopChopPlayback();
      if (recordRelease && trackId) {
        addRecordingEvent({
          type: 'cue_release',
          trackId,
          data: { cueIndex, mode: 'cue' },
        });
      }
    },
    [trackId, addRecordingEvent, stopChopPlayback]
  );

  // Handle keyboard events for cue points
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Skip when user is typing in an input (volume, speed, filters, etc.)
      const active = document.activeElement;
      if (
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (
        active instanceof HTMLInputElement &&
        (active as HTMLInputElement).type !== 'range'
      ) {
        return;
      }

      // Only handle key presses if this is a cue track AND it's selected
      if (mode !== 'cue' || !isSelected) return;

      // Hold style: ignore key repeat so holding the key acts as a gate (play on first keydown, stop on keyup). Cue/One-Shot keep repeat = roll/retrigger.
      if (chopTriggerStyle === 'hold' && event.repeat) return;

      // Map number keys 1-0 to cue points
      const keyMap: { [key: string]: number } = {
        '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
        '6': 5, '7': 6, '8': 7, '9': 8, '0': 9
      };

      const cueIndex = keyMap[event.key];

      if (cueIndex !== undefined && cueIndex < cuePoints.length) {
        // One-Shot: don't trigger if this node is at or past the next (invalid slice)
        if (chopTriggerStyle === 'one-shot' && cueIndex < cuePoints.length - 1) {
          const curr = Number(cuePoints[cueIndex]);
          const next = Number(cuePoints[cueIndex + 1]);
          if (!Number.isNaN(curr) && !Number.isNaN(next) && curr >= next) return;
        }
        playCuePointRef.current(cueIndex);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [mode, isSelected, cuePoints, chopTriggerStyle, cueDragState]);

  // Keyup: stop Hold-style playback when the triggering key is released
  useEffect(() => {
    const handleKeyUp = (event: KeyboardEvent) => {
      if (mode !== 'cue' || chopTriggerStyle !== 'hold' || !isSelected) return;
      const keyMap: { [key: string]: number } = {
        '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
        '6': 5, '7': 6, '8': 7, '9': 8, '0': 9
      };
      const cueIndex = keyMap[event.key];
      if (cueIndex !== undefined) {
        endHoldAtCueIndex(cueIndex, true);
      }
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [mode, chopTriggerStyle, isSelected, endHoldAtCueIndex]);

  useEffect(() => {
    stopChopPlaybackRef.current = stopChopPlayback;
  }, [stopChopPlayback]);

  // Handle play/pause functionality
  const togglePlayback = async () => {
    try {
      // Stop path must run synchronously — do not await ensureAudio first or transport keeps
      // playing (and region-drag / space-to-pause feels delayed or ineffective).
      const shouldStop = isPlaying || !!audioSourceRef.current;
      if (shouldStop) {
        if (audioSourceRef.current) {
          try {
            audioSourceRef.current.stop();
          } catch (_) {
            /* already stopped */
          }
          audioSourceRef.current = null;
        }
        if (gainNodeRef.current) {
          gainNodeRef.current.disconnect();
          gainNodeRef.current = null;
        }
        if (lowpassFilterRef.current) {
          lowpassFilterRef.current.disconnect();
          lowpassFilterRef.current = null;
        }
        if (highpassFilterRef.current) {
          highpassFilterRef.current.disconnect();
          highpassFilterRef.current = null;
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        setIsPlaying(false);
        if (onPlaybackStateChange) {
          onPlaybackStateChange(false);
        }

        if (trackId && mode === 'loop') {
          addRecordingEvent({
            type: 'loop_stop',
            trackId,
            data: { mode }
          });
        }
        return;
      }

      const ctx = await ensureAudio();
      if (!ctx || !audioBuffer) return;

      await ensureIosPrimeForStudioPlayback('trackcontrols:toggle-play', ctx);

      // Start playback - create audio chain manually to ensure current volume and speed are applied
      const audioChain = createAudioChainWithCurrentSettings(ctx);
      if (!audioChain) return;

      const resumeSnap = resumePlayheadAfterRegionDragRef.current;
      resumePlayheadAfterRegionDragRef.current = null;

      const { sourceNode, gainNode, lowpassFilter, highpassFilter } = audioChain;

      if (mode === 'loop') {
        if (resumeSnap == null) {
          sourceNode.loop = true;
          sourceNode.loopStart = loopStart;
          sourceNode.loopEnd = loopEnd;
          isSourceLoopingRef.current = true;
          sourceNode.start(0, loopStart);
          playbackStartTimeRef.current = loopStart;
          setCurrentTime(loopStart);
        } else {
          const startFrom = Math.min(Math.max(0, resumeSnap), audioBuffer.duration);
          const within = startFrom >= loopStart && startFrom <= loopEnd;
          if (within) {
            sourceNode.loop = true;
            sourceNode.loopStart = loopStart;
            sourceNode.loopEnd = loopEnd;
            isSourceLoopingRef.current = true;
            sourceNode.start(0, startFrom);
            playbackStartTimeRef.current = startFrom;
          } else {
            sourceNode.loop = false;
            isSourceLoopingRef.current = false;
            sourceNode.start(0, startFrom);
            playbackStartTimeRef.current = startFrom;
          }
          setCurrentTime(startFrom);
          if (onPlaybackTimeChange) {
            onPlaybackTimeChange(startFrom);
          }
        }
      } else if (mode === 'cue' && activeCueIndex !== null) {
        const cueDefault = cuePoints[activeCueIndex];
        const startFrom =
          resumeSnap != null
            ? Math.min(Math.max(0, resumeSnap), audioBuffer.duration)
            : cueDefault;
        cueStartTimeRef.current = startFrom;
        isSourceLoopingRef.current = false;
        sourceNode.start(0, startFrom);
        playbackStartTimeRef.current = startFrom;
        setCurrentTime(startFrom);
        if (onPlaybackTimeChange) {
          onPlaybackTimeChange(startFrom);
        }
      } else {
        const startFrom =
          resumeSnap != null
            ? Math.min(Math.max(0, resumeSnap), audioBuffer.duration)
            : currentTime;
        isSourceLoopingRef.current = false;
        sourceNode.start(0, startFrom);
        playbackStartTimeRef.current = startFrom;
        setCurrentTime(startFrom);
        if (resumeSnap != null && onPlaybackTimeChange) {
          onPlaybackTimeChange(startFrom);
        }
      }

      audioSourceRef.current = sourceNode;
      gainNodeRef.current = gainNode;
      lowpassFilterRef.current = lowpassFilter;
      highpassFilterRef.current = highpassFilter;
      setIsPlaying(true);
      if (onPlaybackStateChange) {
        onPlaybackStateChange(true);
      }

      // Record loop play event
      if (trackId && mode === 'loop') {
        addRecordingEvent({
          type: 'loop_play',
          trackId,
          data: {
            mode,
            loopStart,
            loopEnd,
            currentTime: playbackStartTimeRef.current
          }
        });
      }
      startTimeRef.current = ctx.currentTime;

      // Start the animation frame loop for smooth updates
      lastUpdateTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);

      sourceNode.onended = () => {
        if (audioSourceRef.current === sourceNode) {
          setIsPlaying(false);
          audioSourceRef.current = null;
          gainNodeRef.current = null;
          if (lowpassFilterRef.current) {
            lowpassFilterRef.current.disconnect();
            lowpassFilterRef.current = null;
          }
          if (highpassFilterRef.current) {
            highpassFilterRef.current.disconnect();
            highpassFilterRef.current = null;
          }
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          if (onPlaybackStateChange) {
            onPlaybackStateChange(false);
          }
        }
      };
    } catch (error) {
      console.error('Error in togglePlayback:', error);
      setIsPlaying(false);
    }
  };

  // Expose togglePlayback to parent for global space bar trigger
  useEffect(() => {
    if (togglePlaybackFunctionRef) {
      togglePlaybackFunctionRef.current = togglePlayback;
    }
    return () => {
      if (togglePlaybackFunctionRef) {
        togglePlaybackFunctionRef.current = null;
      }
    };
  }, [togglePlaybackFunctionRef, togglePlayback]);

  useEffect(() => {
    if (!suspendTransportForRegionDragSyncRef) return;
    if (!pauseTransportOnRegionDrag) {
      suspendTransportForRegionDragSyncRef.current = null;
      return () => {
        suspendTransportForRegionDragSyncRef.current = null;
      };
    }
    suspendTransportForRegionDragSyncRef.current = suspendTransportForRegionDragSync;
    return () => {
      suspendTransportForRegionDragSyncRef.current = null;
    };
  }, [
    suspendTransportForRegionDragSyncRef,
    suspendTransportForRegionDragSync,
    pauseTransportOnRegionDrag,
  ]);

  // During cue or loop region drag, stop transport; on release resume if it was playing.
  // WaveformDisplay also calls suspendTransportForRegionDragSync on the first region `update`
  // so transport stops as soon as the gesture moves (before this effect runs).
  useEffect(() => {
    const cueDragging = cueDragState != null && Object.keys(cueDragState).length > 0;
    const loopDragging = loopDragState != null;
    const dragging = cueDragging || loopDragging;
    const wasDragging = prevRegionDragRef.current;

    if (!pauseTransportOnRegionDrag) {
      prevRegionDragRef.current = dragging;
      return;
    }

    if (dragging && !wasDragging) {
      const transportWasActive = isPlaying || !!audioSourceRef.current;
      wasPlayingWhenRegionDragRef.current =
        wasPlayingWhenRegionDragRef.current || transportWasActive;
      if (transportWasActive && audioSourceRef.current) {
        const t = getLivePlayheadSeconds();
        if (t != null && Number.isFinite(t)) {
          resumePlayheadAfterRegionDragRef.current = t;
        }
      }
      logRegionDragTransport('TrackControls region-drag effect: drag start → stopChopPlayback', {
        trackId: trackId ?? '(no trackId)',
        cueDragging,
        loopDragging,
        isPlaying,
        hadAudioSource: !!audioSourceRef.current,
        willResumeAfter: wasPlayingWhenRegionDragRef.current,
      });
      stopChopPlayback();
    } else if (!dragging && wasDragging) {
      if (wasPlayingWhenRegionDragRef.current) {
        logRegionDragTransport('TrackControls region-drag effect: drag end → resume togglePlayback', {
          trackId: trackId ?? '(no trackId)',
        });
        void togglePlayback();
      } else {
        resumePlayheadAfterRegionDragRef.current = null;
        logRegionDragTransport('TrackControls region-drag effect: drag end (no resume)', {
          trackId: trackId ?? '(no trackId)',
        });
      }
      wasPlayingWhenRegionDragRef.current = false;
    }
    prevRegionDragRef.current = dragging;
  }, [pauseTransportOnRegionDrag, cueDragState, loopDragState, isPlaying, stopChopPlayback, togglePlayback, getLivePlayheadSeconds]);

  type PlayCuePointOptions = {
    chopTriggerStyle?: 'cue' | 'hold' | 'one-shot';
    /** When false (e.g. performance replay), do not append a recording event */
    recordEvent?: boolean;
  };

  // Play from a specific cue point (behavior depends on chopTriggerStyle)
  const playCuePoint = async (index: number, options?: PlayCuePointOptions) => {
    if (!audioBuffer || index >= cuePoints.length) {
      return;
    }

    const style = options?.chopTriggerStyle ?? chopTriggerStyle;
    const cueTime = getCurrentCueTimestamp(cuePoints, cueDragState, index);

    // One-Shot: invalid trigger if this node is at or past the next node (no valid slice)
    if (style === 'one-shot' && index < cuePoints.length - 1) {
      const currNum = Number(cuePoints[index]);
      const nextNum = Number(cuePoints[index + 1]);
      if (!Number.isNaN(currNum) && !Number.isNaN(nextNum) && currNum >= nextNum) return;
    }

    try {
      const ctx = await ensureAudio();
      if (!ctx) return;
      await ensureIosPrimeForStudioPlayback('trackcontrols:play-cue-point', ctx);

      // Stop current playback if any (monophonic per track)
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
      if (lowpassFilterRef.current) {
        lowpassFilterRef.current.disconnect();
        lowpassFilterRef.current = null;
      }
      if (highpassFilterRef.current) {
        highpassFilterRef.current.disconnect();
        highpassFilterRef.current = null;
      }

      activeCueIndexRef.current = index;
      cueStartTimeRef.current = cueTime;

      const audioChain = createAudioChainWithCurrentSettings(ctx);
      if (!audioChain) return;

      const { sourceNode, gainNode, lowpassFilter, highpassFilter } = audioChain;
      const playbackRate = currentSpeedRef.current;

      audioSourceRef.current = sourceNode;
      gainNodeRef.current = gainNode;
      lowpassFilterRef.current = lowpassFilter;
      highpassFilterRef.current = highpassFilter;
      isSourceLoopingRef.current = false;
      startTimeRef.current = ctx.currentTime;

      if (style === 'one-shot') {
        const sliceStart = cueTime;
        const sliceEnd = getSliceEnd(cuePoints, index, audioBuffer.duration, sliceStart);
        const durationSec = (sliceEnd - sliceStart) / playbackRate;
        sourceNode.start(0, sliceStart);
        sourceNode.stop(ctx.currentTime + durationSec);
        playbackStartTimeRef.current = sliceStart;
      } else {
        // Cue or Hold: play from cue to end of buffer
        sourceNode.start(0, cueTime);
        playbackStartTimeRef.current = cueTime;
        if (style === 'hold') {
          holdTriggeredByRef.current = index;
        }
      }

      // React updates after BufferSource.start so touch/press isn't blocked by main-thread work (especially on mobile).
      setActiveCueIndex(index);
      setCurrentTime(cueTime);
      if (onPlaybackTimeChange) {
        onPlaybackTimeChange(cueTime);
      }

      setIsPlaying(true);
      if (onPlaybackStateChange) {
        onPlaybackStateChange(true);
      }

      lastUpdateTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
      
      const shouldRecord = options?.recordEvent !== false;
      if (trackId && shouldRecord) {
        addRecordingEvent({
          type: 'cue_trigger',
          trackId,
          data: {
            cueIndex: index,
            cueTime,
            mode,
            chopTriggerStyle: style
          }
        });
        trackEvent('cue_triggered', { cueIndex: index, trackId, userTier: (tier?.id ?? 'guest') as 'guest' | 'free' | 'pro' });
      }
      
      sourceNode.onended = () => {
        if (audioSourceRef.current === sourceNode) {
          holdTriggeredByRef.current = null;
          setIsPlaying(false);
          audioSourceRef.current = null;
          gainNodeRef.current = null;
          if (lowpassFilterRef.current) {
            lowpassFilterRef.current.disconnect();
            lowpassFilterRef.current = null;
          }
          if (highpassFilterRef.current) {
            highpassFilterRef.current.disconnect();
            highpassFilterRef.current = null;
          }
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          if (onPlaybackStateChange) {
            onPlaybackStateChange(false);
          }
        }
      };
    } catch (error) {
      console.error('Error in playCuePoint:', error);
      setIsPlaying(false);
      holdTriggeredByRef.current = null;
    }
  };

  useEffect(() => {
    playCuePointRef.current = playCuePoint;
  });

  // Update volume when it changes
  useEffect(() => {
    currentVolumeRef.current = volume;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);
  
  // Handle speed slider changes - resets playhead anchor when rate changes during playback
  const handleSpeedSliderChange = useCallback((newSpeed: number, recordEvent: boolean) => {
    const oldSpeed = currentSpeedRef.current;
    setSpeed(newSpeed);
    currentSpeedRef.current = newSpeed;

    // When speed changes during playback, reset the playhead anchor so the time calculation
    // stays correct (the formula assumes constant rate since start)
    if (isPlaying && audioContext && audioSourceRef.current) {
      const timestamp = audioContext.getOutputTimestamp();
      const contextTime = timestamp.contextTime ?? audioContext.currentTime;
      if (typeof contextTime === 'number') {
        const elapsed = contextTime - startTimeRef.current;
        const rawPosition = playbackStartTimeRef.current + (elapsed * oldSpeed);
        playbackStartTimeRef.current = rawPosition;
        startTimeRef.current = contextTime;
      }
    }

    // Apply playback rate immediately for real-time feedback
    if (audioSourceRef.current) {
      audioSourceRef.current.playbackRate.value = newSpeed;
    }
    if (onSpeedChange) onSpeedChange(newSpeed);

    if (recordEvent && trackId) {
      addRecordingEvent({
        type: 'speed_change',
        trackId,
        data: { oldSpeed, newSpeed, mode },
      });
    }
  }, [isPlaying, audioContext, onSpeedChange, trackId, addRecordingEvent, mode]);

  const handleSpeedInputBlur = useCallback(() => {
    speedInputFocusedRef.current = false;
    const range = getTempoSpeedRange();
    const minSpeed = range.minTempo / trackTempo;
    const maxSpeed = range.maxTempo / trackTempo;
    const parsed = parseSpeedInput(speedInputValue, minSpeed, maxSpeed, trackTempo);
    if (parsed !== null) {
      handleSpeedSliderChange(parsed, true);
      setSpeedInputValue(formatSpeedDisplay(parsed));
    } else {
      setSpeedInputValue(formatSpeedDisplay(speed));
    }
  }, [speedInputValue, speed, getTempoSpeedRange, trackTempo, handleSpeedSliderChange]);

  // Update playback rate when speed changes (e.g. from external prop sync)
  useEffect(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.playbackRate.value = currentSpeedRef.current;
    }
  }, [speed]);

  useEffect(() => {
    const handlePerformancePlaybackEvent = (evt: Event) => {
      const customEvent = evt as CustomEvent<PerformanceEvent>;
      const playbackEvent = customEvent.detail;
      if (!playbackEvent || !trackId || playbackEvent.trackId !== trackId) return;

      if (playbackEvent.type === 'cue_trigger' && mode === 'cue') {
        const data = playbackEvent.data;
        const recordedStyle = data.chopTriggerStyle;
        const styleOverride =
          recordedStyle && ['cue', 'hold', 'one-shot'].includes(recordedStyle)
            ? recordedStyle
            : undefined;
        void playCuePointRef.current?.(data.cueIndex, {
          chopTriggerStyle: styleOverride,
          recordEvent: false,
        });
        return;
      }

      if (playbackEvent.type === 'cue_release' && mode === 'cue') {
        const idx = playbackEvent.data.cueIndex;
        if (holdTriggeredByRef.current === idx) {
          stopChopPlaybackRef.current();
        }
        return;
      }

      if (playbackEvent.type === 'loop_play' && mode === 'loop' && !isPlaying) {
        togglePlayback();
        return;
      }

      if (playbackEvent.type === 'loop_stop' && mode === 'loop' && isPlaying) {
        togglePlayback();
        return;
      }

      if (playbackEvent.type === 'volume_change') {
        onVolumeChange?.(playbackEvent.data.newVolume);
        return;
      }

      if (playbackEvent.type === 'speed_change') {
        handleSpeedSliderChange(playbackEvent.data.newSpeed, false);
      }
    };

    const handlePlaybackStop = () => {
      if (!isPlaying) return;
      if (mode === 'loop') {
        void togglePlayback();
        return;
      }
      if (mode === 'cue') {
        stopChopPlaybackRef.current();
      }
    };

    window.addEventListener('audafact-performance-playback-event', handlePerformancePlaybackEvent as EventListener);
    window.addEventListener('audafact-performance-playback-stop', handlePlaybackStop as EventListener);
    return () => {
      window.removeEventListener('audafact-performance-playback-event', handlePerformancePlaybackEvent as EventListener);
      window.removeEventListener('audafact-performance-playback-stop', handlePlaybackStop as EventListener);
    };
  }, [trackId, mode, isPlaying, onVolumeChange, handleSpeedSliderChange]);


  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
      }
      if (lowpassFilterRef.current) {
        lowpassFilterRef.current.disconnect();
      }
      if (highpassFilterRef.current) {
        highpassFilterRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className={`audafact-card p-2 md:p-4 space-y-2 md:space-y-4 ${disabled ? 'opacity-50' : ''}`}>
      {/* Playback Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <button
            onClick={togglePlayback}
            disabled={disabled}
            className={`p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan transition-colors duration-200 ${
              disabled 
                ? 'bg-audafact-text-secondary text-audafact-bg-primary cursor-not-allowed' 
                : 'bg-audafact-accent-cyan text-audafact-bg-primary hover:bg-opacity-90'
            }`}
            data-testid="play-button"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {/* Display current playback time and duration */}
          <div className="text-center text-xs audafact-text-secondary">
            {currentTime.toFixed(2)}s / {audioBuffer.duration.toFixed(2)}s
          </div>
          
          {mode === 'loop' && (
            <div className="text-xs md:text-sm audafact-text-secondary">
              Loop: {(loopDragState ?? { start: loopStart, end: loopEnd }).start.toFixed(2)}s - {(loopDragState ?? { start: loopStart, end: loopEnd }).end.toFixed(2)}s
            </div>
          )}
        </div>

        {mode === 'cue' && (
          <div className="flex items-center space-x-3">
            {isSelected && (
              <div className="text-xs audafact-text-secondary hidden md:block">
                Press 1-0 keys to trigger cues
              </div>
            )}
            <button
              onClick={onSelect}
              disabled={disabled}
              className={`px-2 py-0.5 text-xs rounded-sm md:px-3 md:py-1 md:text-sm transition-colors duration-200 ${
                disabled
                  ? 'bg-audafact-surface-2 text-audafact-text-secondary cursor-not-allowed' 
                  : isSelected 
                    ? 'bg-audafact-alert-red text-audafact-text-primary' 
                    : 'bg-audafact-surface-2 text-audafact-text-secondary hover:bg-audafact-divider hover:text-audafact-text-primary'
              }`}
            >
              <span className="md:hidden">{isSelected ? 'Selected' : 'Select'}</span>
              <span className="hidden md:inline">{isSelected ? 'Selected to Cue' : 'Select to Cue'}</span>
            </button>
          </div>
        )}
      </div>

      {trackId && (
        <div className="flex flex-wrap items-center gap-2 py-1.5 border-t border-audafact-divider/60">
          <span className="text-[10px] uppercase tracking-wide audafact-text-secondary">Performance</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => toggleRecordingArmForTrack(trackId)}
            className={`px-2 py-0.5 rounded text-xs border transition-colors ${
              isArmedForRecord
                ? 'border-audafact-accent-cyan text-audafact-accent-cyan'
                : 'border-audafact-divider audafact-text-secondary'
            }`}
            title={isArmedForRecord ? 'Events from this track will be logged when recording' : 'This lane is muted for new events'}
          >
            {isArmedForRecord ? 'Armed' : 'Muted'}
          </button>
          {perfForLane && (
            <button
              type="button"
              disabled={disabled}
              onClick={async () => {
                if (isLaneLoopPlaying) {
                  stopPerformancePlayback();
                  return;
                }
                await startLanePlayback(perfForLane.id, trackId, { loop: true });
              }}
              className="px-2 py-0.5 rounded text-xs border border-audafact-divider audafact-text-secondary hover:bg-audafact-surface-2"
              title="Loop replay for this track only (event playback)"
            >
              {isLaneLoopPlaying ? 'Stop loop' : 'Loop lane'}
            </button>
          )}
        </div>
      )}

      {/* Volume and Speed Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
        {/* Volume Control */}
        <div className="space-y-2">
          <label className="text-xs md:text-sm font-medium audafact-heading">Volume</label>
          <div className="flex items-center space-x-3">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              disabled={disabled}
              onChange={(e) => {
                if (disabled) return;
                const newVolume = parseFloat(e.target.value);
                if (onVolumeChange) onVolumeChange(newVolume);
                
                // Record volume change event
                if (trackId) {
                  addRecordingEvent({
                    type: 'volume_change',
                    trackId,
                    data: { 
                      oldVolume: volume,
                      newVolume,
                      mode
                    }
                  });
                }
              }}
              className={`flex-1 h-1.5 md:h-2 bg-audafact-surface-2 rounded-lg appearance-none cursor-pointer slider ${
                disabled ? 'cursor-not-allowed opacity-50' : ''
              }`}
            />
            <input
              type="text"
              value={volumeInputValue}
              onChange={(e) => setVolumeInputValue(e.target.value)}
              onFocus={() => { volumeInputFocusedRef.current = true; }}
              onBlur={() => handleVolumeInputBlur()}
              onKeyDown={(e) => e.key === 'Enter' && handleVolumeInputBlur()}
              disabled={disabled}
              className="w-10 md:w-12 px-1.5 py-0.5 text-xs bg-audafact-surface-2 border border-audafact-divider rounded text-audafact-text-primary focus:outline-none focus:border-audafact-accent-cyan audafact-text-secondary"
              aria-label="Volume"
            />
          </div>
        </div>

        {/* Speed Control */}
        <div className="space-y-2">
          <label className="text-xs md:text-sm font-medium audafact-heading">
            <span className="md:hidden">Speed: {speed.toFixed(2)}x</span>
            <span className="hidden md:inline">Playback Speed: {speed.toFixed(2)}x</span>
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="range"
              min={getTempoSpeedRange().minTempo / trackTempo}
              max={getTempoSpeedRange().maxTempo / trackTempo}
              step={getTempoSpeedRange().stepSize}
              value={speed}
              disabled={disabled}
              onInput={(e) => {
                if (disabled) return;
                const newSpeed = parseFloat((e.target as HTMLInputElement).value);
                handleSpeedSliderChange(newSpeed, false);
              }}
              onChange={(e) => {
                // onChange fires on release in some browsers; ensure recording and final sync
                if (disabled) return;
                const newSpeed = parseFloat(e.target.value);
                handleSpeedSliderChange(newSpeed, true);
              }}
              className={`flex-1 h-1.5 md:h-2 bg-audafact-surface-2 rounded-lg appearance-none cursor-pointer slider ${
                disabled ? 'cursor-not-allowed opacity-50' : ''
              }`}
            />
            <input
              type="text"
              value={speedInputValue}
              onChange={(e) => setSpeedInputValue(e.target.value)}
              onFocus={() => { speedInputFocusedRef.current = true; }}
              onBlur={() => handleSpeedInputBlur()}
              onKeyDown={(e) => e.key === 'Enter' && handleSpeedInputBlur()}
              disabled={disabled}
              className="w-14 md:w-16 px-1.5 py-0.5 text-xs bg-audafact-surface-2 border border-audafact-divider rounded text-audafact-text-primary focus:outline-none focus:border-audafact-accent-cyan audafact-text-secondary"
              aria-label="Playback speed"
              title={`${getCurrentEffectiveTempo()} BPM`}
            />
          </div>
        </div>
      </div>

      {/* Filter Controls + Cue section toggle (chop mode) */}
      <div className="space-y-3">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-y-2 gap-x-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFilterSectionExpanded(!isFilterSectionExpanded)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium audafact-text-secondary bg-audafact-surface-1 border border-audafact-divider rounded hover:bg-audafact-surface-2 transition-colors duration-200"
              title={isFilterSectionExpanded ? 'Collapse audio filters' : 'Expand audio filters'}
            >
              <span>Audio Filters {areFiltersActive() && <span className="text-audafact-accent-cyan">●</span>}</span>
              <svg
                className={`w-3 h-3 transition-transform ${isFilterSectionExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {mode === 'cue' && (
              <button
                type="button"
                onClick={() => setIsCueSectionExpanded(!isCueSectionExpanded)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium audafact-text-secondary bg-audafact-surface-1 border border-audafact-divider rounded hover:bg-audafact-surface-2 transition-colors duration-200"
                title={isCueSectionExpanded ? 'Collapse cue pads' : 'Expand cue pads'}
              >
                <span>Cue Points</span>
                <svg
                  className={`w-3 h-3 transition-transform ${isCueSectionExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
          {((mode === 'cue' && onChopTriggerStyleChange) || (showDeleteButton && onDelete)) && (
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              {mode === 'cue' && onChopTriggerStyleChange && (
                <>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-audafact-text-secondary sm:text-xs sm:normal-case sm:tracking-normal">
                    Trigger
                  </span>
                  <div className="flex shrink-0 items-center rounded-md border border-audafact-divider bg-audafact-surface-2 p-0.5">
                    {(['cue', 'hold', 'one-shot'] as const).map((style) => {
                      const locked = style !== 'cue' && tier.id === 'guest';
                      return (
                        <button
                          key={style}
                          type="button"
                          onClick={() => onChopTriggerStyleChange(style)}
                          title={
                            locked
                              ? 'Sign up to unlock Hold and One-Shot modes'
                              : style === 'cue'
                                ? 'Jump to cue and continue'
                                : style === 'hold'
                                  ? 'Play while held'
                                  : 'Play slice once'
                          }
                          className={`rounded px-1.5 py-1 text-[11px] font-medium transition-colors sm:px-2 sm:py-1 sm:text-xs ${
                            chopTriggerStyle === style
                              ? 'bg-audafact-alert-red text-audafact-text-primary shadow-sm'
                              : locked
                                ? 'text-audafact-text-secondary opacity-50 hover:opacity-80'
                                : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                          }`}
                        >
                          {style === 'one-shot' ? 'One-Shot' : style.charAt(0).toUpperCase() + style.slice(1)}
                          {locked ? ' 🔒' : ''}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {showDeleteButton && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex shrink-0 items-center gap-1 px-2 py-1 text-xs font-medium audafact-text-secondary hover:text-audafact-red hover:bg-audafact-surface-2 border border-audafact-divider rounded transition-colors duration-200"
                  title="Delete Track"
                >
                  <span>Delete</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {isFilterSectionExpanded && (
          <div className="p-4 border-b bg-audafact-surface-1">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium audafact-heading">
                    Low Pass Filter: {formatFreqDisplay(lowpassFreq || 20000)}
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={freqToSlider(lowpassFreq || 20000)}
                    disabled={disabled}
                    onInput={(e) => {
                      if (disabled) return;
                      const freq = sliderToFreq(parseFloat((e.target as HTMLInputElement).value));
                      handleLowpassFreqChange(freq);
                    }}
                    onChange={(e) => {
                      if (disabled) return;
                      const freq = sliderToFreq(parseFloat(e.target.value));
                      handleLowpassFreqChange(freq);
                    }}
                    className={`flex-1 h-2 bg-audafact-surface-2 rounded-lg appearance-none cursor-pointer slider ${
                      disabled ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                  />
                  <input
                    type="text"
                    value={lowpassInputValue}
                    onChange={(e) => setLowpassInputValue(e.target.value)}
                    onFocus={() => { lowpassInputFocusedRef.current = true; }}
                    onBlur={() => handleLowpassInputBlur()}
                    onKeyDown={(e) => e.key === 'Enter' && handleLowpassInputBlur()}
                    disabled={disabled}
                    className="w-16 px-2 py-0.5 text-xs bg-audafact-surface-2 border border-audafact-divider rounded text-audafact-text-primary focus:outline-none focus:border-audafact-accent-cyan"
                    aria-label="Low pass frequency"
                  />
                </div>
                <div className="flex justify-between text-xs audafact-text-secondary">
                  <span>20Hz</span>
                  <span>20kHz</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium audafact-heading">
                    High Pass Filter: {formatFreqDisplay(highpassFreq || 20)}
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={freqToSlider(highpassFreq || 20)}
                    disabled={disabled}
                    onInput={(e) => {
                      if (disabled) return;
                      const freq = sliderToFreq(parseFloat((e.target as HTMLInputElement).value));
                      handleHighpassFreqChange(freq);
                    }}
                    onChange={(e) => {
                      if (disabled) return;
                      const freq = sliderToFreq(parseFloat(e.target.value));
                      handleHighpassFreqChange(freq);
                    }}
                    className={`flex-1 h-2 bg-audafact-surface-2 rounded-lg appearance-none cursor-pointer slider ${
                      disabled ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                  />
                  <input
                    type="text"
                    value={highpassInputValue}
                    onChange={(e) => setHighpassInputValue(e.target.value)}
                    onFocus={() => { highpassInputFocusedRef.current = true; }}
                    onBlur={() => handleHighpassInputBlur()}
                    onKeyDown={(e) => e.key === 'Enter' && handleHighpassInputBlur()}
                    disabled={disabled}
                    className="w-16 px-2 py-0.5 text-xs bg-audafact-surface-2 border border-audafact-divider rounded text-audafact-text-primary focus:outline-none focus:border-audafact-accent-cyan"
                    aria-label="High pass frequency"
                  />
                </div>
                <div className="flex justify-between text-xs audafact-text-secondary">
                  <span>20Hz</span>
                  <span>20kHz</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cue pads: below filters when both expanded; order unchanged vs previous always-visible block */}
        {mode === 'cue' && isCueSectionExpanded && (
          <div>
          {/* First row: 1-5 (indexes 0-4) */}
          <div className="grid grid-cols-5 gap-0.5 md:gap-1 mb-1">
            {cuePoints.slice(0, 5).map((_, index) => {
              const currentTimestamp = getCurrentCueTimestamp(cuePoints, cueDragState, index);
              const isHold = chopTriggerStyle === 'hold';
              // One-Shot: invalid as trigger if this node is at or past the next node (coerce to number for JSON/string values)
              const currNum = Number(cuePoints[index]);
              const nextNum = index < cuePoints.length - 1 ? Number(cuePoints[index + 1]) : NaN;
              const isOneShotInvalidTrigger = chopTriggerStyle === 'one-shot' && !Number.isNaN(nextNum) && currNum >= nextNum;
              return (
                <button
                  key={`cue-top-${index}`}
                  type="button"
                  onPointerDown={() => !disabled && !isOneShotInvalidTrigger && playCuePoint(index)}
                  onPointerUp={isHold ? () => endHoldAtCueIndex(index, true) : undefined}
                  onPointerLeave={isHold ? () => endHoldAtCueIndex(index, true) : undefined}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{ WebkitTouchCallout: 'none' }}
                  disabled={disabled}
                  title={isOneShotInvalidTrigger ? 'Invalid One-Shot start (past next node)' : undefined}
                  className={`h-12 md:h-14 text-[10px] md:text-xs py-1 md:py-1.5 px-1 rounded-sm md:rounded transition-colors duration-200 flex flex-col items-center justify-center touch-manipulation select-none ${
                    disabled
                      ? 'bg-audafact-surface-2 text-audafact-text-secondary cursor-not-allowed'
                      : isOneShotInvalidTrigger
                        ? 'bg-audafact-surface-2 text-audafact-text-secondary opacity-50 cursor-default'
                        : activeCueIndex === index
                          ? 'bg-audafact-alert-red text-audafact-text-primary'
                          : 'bg-audafact-surface-2 hover:bg-audafact-divider text-audafact-text-secondary hover:text-audafact-text-primary'
                  }`}
                >
                  <span className="font-medium">{index + 1}</span>
                  <span className="text-[8px] md:text-[9px] opacity-75 leading-tight">
                    {formatCueTimestamp(currentTimestamp)}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Second row: 6-0 (indexes 5-9, label 10th as 0) */}
          <div className="grid grid-cols-5 gap-0.5 md:gap-1">
            {cuePoints.slice(5, 10).map((_, idx) => {
              const index = idx + 5;
              const label = index === 9 ? '0' : String(index + 1);
              const currentTimestamp = getCurrentCueTimestamp(cuePoints, cueDragState, index);
              const isHold = chopTriggerStyle === 'hold';
              // One-Shot: invalid as trigger if this node is at or past the next node (coerce to number for JSON/string values)
              const currNum = Number(cuePoints[index]);
              const nextNum = index < cuePoints.length - 1 ? Number(cuePoints[index + 1]) : NaN;
              const isOneShotInvalidTrigger = chopTriggerStyle === 'one-shot' && !Number.isNaN(nextNum) && currNum >= nextNum;
              return (
                <button
                  key={`cue-bottom-${index}`}
                  type="button"
                  onPointerDown={() => !disabled && !isOneShotInvalidTrigger && playCuePoint(index)}
                  onPointerUp={isHold ? () => endHoldAtCueIndex(index, true) : undefined}
                  onPointerLeave={isHold ? () => endHoldAtCueIndex(index, true) : undefined}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{ WebkitTouchCallout: 'none' }}
                  disabled={disabled}
                  title={isOneShotInvalidTrigger ? 'Invalid One-Shot start (past next node)' : undefined}
                  className={`h-12 md:h-14 text-[10px] md:text-xs py-1 md:py-1.5 px-1 rounded-sm md:rounded transition-colors duration-200 flex flex-col items-center justify-center touch-manipulation select-none ${
                    disabled
                      ? 'bg-audafact-surface-2 text-audafact-text-secondary cursor-not-allowed'
                      : isOneShotInvalidTrigger
                        ? 'bg-audafact-surface-2 text-audafact-text-secondary opacity-50 cursor-default'
                        : activeCueIndex === index
                          ? 'bg-audafact-alert-red text-audafact-text-primary'
                          : 'bg-audafact-surface-2 hover:bg-audafact-divider text-audafact-text-secondary hover:text-audafact-text-primary'
                  }`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-[8px] md:text-[9px] opacity-75 leading-tight">
                    {formatCueTimestamp(currentTimestamp)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default TrackControls;