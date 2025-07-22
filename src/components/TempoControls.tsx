import { useState, useEffect, useRef, useCallback } from 'react';

interface TempoControlsProps {
  trackId: string;
  initialTempo?: number;
  onTempoChange: (trackId: string, tempo: number) => void;
  playbackSpeed?: number;
  onSpeedChange?: (trackId: string, speed: number) => void;
}

const TempoControls = ({ 
  trackId, 
  initialTempo = 120, 
  onTempoChange, 
  playbackSpeed = 1,
  onSpeedChange
}: TempoControlsProps) => {
  const [tempo, setTempo] = useState(initialTempo);
  const [tempoInput, setTempoInput] = useState(initialTempo.toString());
  const [isTapTempoActive, setIsTapTempoActive] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState<number | null>(null);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [effectiveTempo, setEffectiveTempo] = useState(initialTempo);
  
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const keyListenerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  // Calculate effective tempo based on playback speed
  useEffect(() => {
    setEffectiveTempo(tempo * playbackSpeed);
  }, [tempo, playbackSpeed]);

  // Update tempo input when initialTempo changes
  useEffect(() => {
    setTempo(initialTempo);
    setTempoInput(initialTempo.toString());
  }, [initialTempo]);

  // Handle manual tempo input
  const handleTempoInputChange = (value: string) => {
    setTempoInput(value);
    const newTempo = parseFloat(value);
    if (!isNaN(newTempo) && newTempo >= 40 && newTempo <= 300) {
      setTempo(newTempo);
      onTempoChange(trackId, newTempo);
    }
  };

  const handleTempoInputBlur = () => {
    const newTempo = parseFloat(tempoInput);
    if (isNaN(newTempo) || newTempo < 40 || newTempo > 300) {
      // Reset to current tempo if invalid
      setTempoInput(tempo.toString());
    }
  };

  // Calculate BPM from tap intervals
  const calculateBPM = useCallback((times: number[]) => {
    if (times.length < 2) return null;
    
    const intervals: number[] = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1]);
    }
    
    // Calculate average interval in milliseconds
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // Convert to BPM (60 seconds / interval in seconds)
    const bpm = Math.round(60000 / avgInterval);
    
    return Math.max(40, Math.min(300, bpm));
  }, []);

  // Handle tap tempo
  const handleTap = useCallback(() => {
    const now = Date.now();
    
    if (lastTapTime && (now - lastTapTime) > 3000) {
      // Reset if more than 3 seconds between taps
      setTapTimes([now]);
      setTapCount(1);
    } else {
      const newTapTimes = [...tapTimes, now];
      setTapTimes(newTapTimes);
      setTapCount(newTapTimes.length);
      
      // Keep only last 8 taps for calculation
      if (newTapTimes.length > 8) {
        const trimmedTimes = newTapTimes.slice(-8);
        setTapTimes(trimmedTimes);
        setTapCount(trimmedTimes.length);
      }
      
      // Calculate BPM after at least 2 taps
      if (newTapTimes.length >= 2) {
        const calculatedBPM = calculateBPM(newTapTimes);
        if (calculatedBPM) {
          setTempo(calculatedBPM);
          setTempoInput(calculatedBPM.toString());
          onTempoChange(trackId, calculatedBPM);
        }
      }
    }
    
    setLastTapTime(now);
    
    // Clear existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    
    // Set timeout to reset tap tempo after 3 seconds of inactivity
    tapTimeoutRef.current = setTimeout(() => {
      setIsTapTempoActive(false);
      setTapCount(0);
      setTapTimes([]);
      setLastTapTime(null);
    }, 3000);
  }, [lastTapTime, tapTimes, calculateBPM]);

  // Handle spacebar key press for tap tempo
  useEffect(() => {
    if (!isTapTempoActive) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        handleTap();
      }
    };

    keyListenerRef.current = handleKeyPress;
    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isTapTempoActive, handleTap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      if (keyListenerRef.current) {
        document.removeEventListener('keydown', keyListenerRef.current);
      }
    };
  }, []);

  // Toggle tap tempo mode
  const toggleTapTempo = () => {
    if (isTapTempoActive) {
      setIsTapTempoActive(false);
      setTapCount(0);
      setTapTimes([]);
      setLastTapTime(null);
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    } else {
      setIsTapTempoActive(true);
      setTapCount(0);
      setTapTimes([]);
      setLastTapTime(null);
    }
  };

  return (
    <div className="flex items-center space-x-4 p-3 audafact-card">
      {/* Tempo Label */}
      <div className="flex flex-col">
        <label className="text-sm font-medium audafact-heading">Original Tempo</label>
        <span className="text-xs audafact-text-secondary">BPM</span>
      </div>

      {/* Manual Tempo Input */}
      <div className="flex items-center space-x-2">
        <input
          type="number"
          min="40"
          max="300"
          value={tempoInput}
          onChange={(e) => handleTempoInputChange(e.target.value)}
          onBlur={handleTempoInputBlur}
          className="w-16 px-2 py-1 text-sm border border-audafact-divider rounded bg-audafact-surface-2 text-audafact-text-primary focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-transparent"
          disabled={isTapTempoActive}
        />
        <span className="text-sm audafact-text-secondary">→</span>
        <div className="flex flex-col">
          <span className="text-sm font-medium audafact-accent-cyan">
            {Math.round(effectiveTempo)} BPM
          </span>
          <span className="text-xs audafact-text-secondary">
            Speed: {playbackSpeed.toFixed(2)}x
          </span>
        </div>
      </div>

      {/* Tap Tempo Button */}
      <button
        onClick={toggleTapTempo}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
          isTapTempoActive
            ? 'bg-audafact-alert-red text-audafact-text-primary border border-audafact-alert-red hover:bg-opacity-90'
            : 'bg-audafact-surface-2 text-audafact-text-secondary border border-audafact-divider hover:bg-audafact-divider hover:text-audafact-text-primary'
        }`}
        title={isTapTempoActive ? 'Click to stop tap tempo' : 'Click to start tap tempo'}
      >
        {isTapTempoActive ? 'Stop Tap' : 'Tap Tempo'}
      </button>

      {/* Tap Tempo Status */}
      {isTapTempoActive && (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-audafact-alert-red rounded-full animate-pulse"></div>
            <span className="text-sm text-audafact-alert-red font-medium">Active</span>
          </div>
          <span className="text-sm audafact-text-secondary">
            {tapCount > 0 ? `Taps: ${tapCount}` : 'Press Spacebar to tap'}
          </span>
        </div>
      )}
    </div>
  );
};

export default TempoControls; 