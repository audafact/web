import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

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
  lowpassFreq?: number;
  onLowpassFreqChange?: (freq: number) => void;
  highpassFreq?: number;
  onHighpassFreqChange?: (freq: number) => void;
  filterEnabled?: boolean;
  onFilterEnabledChange?: (enabled: boolean) => void;
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
  filterEnabled,
  onFilterEnabledChange
}: TrackControlsProps) => {
  const [speed, setSpeed] = useState(playbackSpeed);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeCueIndex, setActiveCueIndex] = useState<number | null>(null);
  const [isSpeedSliderHovered, setIsSpeedSliderHovered] = useState(false);
  const [isSpeedSliderDragging, setIsSpeedSliderDragging] = useState(false);
  
  // Filter state
  const [internalLowpassFreq, setInternalLowpassFreq] = useState(lowpassFreq || 20000);
  const [internalHighpassFreq, setInternalHighpassFreq] = useState(highpassFreq || 20);
  const [internalFilterEnabled, setInternalFilterEnabled] = useState(filterEnabled || false);
  
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
  
  // Filter refs
  const lowpassFilterRef = useRef<BiquadFilterNode | null>(null);
  const highpassFilterRef = useRef<BiquadFilterNode | null>(null);
  
  // Current filter value refs for reliable state access
  const currentFilterEnabledRef = useRef<boolean>(filterEnabled || false);
  const currentLowpassFreqRef = useRef<number>(lowpassFreq || 20000);
  const currentHighpassFreqRef = useRef<number>(highpassFreq || 20);

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

  useEffect(() => {
    if (filterEnabled !== undefined) {
      setInternalFilterEnabled(filterEnabled);
      currentFilterEnabledRef.current = filterEnabled;
    }
  }, [filterEnabled]);

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
  }, [audioContext, onLowpassFreqChange]);

  const handleHighpassFreqChange = useCallback((freq: number) => {
    setInternalHighpassFreq(freq);
    currentHighpassFreqRef.current = freq;
    if (highpassFilterRef.current) {
      highpassFilterRef.current.frequency.setValueAtTime(freq, audioContext?.currentTime || 0);
    }
    if (onHighpassFreqChange) {
      onHighpassFreqChange(freq);
    }
  }, [audioContext, onHighpassFreqChange]);

  const handleFilterEnabledChange = useCallback((enabled: boolean) => {
    setInternalFilterEnabled(enabled);
    currentFilterEnabledRef.current = enabled;
    if (onFilterEnabledChange) {
      onFilterEnabledChange(enabled);
    }
  }, [onFilterEnabledChange]);

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
    
    // Create Web Audio API filters if enabled
    if (currentFilterEnabledRef.current) {
      const lowpassFilter = audioContext.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.value = currentLowpassFreqRef.current;
      lowpassFilter.Q.value = 1;
      
      const highpassFilter = audioContext.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.value = currentHighpassFreqRef.current;
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
        const position = loopStart + ((elapsed * playbackRate) % loopDuration);
        setCurrentTime(position);
        if (onPlaybackTimeChange) {
          onPlaybackTimeChange(position);
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

  // Sync external playback time with internal state when not playing
  useEffect(() => {
    if (!isPlaying && typeof playbackTime === 'number') {
      setCurrentTime(playbackTime);
    }
  }, [playbackTime, isPlaying]);

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
      } else {
        // Start playback - create audio chain manually to ensure current volume and speed are applied
        const audioChain = createAudioChainWithCurrentSettings();
        if (!audioChain) return;
        
        const { sourceNode, gainNode, lowpassFilter, highpassFilter } = audioChain;
        
        if (mode === 'loop') {
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
    <div className={`bg-white p-4 rounded-lg shadow-sm space-y-3 ${disabled ? 'opacity-50' : ''}`}>
      {/* Top Row: Play Button and Track Selection (cue mode only) */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <button
            onClick={togglePlayback}
            disabled={disabled}
            className={`p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              disabled 
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {/* Display current playback time and duration */}
          <div className="text-center text-xs text-gray-500">
            {currentTime.toFixed(2)}s / {audioBuffer.duration.toFixed(2)}s
          </div>
          
          {mode === 'loop' && (
            <div className="text-sm text-gray-600">
              Loop: {loopStart.toFixed(2)}s - {loopEnd.toFixed(2)}s
            </div>
          )}
        </div>

        {mode === 'cue' && (
          <div className="flex items-center space-x-3">
            {isSelected && (
              <div className="text-xs text-gray-500">
                Press 1-0 keys to trigger cues
              </div>
            )}
            <button
              onClick={onSelect}
              disabled={disabled}
              className={`px-3 py-1 rounded text-sm ${
                disabled
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : isSelected 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isSelected ? 'Selected to Cue' : 'Select to Cue'}
            </button>
          </div>
        )}
      </div>

      {/* Volume and Speed Controls Row */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2 flex-1">
          <label className="text-xs text-gray-600 w-12">Vol:</label>
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
            }}
            className={`flex-1 h-1 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          />
          <span className="text-xs text-gray-500 w-8">{Math.round(volume * 100)}</span>
        </div>

        <div className="flex items-center space-x-2 flex-1">
          <label className="text-xs text-gray-600 w-12">Speed:</label>
          <div className="flex-1 relative">
            <input
              type="range"
              min="0.5"
              max="2"
              step={getTempoSpeedRange().stepSize}
              value={speed}
              disabled={disabled}
              onChange={(e) => {
                if (disabled) return;
                const newSpeed = parseFloat(e.target.value);
                setSpeed(newSpeed);
                currentSpeedRef.current = newSpeed;
                if (onSpeedChange) {
                  onSpeedChange(newSpeed);
                }
              }}
              onMouseEnter={() => !disabled && setIsSpeedSliderHovered(true)}
              onMouseLeave={() => !disabled && setIsSpeedSliderHovered(false)}
              onMouseDown={() => !disabled && setIsSpeedSliderDragging(true)}
              onMouseUp={() => !disabled && setIsSpeedSliderDragging(false)}
              className={`w-full h-1 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              aria-label="Playback speed"
              aria-describedby={isSpeedSliderHovered || isSpeedSliderDragging ? "speed-tooltip" : undefined}
              aria-valuetext={`${speed.toFixed(2)}x speed`}
            />
            {/* Speed Tooltip */}
            {(isSpeedSliderHovered || isSpeedSliderDragging) && !disabled && (
              <div 
                id="speed-tooltip"
                role="tooltip"
                aria-hidden="false"
                className="absolute bottom-6 bg-gray-800 text-white text-xs px-2 py-1 rounded pointer-events-none z-10 transform -translate-x-1/2"
                style={{
                  left: `${((speed - 0.5) / 1.5) * 100}%`
                }}
              >
                {speed.toFixed(2)}x
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500 w-20">
            {getCurrentEffectiveTempo()} BPM
            <span className="block text-xs text-gray-400">
              {getTempoSpeedRange().minTempo}-{getTempoSpeedRange().maxTempo}
            </span>
          </span>
        </div>
      </div>

      {/* Filter Controls Row */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="filter-enabled"
            checked={filterEnabled || false}
            disabled={disabled}
            onChange={(e) => {
              if (disabled) return;
              handleFilterEnabledChange(e.target.checked);
            }}
            className={`w-4 h-4 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          />
          <label htmlFor="filter-enabled" className={`text-xs ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
            Filters
          </label>
        </div>

        {(filterEnabled || false) && (
          <>
            <div className="flex items-center space-x-2 flex-1">
              <label className="text-xs text-gray-600 w-12">LP:</label>
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
                className={`flex-1 h-1 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              />
              <span className="text-xs text-gray-500 w-12">
                {(lowpassFreq || 20000) >= 1000 
                  ? `${((lowpassFreq || 20000) / 1000).toFixed(1)}k` 
                  : (lowpassFreq || 20000)}Hz
              </span>
            </div>

            <div className="flex items-center space-x-2 flex-1">
              <label className="text-xs text-gray-600 w-12">HP:</label>
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
                className={`flex-1 h-1 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              />
              <span className="text-xs text-gray-500 w-12">
                {(highpassFreq || 20) >= 1000 
                  ? `${((highpassFreq || 20) / 1000).toFixed(1)}k` 
                  : (highpassFreq || 20)}Hz
              </span>
            </div>
          </>
        )}
      </div>

      {/* Cue Point Controls - only show in cue mode */}
      {mode === 'cue' && (
        <div>
          <h4 className="text-xs font-medium mb-2 text-gray-600">Cue Points</h4>
          <div className="grid grid-cols-10 gap-1">
            {cuePoints.map((point, index) => (
              <button
                key={index}
                onClick={() => !disabled && playCuePoint(index)}
                disabled={disabled}
                className={`text-xs py-1 px-1 rounded ${
                  disabled
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : activeCueIndex === index 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
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