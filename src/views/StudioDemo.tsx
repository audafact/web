import { useState, useCallback, useEffect } from 'react';
import { useAudioContext } from '../context/AudioContext';
import { useGuest } from '../context/GuestContext';
import WaveformDisplay from '../components/WaveformDisplay';
import TrackControls from '../components/TrackControls';
import TempoControls from '../components/TempoControls';
import TimeSignatureControls from '../components/TimeSignatureControls';
import HelpButton from '../components/HelpButton';
import HelpModal from '../components/HelpModal';
import { TimeSignature } from '../types/music';

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

// Use the same track as GuestContext for consistency

const StudioDemo = () => {
  const { audioContext, initializeAudio } = useAudioContext();
  const { currentGuestTrack, loadRandomGuestTrack } = useGuest();
  const [track, setTrack] = useState<Track | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAudioInitialized, setIsAudioInitialized] = useState<boolean>(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState<boolean>(true);
  const [isInitializingAudio, setIsInitializingAudio] = useState<boolean>(false);

  // Track state
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [volume, setVolume] = useState<number>(0.8);
  const [tempo, setTempo] = useState<number>(128);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({ numerator: 4, denominator: 4 });
  const [firstMeasureTime, setFirstMeasureTime] = useState<number>(0);
  const [showMeasures, setShowMeasures] = useState<boolean>(false);
  const [showCueThumbs, setShowCueThumbs] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [lowpassFreq, setLowpassFreq] = useState<number>(20000);
  const [highpassFreq, setHighpassFreq] = useState<number>(20);
  const [filterEnabled, setFilterEnabled] = useState<boolean>(false);
  const [expandedControls, setExpandedControls] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Debug logging function that updates UI
  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setDebugInfo(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Load guest track on component mount, but don't initialize audio until user interaction
  useEffect(() => {
    if (!currentGuestTrack) {
      loadRandomGuestTrack();
    }
  }, [currentGuestTrack, loadRandomGuestTrack]);

  // Load audio buffer using the same method as the main app
  const loadAudioBuffer = async (file: File, context: AudioContext): Promise<AudioBuffer> => {
    try {
      addDebugInfo(`Loading audio buffer: ${file.name} (${file.size} bytes, ${file.type})`);
      addDebugInfo(`AudioContext state: ${context.state}`);
      
      const arrayBuffer = await file.arrayBuffer();
      addDebugInfo(`Array buffer created: ${arrayBuffer.byteLength} bytes`);
      
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      addDebugInfo(`Audio buffer decoded successfully: ${audioBuffer.duration}s duration`);
      
      return audioBuffer;
    } catch (error) {
      addDebugInfo(`AUDIO DECODING ERROR: ${error instanceof Error ? error.message : String(error)}`);
      addDebugInfo(`File: ${file.name}, Size: ${file.size}, Type: ${file.type}, Context: ${context.state}`);
      throw new Error(`Failed to decode audio data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Initialize audio context and load demo track using GuestContext
  const handleInitializeAudio = async () => {
    try {
      addDebugInfo('Starting audio initialization...');
      setNeedsUserInteraction(false);
      setIsInitializingAudio(true);
      setError(null);

      const context = await initializeAudio();
      if (!context) {
        throw new Error('Failed to initialize audio context');
      }

      addDebugInfo('Audio context initialized successfully');
      setIsAudioInitialized(true);

      // Use the guest track that was already loaded
      if (!currentGuestTrack) {
        throw new Error('No guest track available');
      }
      
      addDebugInfo(`Loading track: ${currentGuestTrack.name} from ${currentGuestTrack.file}`);
      
      // Fetch the audio file using the same path as GuestContext
      const response = await fetch(currentGuestTrack.file);
      
      if (!response.ok) {
        addDebugInfo(`Fetch failed: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch audio file: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      addDebugInfo(`Blob received: ${blob.size} bytes, type: ${blob.type}`);
      
      const file = new File([blob], `${currentGuestTrack.name}.${currentGuestTrack.type}`, { 
        type: currentGuestTrack.type === 'mp3' ? 'audio/mpeg' : `audio/${currentGuestTrack.type}`
      });
      
      addDebugInfo(`File created: ${file.name}, ${file.size} bytes, ${file.type}`);
      
      const buffer = await loadAudioBuffer(file, context);
      
      const newTrack: Track = {
        id: currentGuestTrack.id,
        file,
        buffer,
        mode: 'cue',
        loopStart: 0,
        loopEnd: buffer.duration,
        cuePoints: Array.from({ length: 10 }, (_, i) => 
          buffer.duration * (i / 10)
        ),
        tempo: currentGuestTrack.bpm,
        timeSignature: { numerator: 4, denominator: 4 },
        firstMeasureTime: 0,
        showMeasures: false
      };
      
      setTrack(newTrack);
      setTempo(currentGuestTrack.bpm);
      addDebugInfo('Track loaded successfully!');
      
    } catch (err) {
      addDebugInfo(`INITIALIZATION ERROR: ${err instanceof Error ? err.message : String(err)}`);
      setError(err instanceof Error ? err.message : 'Failed to initialize audio');
    } finally {
      setIsInitializingAudio(false);
    }
  };

  // Handle time change (scrubbing)
  const handleTimeChange = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Handle tempo change
  const handleTempoChange = useCallback((newTempo: number) => {
    setTempo(newTempo);
    // Update playback speed based on tempo change
    const speedRatio = newTempo / 128; // 128 is the original BPM
    setPlaybackSpeed(speedRatio);
  }, []);

  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
  }, []);

  // Handle filter changes
  const handleLowpassFreqChange = useCallback((freq: number) => {
    setLowpassFreq(freq);
  }, []);

  const handleHighpassFreqChange = useCallback((freq: number) => {
    setHighpassFreq(freq);
  }, []);

  const handleFilterEnabledChange = useCallback((enabled: boolean) => {
    setFilterEnabled(enabled);
  }, []);

  // Handle cue point changes
  const handleCuePointChange = useCallback((index: number, time: number) => {
    setTrack(prev => {
      if (!prev) return prev;
      const newCuePoints = [...prev.cuePoints];
      newCuePoints[index] = time;
      return { ...prev, cuePoints: newCuePoints };
    });
  }, []);

  // Reset cue points to default positions
  const resetCuePoints = useCallback(() => {
    if (track) {
      const newCuePoints = Array.from({ length: 10 }, (_, i) => 
        track.buffer.duration * (i / 10)
      );
      setTrack(prev => prev ? { ...prev, cuePoints: newCuePoints } : null);
    }
  }, [track]);

  // Help handlers
  const handleStartTutorial = () => {
    // For demo, we'll just show the help modal with tutorial info
    setShowHelpModal(true);
  };

  const handleShowHelp = () => {
    setShowHelpModal(true);
  };

  // User interaction handler
  const handleUserInteraction = useCallback(async () => {
    if (needsUserInteraction) {
      await handleInitializeAudio();
    }
  }, [needsUserInteraction]);

  if (needsUserInteraction) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-center">
          <button
            onClick={handleUserInteraction}
            className="bg-audafact-accent-cyan text-audafact-bg-primary px-8 py-3 rounded-lg font-semibold hover:bg-audafact-accent-cyan/80 transition-colors"
          >
            Start Demo
          </button>
        </div>
      </div>
    );
  }

  if (isInitializingAudio) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-audafact-accent-cyan mx-auto mb-4"></div>
          <p className="audafact-text-primary">Loading demo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold audafact-alert-red mb-4">Demo Error</h1>
          <p className="audafact-text-secondary mb-6">{error}</p>
          <button
            onClick={handleInitializeAudio}
            className="bg-audafact-accent-cyan text-audafact-bg-primary px-6 py-2 rounded-lg font-semibold hover:bg-audafact-accent-cyan/80 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold audafact-heading mb-4">No Track Loaded</h1>
          <button
            onClick={handleInitializeAudio}
            className="bg-audafact-accent-cyan text-audafact-bg-primary px-6 py-2 rounded-lg font-semibold hover:bg-audafact-accent-cyan/80 transition-colors"
          >
            Load Demo Track
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Debug Info Panel - Only show in staging/development */}
      {debugInfo.length > 0 && (
        <div className="fixed top-0 left-0 bg-black text-white p-4 text-xs max-w-md max-h-64 overflow-auto z-50 border border-gray-600">
          <div className="font-bold mb-2">Debug Info:</div>
          {debugInfo.map((info, index) => (
            <div key={index} className="mb-1 text-green-400">{info}</div>
          ))}
        </div>
      )}
      
      {/* Header */}
      <div className="bg-audafact-bg-secondary border-b border-audafact-border">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="bg-audafact-accent-blue bg-opacity-20 text-audafact-accent-blue px-3 py-1 rounded-full text-sm font-medium">
              Demo Mode
            </div>
            <button
              onClick={resetCuePoints}
              className="bg-audafact-accent-cyan text-black px-3 py-1 rounded-full text-sm font-medium hover:bg-audafact-accent-cyan/80 transition-colors"
            >
              Reset Cue Points
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Single Track Container */}
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* Single Track Container - matches Studio exactly */}
          <div className="bg-audafact-bg-primary border border-audafact-border rounded-lg overflow-hidden shadow-lg">
            {/* Track Header */}
            <div className="p-4 border-b border-audafact-divider bg-audafact-surface-1">
              {/* Mobile layout */}
              <div className="flex flex-col gap-2 md:hidden">
                {/* Row 1: Mode buttons */}
                <div className="flex items-center gap-2">
                  <div className="grid grid-cols-3 gap-1 bg-audafact-surface-2 rounded-md p-0.5 border border-audafact-divider w-full max-w-full">
                    <button
                      className={`w-full text-center px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'preview'
                          ? 'bg-audafact-accent-blue text-audafact-text-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      disabled
                    >
                      Preview
                    </button>
                    <button
                      className={`w-full text-center px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'loop'
                          ? 'bg-audafact-accent-cyan text-audafact-bg-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      disabled
                    >
                      Loop
                    </button>
                    <button
                      className={`w-full text-center px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'cue'
                          ? 'bg-audafact-alert-red text-audafact-text-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      disabled
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
                    onClick={() => setShowMeasures(!showMeasures)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                      showMeasures
                        ? 'bg-audafact-accent-cyan text-audafact-bg-primary'
                        : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                    }`}
                    title={showMeasures ? 'Hide Measures' : 'Show Measures'}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Measures</span>
                  </button>
                  {track.mode === 'cue' && (
                    <button
                      onClick={() => setShowCueThumbs(!showCueThumbs)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                        showCueThumbs
                          ? 'bg-audafact-alert-red text-audafact-text-primary'
                          : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                      }`}
                      title={showCueThumbs ? 'Hide Cue Points' : 'Show Cue Points'}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>Cues</span>
                    </button>
                  )}
                  {track.mode === 'cue' && (
                    <button
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 bg-audafact-alert-red text-audafact-text-primary"
                      title="Selected for Cue Control"
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
                    onClick={() => setExpandedControls(!expandedControls)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium audafact-text-secondary bg-audafact-surface-1 border border-audafact-divider rounded hover:bg-audafact-surface-2 transition-colors duration-200 w-full justify-between"
                    title={expandedControls ? 'Collapse Controls' : 'Expand Controls'}
                  >
                    <span className="truncate">Time and Tempo</span>
                    <svg
                      className={`w-3 h-3 transition-transform ${expandedControls ? 'rotate-180' : ''}`}
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
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'preview'
                          ? 'bg-audafact-accent-blue text-audafact-text-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      disabled
                    >
                      Preview
                    </button>
                    <button
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'loop'
                          ? 'bg-audafact-accent-cyan text-audafact-bg-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      disabled
                    >
                      Loop
                    </button>
                    <button
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        track.mode === 'cue'
                          ? 'bg-audafact-alert-red text-audafact-text-primary shadow-sm'
                          : 'text-audafact-text-secondary hover:text-audafact-text-primary'
                      }`}
                      disabled
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
                    onClick={() => setShowMeasures(!showMeasures)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                      showMeasures
                        ? 'bg-audafact-accent-cyan text-audafact-bg-primary'
                        : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                    }`}
                    title={showMeasures ? 'Hide Measures' : 'Show Measures'}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Measures</span>
                  </button>

                  {/* Show Cue Points Button - Only visible on cue tracks */}
                  {track.mode === 'cue' && (
                    <button
                      onClick={() => setShowCueThumbs(!showCueThumbs)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 ${
                        showCueThumbs
                          ? 'bg-audafact-alert-red text-audafact-text-primary'
                          : 'bg-audafact-surface-1 text-audafact-text-secondary hover:bg-audafact-surface-2 hover:text-audafact-text-primary'
                      }`}
                      title={showCueThumbs ? 'Hide Cue Points' : 'Show Cue Points'}
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
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium border border-audafact-divider rounded transition-colors duration-200 bg-audafact-alert-red text-audafact-text-primary"
                      title="Selected for Cue Control"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Select</span>
                    </button>
                  )}

                  <button
                    onClick={() => setExpandedControls(!expandedControls)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium audafact-text-secondary bg-audafact-surface-1 border border-audafact-divider rounded hover:bg-audafact-surface-2 transition-colors duration-200"
                    title={expandedControls ? 'Collapse Controls' : 'Expand Controls'}
                  >
                    <span>Time and Tempo</span>
                    <svg 
                      className={`w-3 h-3 transition-transform ${expandedControls ? 'rotate-180' : ''}`} 
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
            {expandedControls && (
              <div className="p-4 border-b border-audafact-divider bg-audafact-surface-2 space-y-4">
                {/* Tempo Controls */}
                <div className="space-y-2">
                  <TempoControls
                    trackId={track.id}
                    initialTempo={tempo}
                    onTempoChange={(_, newTempo) => handleTempoChange(newTempo)}
                  />
                </div>

                {/* Time Signature Controls */}
                <div className="space-y-2">
                  <TimeSignatureControls
                    timeSignature={timeSignature}
                    onTimeSignatureChange={setTimeSignature}
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
                onLoopPointsChange={() => {}} // Disabled in demo
                onCuePointChange={handleCuePointChange}
                playhead={currentTime}
                zoomLevel={zoomLevel}
                onZoomIn={() => setZoomLevel(prev => Math.min(prev * 1.5, 10))}
                onZoomOut={() => setZoomLevel(prev => Math.max(prev / 1.5, 0.1))}
                onResetZoom={() => setZoomLevel(1)}
                trackId={track.id}
                showMeasures={showMeasures}
                tempo={tempo}
                timeSignature={timeSignature}
                firstMeasureTime={firstMeasureTime}
                onFirstMeasureChange={setFirstMeasureTime}
                showCueThumbs={showCueThumbs}
                isPlaying={isPlaying}
                onPlayheadChange={handleTimeChange}
                onScrollStateChange={() => {}} // Not needed in demo
                isGuestMode={false}
              />
            </div>

            {/* Track Controls */}
            <div className="p-4 relative z-10 bg-audafact-surface-1">
              <TrackControls
                mode={track.mode}
                audioContext={audioContext}
                audioBuffer={track.buffer}
                loopStart={track.loopStart}
                loopEnd={track.loopEnd}
                cuePoints={track.cuePoints}
                ensureAudio={async (callback) => {
                  if (!isAudioInitialized) {
                    await handleInitializeAudio();
                  }
                  callback();
                }}
                isSelected={true}
                onSelect={() => {}}
                onPlaybackTimeChange={handleTimeChange}
                onSpeedChange={setPlaybackSpeed}
                trackTempo={tempo}
                volume={volume}
                onVolumeChange={handleVolumeChange}
                playbackSpeed={playbackSpeed}
                onPlaybackStateChange={(isPlaying: boolean) => setIsPlaying(isPlaying)}
                playbackTime={currentTime}
                disabled={false}
                lowpassFreq={lowpassFreq}
                onLowpassFreqChange={handleLowpassFreqChange}
                highpassFreq={highpassFreq}
                onHighpassFreqChange={handleHighpassFreqChange}
                filterEnabled={filterEnabled}
                onFilterEnabledChange={handleFilterEnabledChange}
                showDeleteButton={false}
                trackId={track.id}
                seekFunctionRef={{ current: null }}
                recordingDestination={null}
              />

              {track.mode === 'cue' && (
                <div className="mt-3 bg-audafact-accent-blue bg-opacity-10 p-2 rounded text-audafact-accent-blue text-xs">
                  Press keyboard keys 1-0 to trigger cue points
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Help Button */}
      <HelpButton
        onStartTutorial={handleStartTutorial}
        onShowHelp={handleShowHelp}
        hideTutorial={true}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  );
};

export default StudioDemo;