import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { useRecording } from '../context/RecordingContext';

interface TrackControlsProps {
  mode: 'preview' | 'loop' | 'cue';
  audioContext: AudioContext | null;
  audioBuffer: AudioBuffer;
  loopStart: number;
  loopEnd: number;
  cuePoints: number[];
  onLoopPointsChange: (start: number, end: number) => void;
  onCuePointChange: (index: number, time: number) => void;
  ensureAudio: (callback: () => void) => Promise<void>;
  setPlayhead: (time: number) => void;
  trackColor?: 'indigo' | 'red' | 'blue';
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
}

const TrackControls = ({ 
  mode, 
  audioContext, 
  audioBuffer, 
  loopStart, 
  loopEnd, 
  cuePoints, 
  onLoopPointsChange, 
  onCuePointChange, 
  ensureAudio, 
  setPlayhead, 
  trackColor = 'indigo',
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
  seekFunctionRef
}: TrackControlsProps) => {
  const { addRecordingEvent } = useRecording();
  const [speed, setSpeed] = useState(playbackSpeed);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeCueIndex, setActiveCueIndex] = useState<number | null>(null);
  const [isSpeedSliderHovered, setIsSpeedSliderHovered] = useState(false);
  const [isSpeedSliderDragging, setIsSpeedSliderDragging] = useState(false);
  
  // Filter state
  const [internalLowpassFreq, setInternalLowpassFreq] = useState(lowpassFreq || 20000);
  const [internalHighpassFreq, setInternalHighpassFreq] = useState(highpassFreq || 20);
  const [isFilterSectionExpanded, setIsFilterSectionExpanded] = useState(false);
  
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const currentVolumeRef = useRef<number>(volume);
  const currentSpeedRef = useRef<number>(1);
  const activeCueIndexRef = useRef<number | null>(null);
  const cueStartTimeRef = useRef<number>(0);
  // Track the actual starting position when playback begins
  const playbackStartTimeRef = useRef<number>(0);
  
  // Track mode changes to handle audio source updates
  const prevModeRef = useRef<string>(mode);
  
  // Filter refs
  const lowpassFilterRef = useRef<BiquadFilterNode | null>(null);
  const highpassFilterRef = useRef<BiquadFilterNode | null>(null);
  
  // Current filter value refs for reliable state access
  const currentLowpassFreqRef = useRef<number>(lowpassFreq || 20000);
  const currentHighpassFreqRef = useRef<number>(highpassFreq || 20);
  
  // Track when we're processing a seek to prevent interference from update loop
  const isSeekingRef = useRef<boolean>(false);

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



  // Calculate tempo-based speed range and step size
  const getTempoSpeedRange = useCallback(() => {
    const minTempo = Math.max(40, Math.round(trackTempo * 0.5)); // Half tempo, minimum 40 BPM
    const maxTempo = Math.min(300, Math.round(trackTempo * 2)); // Double tempo, maximum 300 BPM
    
    // Calculate step size to ensure ~1 BPM change per step
    // We want the step size to be approximately 1/trackTempo
    const stepSize = Math.max(0.001, Math.min(0.05, 1 / trackTempo));
    
    return { minTempo, maxTempo, stepSize };
  }, [trackTempo]);

  // Convert tempo to speed multiplier
  const tempoToSpeed = useCallback((targetTempo: number) => {
    return targetTempo / trackTempo;
  }, [trackTempo]);

  // Convert speed multiplier to tempo
  const speedToTempo = useCallback((speedMultiplier: number) => {
    return Math.round(trackTempo * speedMultiplier);
  }, [trackTempo]);

  // Get current effective tempo
  const getCurrentEffectiveTempo = useCallback(() => {
    return speedToTempo(speed);
  }, [speed, speedToTempo]);

  // Filter control functions
  const handleLowpassFreqChange = useCallback((freq: number) => {
    setInternalLowpassFreq(freq);
    currentLowpassFreqRef.current = freq;
    if (lowpassFilterRef.current) {
      lowpassFilterRef.current.frequency.setValueAtTime(freq, audioContext?.currentTime || 0);
    }
    if (onLowpassFreqChange) {
      onLowpassFreqChange(freq);
    }
    
    // Record filter change event
    if (trackId) {
      addRecordingEvent({
        type: 'filter_change',
        trackId,
        data: { 
          filterType: 'lowpass',
          oldFreq: internalLowpassFreq,
          newFreq: freq,
          mode
        }
      });
    }
  }, [audioContext, onLowpassFreqChange, trackId, addRecordingEvent, internalLowpassFreq, mode]);

  const handleHighpassFreqChange = useCallback((freq: number) => {
    setInternalHighpassFreq(freq);
    currentHighpassFreqRef.current = freq;
    if (highpassFilterRef.current) {
      highpassFilterRef.current.frequency.setValueAtTime(freq, audioContext?.currentTime || 0);
    }
    if (onHighpassFreqChange) {
      onHighpassFreqChange(freq);
    }
    
    // Record filter change event
    if (trackId) {
      addRecordingEvent({
        type: 'filter_change',
        trackId,
        data: { 
          filterType: 'highpass',
          oldFreq: internalHighpassFreq,
          newFreq: freq,
          mode
        }
      });
    }
  }, [audioContext, onHighpassFreqChange, trackId, addRecordingEvent, internalHighpassFreq, mode]);



  // Check if filters are actually active (have non-default values)
  const areFiltersActive = useCallback(() => {
    const lowpassFreq = internalLowpassFreq;
    const highpassFreq = internalHighpassFreq;
    return lowpassFreq < 20000 || highpassFreq > 20;
  }, [internalLowpassFreq, internalHighpassFreq]);

  // Helper function to create audio chain with current volume and speed
  const createAudioChainWithCurrentSettings = useCallback(() => {
    if (!audioContext) return null;
    
    const currentVolume = currentVolumeRef.current;
    const currentSpeed = currentSpeedRef.current;
    
    const sourceNode = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.value = currentSpeed;
    gainNode.gain.value = currentVolume;
    
    // Create Web Audio API filters if they have non-default values
    const lowpassFreq = currentLowpassFreqRef.current;
    const highpassFreq = currentHighpassFreqRef.current;
    const isLowpassActive = lowpassFreq < 20000;
    const isHighpassActive = highpassFreq > 20;
    
    if (isLowpassActive || isHighpassActive) {
      const lowpassFilter = audioContext.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.value = lowpassFreq;
      lowpassFilter.Q.value = 1;
      
      const highpassFilter = audioContext.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.value = highpassFreq;
      highpassFilter.Q.value = 1;
      
      // Store filter refs
      lowpassFilterRef.current = lowpassFilter;
      highpassFilterRef.current = highpassFilter;
      
      // Connect: source -> highpass -> lowpass -> gain -> destination
      sourceNode.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      return { sourceNode, gainNode, lowpassFilter, highpassFilter };
    } else {
      // Connect: source -> gain -> destination (no filters)
      sourceNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      return { sourceNode, gainNode };
    }
  }, [audioContext, audioBuffer]);

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
        
        // Check if we're currently outside the loop region
        const currentVisualPosition = currentTime;
        const isOutsideLoop = currentVisualPosition < loopStart || currentVisualPosition > loopEnd;
        
        if (isOutsideLoop) {
          // If outside loop region, continue from current position until we reach the loop
          const currentPlaybackTime = playbackStartTimeRef.current + (elapsed * playbackRate);
          const finalTime = currentPlaybackTime >= audioBuffer.duration ? 0 : currentPlaybackTime;
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
              
              // Start from the current position within the loop
              const positionInLoop = finalTime - loopStart;
              sourceNode.start(0, loopStart + positionInLoop);
              
              // Update refs
              audioSourceRef.current = sourceNode;
              gainNodeRef.current = gainNode;
              if (lowpassFilter) lowpassFilterRef.current = lowpassFilter;
              if (highpassFilter) highpassFilterRef.current = highpassFilter;
              
              // Update start time for accurate position calculation
              startTimeRef.current = audioContext.currentTime;
              playbackStartTimeRef.current = loopStart + positionInLoop;
            }
          }
        } else {
          // If inside loop region, use normal loop calculation
          const position = loopStart + ((elapsed * playbackRate) % loopDuration);
          setCurrentTime(position);
          if (onPlaybackTimeChange) {
            onPlaybackTimeChange(position);
          }
        }
      } else {
        // For non-loop mode, calculate position from the actual starting position
        const currentPlaybackTime = playbackStartTimeRef.current + (elapsed * playbackRate);
        const finalTime = currentPlaybackTime >= audioBuffer.duration ? 0 : currentPlaybackTime;
        setCurrentTime(finalTime);
        if (onPlaybackTimeChange) {
          onPlaybackTimeChange(finalTime);
        }
      }
    }
    
    lastUpdateTimeRef.current = now;
    animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
  }, [isPlaying, audioContext, audioBuffer.duration, onPlaybackTimeChange, mode, loopStart, loopEnd]);

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
          sourceNode.start(0, seekTime);
        } else {
          // If seeking outside loop region, don't loop yet
          sourceNode.loop = false;
          sourceNode.start(0, seekTime);
        }
      } else {
        // Preview or cue mode - no looping
        sourceNode.loop = false;
        sourceNode.start(0, seekTime);
      }
      
      // Update refs
      audioSourceRef.current = sourceNode;
      gainNodeRef.current = gainNode;
      if (lowpassFilter) lowpassFilterRef.current = lowpassFilter;
      if (highpassFilter) highpassFilterRef.current = highpassFilter;
      
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
            sourceNode.start(0, currentTime);
            playbackStartTimeRef.current = currentTime;
          } else if (isAfterLoop) {
            // If after loop region, continue without looping
            sourceNode.loop = false;
            sourceNode.start(0, currentTime);
            playbackStartTimeRef.current = currentTime;
          } else {
            // If before loop region, start from current position but prepare for looping
            sourceNode.loop = false; // Don't loop yet
            sourceNode.start(0, currentTime);
            playbackStartTimeRef.current = currentTime;
          }
        } else {
          // Preview or cue mode - no looping
          sourceNode.loop = false;
          sourceNode.start(0, currentTime);
          playbackStartTimeRef.current = currentTime;
        }
        
        // Update refs
        audioSourceRef.current = sourceNode;
        gainNodeRef.current = gainNode;
        if (lowpassFilter) lowpassFilterRef.current = lowpassFilter;
        if (highpassFilter) highpassFilterRef.current = highpassFilter;
        
        // Update start time for accurate position calculation
        startTimeRef.current = audioContext?.currentTime || 0;
      }
    }
    
    // Update prevModeRef
    prevModeRef.current = mode;
  }, [mode, isPlaying, currentTime, loopStart, loopEnd, audioContext]);

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


  // Handle keyboard events for cue points
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle key presses if this is a cue track AND it's selected
      if (mode !== 'cue' || !isSelected) return;

      // Map number keys 1-0 to cue points
      const keyMap: { [key: string]: number } = {
        '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
        '6': 5, '7': 6, '8': 7, '9': 8, '0': 9
      };

      const cueIndex = keyMap[event.key];

      if (cueIndex !== undefined && cueIndex < cuePoints.length) {
        playCuePoint(cueIndex);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [mode, isSelected, cuePoints]);

  // Handle play/pause functionality
  const togglePlayback = async () => {
    try {
      await ensureAudio(() => {});
      if (!audioContext || !audioBuffer) return;

      if (isPlaying) {
        // Stop playback
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
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        setIsPlaying(false);
        if (onPlaybackStateChange) {
          onPlaybackStateChange(false);
        }
        
        // Record loop stop event
        if (trackId && mode === 'loop') {
          addRecordingEvent({
            type: 'loop_stop',
            trackId,
            data: { mode }
          });
        }
      } else {
        // Start playback - create audio chain manually to ensure current volume and speed are applied
        const audioChain = createAudioChainWithCurrentSettings();
        if (!audioChain) return;
        
        const { sourceNode, gainNode, lowpassFilter, highpassFilter } = audioChain;
        
        if (mode === 'loop') {
          // In loop mode, always start from the beginning of the loop region
          sourceNode.loop = true;
          sourceNode.loopStart = loopStart;
          sourceNode.loopEnd = loopEnd;
          sourceNode.start(0, loopStart);
          playbackStartTimeRef.current = loopStart;
        } else if (mode === 'cue' && activeCueIndex !== null) {
          const cueStartTime = cuePoints[activeCueIndex];
          cueStartTimeRef.current = cueStartTime;
          sourceNode.start(0, cueStartTime);
          playbackStartTimeRef.current = cueStartTime;
        } else {
          sourceNode.start(0, currentTime);
          playbackStartTimeRef.current = currentTime;
        }

        audioSourceRef.current = sourceNode;
        gainNodeRef.current = gainNode;
        
        // Store filter references if they exist
        if (lowpassFilter) {
          lowpassFilterRef.current = lowpassFilter;
        }
        if (highpassFilter) {
          highpassFilterRef.current = highpassFilter;
        }
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
        startTimeRef.current = audioContext.currentTime;
        
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
      }
    } catch (error) {
      console.error('Error in togglePlayback:', error);
      setIsPlaying(false);
    }
  };
  
  // Play from a specific cue point
  const playCuePoint = async (index: number) => {
    
    if (!audioContext || !audioBuffer || index >= cuePoints.length) {
      return;
    }

    try {
      await ensureAudio(() => {});
      
      // Stop current playback if any
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
      
      // Set the active cue index and update refs immediately
      setActiveCueIndex(index);
      activeCueIndexRef.current = index;
      const cueTime = cuePoints[index];
      cueStartTimeRef.current = cueTime;
      setCurrentTime(cueTime);
      if (onPlaybackTimeChange) {
        onPlaybackTimeChange(cueTime);
      }
      
      // Create audio chain manually to ensure current volume and speed are applied
      const audioChain = createAudioChainWithCurrentSettings();
      if (!audioChain) return;
      
      const { sourceNode, gainNode, lowpassFilter, highpassFilter } = audioChain;
      
      // Store references
      audioSourceRef.current = sourceNode;
      gainNodeRef.current = gainNode;
      
      // Store filter references if they exist
      if (lowpassFilter) {
        lowpassFilterRef.current = lowpassFilter;
      }
      if (highpassFilter) {
        highpassFilterRef.current = highpassFilter;
      }
      
      // Store start time
      startTimeRef.current = audioContext.currentTime;
      
      sourceNode.start(0, cueTime);
      playbackStartTimeRef.current = cueTime;
      setIsPlaying(true);
      if (onPlaybackStateChange) {
        onPlaybackStateChange(true);
      }
      
      // Start the animation frame loop for smooth updates
      lastUpdateTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(updatePlaybackTime);
      
      // Record cue trigger event
      if (trackId) {
        addRecordingEvent({
          type: 'cue_trigger',
          trackId,
          data: {
            cueIndex: index,
            cueTime,
            mode
          }
        });
      }
      
      // Handle playback end
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
      console.error('Error in playCuePoint:', error);
      setIsPlaying(false);
    }
  };
  
  // Update volume when it changes
  useEffect(() => {
    currentVolumeRef.current = volume;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);
  
  // Update playback rate when speed changes
  useEffect(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.playbackRate.value = currentSpeedRef.current;
    }
  }, [speed]);


  
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
    <div className={`audafact-card p-4 space-y-4 ${disabled ? 'opacity-50' : ''}`}>
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
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {/* Display current playback time and duration */}
          <div className="text-center text-xs audafact-text-secondary">
            {currentTime.toFixed(2)}s / {audioBuffer.duration.toFixed(2)}s
          </div>
          
          {mode === 'loop' && (
            <div className="text-sm audafact-text-secondary">
              Loop: {loopStart.toFixed(2)}s - {loopEnd.toFixed(2)}s
            </div>
          )}
        </div>

        {mode === 'cue' && (
          <div className="flex items-center space-x-3">
            {isSelected && (
              <div className="text-xs audafact-text-secondary">
                Press 1-0 keys to trigger cues
              </div>
            )}
            <button
              onClick={onSelect}
              disabled={disabled}
              className={`px-3 py-1 rounded text-sm transition-colors duration-200 ${
                disabled
                  ? 'bg-audafact-surface-2 text-audafact-text-secondary cursor-not-allowed' 
                  : isSelected 
                    ? 'bg-audafact-alert-red text-audafact-text-primary' 
                    : 'bg-audafact-surface-2 text-audafact-text-secondary hover:bg-audafact-divider hover:text-audafact-text-primary'
              }`}
            >
              {isSelected ? 'Selected to Cue' : 'Select to Cue'}
            </button>
          </div>
        )}
      </div>

      {/* Volume and Speed Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Volume Control */}
        <div className="space-y-2">
          <label className="text-sm font-medium audafact-heading">Volume</label>
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
              className={`flex-1 h-2 bg-audafact-surface-2 rounded-lg appearance-none cursor-pointer slider ${
                disabled ? 'cursor-not-allowed opacity-50' : ''
              }`}
            />
            <span className="text-sm audafact-text-secondary w-12">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {/* Speed Control */}
        <div className="space-y-2">
          <label className="text-sm font-medium audafact-heading">
            Playback Speed: {speed.toFixed(2)}x
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="range"
              min={getTempoSpeedRange().minTempo / trackTempo}
              max={getTempoSpeedRange().maxTempo / trackTempo}
              step={getTempoSpeedRange().stepSize}
              value={speed}
              disabled={disabled}
              onChange={(e) => {
                if (disabled) return;
                const newSpeed = parseFloat(e.target.value);
                setSpeed(newSpeed);
                currentSpeedRef.current = newSpeed;
                if (onSpeedChange) onSpeedChange(newSpeed);
                
                // Record speed change event
                if (trackId) {
                  addRecordingEvent({
                    type: 'speed_change',
                    trackId,
                    data: { 
                      oldSpeed: speed,
                      newSpeed,
                      mode
                    }
                  });
                }
              }}
              className={`flex-1 h-2 bg-audafact-surface-2 rounded-lg appearance-none cursor-pointer slider ${
                disabled ? 'cursor-not-allowed opacity-50' : ''
              }`}
            />
            <span className="text-sm text-gray-600 w-16">
              {getCurrentEffectiveTempo()} BPM
            </span>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsFilterSectionExpanded(!isFilterSectionExpanded)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium audafact-text-secondary bg-audafact-surface-1 border border-audafact-divider rounded hover:bg-audafact-surface-2 transition-colors duration-200"
          >
            <span>Audio Filters {areFiltersActive() && <span className="text-audafact-accent-cyan">●</span>}</span>
            <svg 
              className={`w-3 h-3 transition-transform ${isFilterSectionExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {/* Delete Track Button - positioned opposite to Audio Filters toggle */}
          {showDeleteButton && onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium audafact-text-secondary hover:text-audafact-red hover:bg-audafact-surface-2 border border-audafact-divider rounded transition-colors duration-200"
              title="Delete Track"
            >
              <span>Delete</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {isFilterSectionExpanded && (
          <div className="p-4 border-b bg-audafact-surface-1">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium audafact-heading">
                    Low Pass Filter: {(lowpassFreq || 20000) >= 1000 
                      ? `${((lowpassFreq || 20000) / 1000).toFixed(1)}kHz` 
                      : `${(lowpassFreq || 20000)}Hz`}
                  </label>
                </div>
                <input
                  type="range"
                  min="20"
                  max="20000"
                  step="1"
                  value={lowpassFreq || 20000}
                  disabled={disabled}
                  onChange={(e) => {
                    if (disabled) return;
                    const freq = parseInt(e.target.value);
                    handleLowpassFreqChange(freq);
                  }}
                  className={`w-full h-2 bg-audafact-surface-2 rounded-lg appearance-none cursor-pointer slider ${
                    disabled ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                />
                <div className="flex justify-between text-xs audafact-text-secondary">
                  <span>20Hz</span>
                  <span>20kHz</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium audafact-heading">
                    High Pass Filter: {(highpassFreq || 20) >= 1000 
                      ? `${((highpassFreq || 20) / 1000).toFixed(1)}kHz` 
                      : `${(highpassFreq || 20)}Hz`}
                  </label>
                </div>
                <input
                  type="range"
                  min="20"
                  max="20000"
                  step="1"
                  value={highpassFreq || 20}
                  disabled={disabled}
                  onChange={(e) => {
                    if (disabled) return;
                    const freq = parseInt(e.target.value);
                    handleHighpassFreqChange(freq);
                  }}
                  className={`w-full h-2 bg-audafact-surface-2 rounded-lg appearance-none cursor-pointer slider ${
                    disabled ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                />
                <div className="flex justify-between text-xs audafact-text-secondary">
                  <span>20Hz</span>
                  <span>20kHz</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cue Point Controls */}
      {mode === 'cue' && (
        <div>
          <h4 className="text-xs font-medium mb-2 audafact-text-secondary">Cue Points</h4>
          <div className="grid grid-cols-10 gap-1">
            {cuePoints.map((point, index) => (
              <button
                key={index}
                onClick={() => !disabled && playCuePoint(index)}
                disabled={disabled}
                className={`text-xs py-1 px-1 rounded transition-colors duration-200 ${
                  disabled
                    ? 'bg-audafact-surface-2 text-audafact-text-secondary cursor-not-allowed'
                    : activeCueIndex === index 
                      ? 'bg-audafact-alert-red text-audafact-text-primary' 
                      : 'bg-audafact-surface-2 hover:bg-audafact-divider text-audafact-text-secondary hover:text-audafact-text-primary'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackControls;