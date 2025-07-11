import { useState, useEffect } from 'react';
import { useAudioContext } from '../context/AudioContext';
import WaveformDisplay from '../components/WaveformDisplay';
import TrackControls from '../components/TrackControls';
import ModeSelector from '../components/ModeSelector';
import TempoControls from '../components/TempoControls';
import TimeSignatureControls from '../components/TimeSignatureControls';
import { TimeSignature } from '../types/music';

// Import preloaded audio files
import secretsOfTheHeart from '../assets/audio/Secrets of the Heart.mp3';
import ronDrums from '../assets/audio/RON-drums.wav';

// Define a Track type
interface Track {
  id: string;
  file: File;
  buffer: AudioBuffer;
  mode: 'loop' | 'cue';
  loopStart: number;
  loopEnd: number;
  cuePoints: number[];
  tempo: number;
  timeSignature: TimeSignature;
  firstMeasureTime: number;
  showMeasures: boolean;
}

const Studio = () => {
  const { audioContext, initializeAudio, resumeAudioContext } = useAudioContext();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAudioInitialized, setIsAudioInitialized] = useState<boolean>(false);
  const [loopPlayhead, setLoopPlayhead] = useState(0);
  const [samplePlayhead, setSamplePlayhead] = useState(0);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'loop' | 'cue' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedCueTrackId, setSelectedCueTrackId] = useState<string | null>(null);
  const [playbackTimes, setPlaybackTimes] = useState<{ [key: string]: number }>({});
  const [zoomLevels, setZoomLevels] = useState<{ [key: string]: number }>({});
  const [playbackSpeeds, setPlaybackSpeeds] = useState<{ [key: string]: number }>({});
  const [showMeasures, setShowMeasures] = useState<{ [key: string]: boolean }>({});
  // Add state for showing cue thumbs
  const [showCueThumbs, setShowCueThumbs] = useState<{ [key: string]: boolean }>({});

  // Preload audio files on component mount
  useEffect(() => {
    const preloadAudioFiles = async () => {
      try {
        setIsLoading(true);
        
        // Initialize audio context if needed
        let context = audioContext;
        if (!context) {
          context = await initializeAudio();
          setIsAudioInitialized(true);
        }

        if (!context) {
          throw new Error('Failed to initialize audio context');
        }

        // Preload RON-drums as a loop track
        const ronResponse = await fetch(ronDrums);
        const ronBlob = await ronResponse.blob();
        const ronFile = new File([ronBlob], 'RON-drums.wav', { type: 'audio/wav' });
        
        const ronBuffer = await loadAudioBuffer(ronFile, context);
        const ronCuePoints = Array.from({ length: 10 }, (_, i) => 
          ronBuffer.duration * (i / 10)
        );
        
        const ronTrack: Track = {
          id: 'ron-drums',
          file: ronFile,
          buffer: ronBuffer,
          mode: 'loop',
          loopStart: 0,
          loopEnd: ronBuffer.duration,
          cuePoints: ronCuePoints,
          tempo: 120,
          timeSignature: { numerator: 4, denominator: 4 },
          firstMeasureTime: 0,
          showMeasures: false
        };

        // Preload Secrets of the Heart as a cue track
        const secretsResponse = await fetch(secretsOfTheHeart);
        const secretsBlob = await secretsResponse.blob();
        const secretsFile = new File([secretsBlob], 'Secrets of the Heart.mp3', { type: 'audio/mpeg' });
        
        const secretsBuffer = await loadAudioBuffer(secretsFile, context);
        const secretsCuePoints = Array.from({ length: 10 }, (_, i) => 
          secretsBuffer.duration * (i / 10)
        );
        
        const secretsTrack: Track = {
          id: 'secrets-of-the-heart',
          file: secretsFile,
          buffer: secretsBuffer,
          mode: 'cue',
          loopStart: 0,
          loopEnd: secretsBuffer.duration,
          cuePoints: secretsCuePoints,
          tempo: 120,
          timeSignature: { numerator: 4, denominator: 4 },
          firstMeasureTime: 0,
          showMeasures: false
        };

        setTracks([ronTrack, secretsTrack]);
        
      } catch (error) {
        console.error('Error preloading audio files:', error);
        setError('Failed to preload audio files. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    preloadAudioFiles();
  }, [audioContext, initializeAudio]);

  // Do NOT initialize audio context on component mount
  // Remove the useEffect that was trying to initialize the audio context automatically
  
  // Instead, initialize audio context only when needed (on user interaction)
  const ensureAudioContext = async () => {
    try {
      if (!isAudioInitialized) {
        // This should be called in a user interaction handler (click, etc.)
        await initializeAudio();
        setIsAudioInitialized(true);
      } else if (audioContext?.state === 'suspended') {
        // Resume if suspended
        await resumeAudioContext();
      }
      return true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      setError('Failed to initialize audio context. Please try again.');
      return false;
    }
  };

  const handleFileUpload = async (file: File, trackType: 'loop' | 'cue') => {
    try {
      setIsLoading(true);
      setError(null);
      setUploadError(null);
      
      // Validate file type
      if (!file.type.startsWith('audio/')) {
        throw new Error('Please upload an audio file (MP3, WAV, etc.)');
      }

      // Validate file size (e.g., max 50MB)
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size too large. Maximum size is 50MB.');
      }
      
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
          throw new Error('Browser blocked audio playback. Please click the upload button again.');
        }
      }

      if (!context) {
        throw new Error('Audio initialization failed. Please try again.');
      }
      
      // Load the audio file into buffer
      const buffer = await loadAudioBuffer(file, context);
      
      // Generate default cue points (10 points at 10% intervals)
      const cuePoints = Array.from({ length: 10 }, (_, i) => 
        buffer.duration * (i / 10)
      );
      
      // Create a new track
      const newTrack: Track = {
        id: Date.now().toString(),
        file,
        buffer,
        mode: trackType,
        loopStart: 0,
        loopEnd: buffer.duration,
        cuePoints,
        tempo: 120, // Default tempo
        timeSignature: { numerator: 4, denominator: 4 },
        firstMeasureTime: 0,
        showMeasures: false
      };
      
      setTracks(prev => [...prev, newTrack]);
    
    } catch (error) {
      console.error('Error loading audio file:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setUploadError(errorMessage);
      setError(`Error loading audio file: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

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
        const newCuePoints = [...track.cuePoints];
        newCuePoints[index] = time;
        return { ...track, cuePoints: newCuePoints };
      })
    );
  };
  
  const handleModeChange = (mode: 'loop' | 'cue') => {
    if (!tracks) return;
    
    setTracks(prev => 
      prev.map(track => 
        track ? { ...track, mode } : track
      )
    );
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

  // Add a function to handle playback for specific track type
  const togglePlayback = (trackType: 'loop' | 'cue') => {
    const track = tracks.find(t => t.mode === trackType);
    if (!track || !audioContext) return;
    
    ensureAudioBeforeAction(() => {
      // Call your existing playback functions, but modify them to work with the specified track
      // This will need more implementation to handle the actual audio playback
    });
  };

  const handleModeSelect = (mode: 'loop' | 'cue') => {
    setShowModeSelector(false);
    setSelectedMode(mode);
    document.getElementById('audio-input')?.click();
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

  // Zoom functions
  const handleZoomIn = (trackId: string) => {
    setZoomLevels(prev => {
      const currentZoom = prev[trackId] || 0.25;
      const newZoom = Math.min(currentZoom * 2, 8);
      return { ...prev, [trackId]: newZoom };
    });
  };

  const handleZoomOut = (trackId: string) => {
    setZoomLevels(prev => {
      const currentZoom = prev[trackId] || 0.25;
      const newZoom = Math.max(currentZoom / 2, 0.25);
      return { ...prev, [trackId]: newZoom };
    });
  };

  const handleResetZoom = (trackId: string) => {
    setZoomLevels(prev => ({ ...prev, [trackId]: 0.25 }));
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

  // Handle track removal
  const handleRemoveTrack = (trackId: string) => {
    setTracks(prev => prev.filter(track => track.id !== trackId));
    
    // Clean up associated state
    setPlaybackTimes(prev => {
      const newPlaybackTimes = { ...prev };
      delete newPlaybackTimes[trackId];
      return newPlaybackTimes;
    });
    
    setZoomLevels(prev => {
      const newZoomLevels = { ...prev };
      delete newZoomLevels[trackId];
      return newZoomLevels;
    });
    
    setPlaybackSpeeds(prev => {
      const newPlaybackSpeeds = { ...prev };
      delete newPlaybackSpeeds[trackId];
      return newPlaybackSpeeds;
    });
    
    setShowMeasures(prev => {
      const newShowMeasures = { ...prev };
      delete newShowMeasures[trackId];
      return newShowMeasures;
    });
    
    // Clear selection if this track was selected
    if (selectedCueTrackId === trackId) {
      setSelectedCueTrackId(null);
    }
  };

  // Add handler for toggling cue thumbs
  const handleToggleCueThumbs = (trackId: string) => {
    setShowCueThumbs(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  };

  // Welcome state when no tracks are loaded and not loading
  if (tracks.length === 0 && !isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg border p-8 text-center">
          <h1 className="text-2xl font-medium text-gray-900 mb-4">
            Welcome to TrackStitch Studio
          </h1>
          <p className="text-gray-600 mb-8">
            Upload an audio file and select a mode (loop or chop) to start flipping tracks straight from your browser.
          </p>
          
          <div className="relative inline-block">
            <button
              onClick={() => setShowModeSelector(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-md text-lg font-medium"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Upload Audio'}
            </button>
            
            {showModeSelector && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-md shadow-lg border z-10">
                <button
                  onClick={() => handleModeSelect('loop')}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700"
                >
                  Loop Mode
                </button>
                <button
                  onClick={() => handleModeSelect('cue')}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700"
                >
                  Chop Mode
                </button>
              </div>
            )}
            
            <input
              id="audio-input"
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && selectedMode) {
                  handleFileUpload(file, selectedMode);
                }
              }}
              className="hidden"
              aria-label="Upload Audio"
            />
          </div>

          {uploadError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{uploadError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg border p-8 text-center">
          <h1 className="text-2xl font-medium text-gray-900 mb-4">
            Loading TrackStitch Studio
          </h1>
          <p className="text-gray-600 mb-8">
            Preloading audio files...
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Add Track Button */}
      <div className="flex justify-end">
        <div className="relative inline-block">
          <button
            onClick={() => setShowModeSelector(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md"
          >
            Add Track
          </button>
          
          {showModeSelector && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg border z-10">
              <button
                onClick={() => {
                  setShowModeSelector(false);
                  setSelectedMode('loop');
                  document.getElementById('new-track-input')?.click();
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700"
              >
                Add Loop Track
              </button>
              <button
                onClick={() => {
                  setShowModeSelector(false);
                  setSelectedMode('cue');
                  document.getElementById('new-track-input')?.click();
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700"
              >
                Add Chop Track
              </button>
            </div>
          )}
          
          <input
            id="new-track-input"
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && selectedMode) {
                handleFileUpload(file, selectedMode);
              }
            }}
            className="hidden"
            aria-label="Upload Audio"
          />
        </div>
      </div>

      {/* Render all tracks */}
      {tracks.map((track) => (
        <div key={track.id} className="p-6 rounded-lg border bg-white">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              <h2 className={`text-xl font-medium ${track.mode === 'loop' ? 'text-indigo-600' : 'text-red-500'}`}>
                {track.mode === 'loop' ? 'Loop Track' : 'Sample Track'}
              </h2>
              
              {/* Zoom Controls */}
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleZoomOut(track.id)}
                  disabled={(zoomLevels[track.id] || 0.25) <= 0.25}
                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Zoom Out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                
                <button
                  onClick={() => handleResetZoom(track.id)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    (zoomLevels[track.id] || 0.25) > 0.25
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title="Reset Zoom"
                >
                  {(zoomLevels[track.id] || 0.25) === 0.25 ? 'Full' : `${(zoomLevels[track.id] || 0.25).toFixed(1)}x`}
                </button>
                
                <button
                  onClick={() => handleZoomIn(track.id)}
                  disabled={(zoomLevels[track.id] || 0.25) >= 8}
                  className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Zoom In"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">{track.file.name}</span>
              <button
                onClick={() => handleRemoveTrack(track.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                title="Remove Track"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tempo Controls */}
          <div className="mb-4">
            <TempoControls
              trackId={track.id}
              initialTempo={track.tempo}
              onTempoChange={handleTempoChange}
              playbackSpeed={playbackSpeeds[track.id] || 1}
              onSpeedChange={handleSpeedChange}
            />
          </div>

          {/* Time Signature and Measure Controls */}
          <div className="mb-4 space-y-3">
            <TimeSignatureControls
              timeSignature={track.timeSignature}
              onTimeSignatureChange={(timeSignature) => handleTimeSignatureChange(track.id, timeSignature)}
            />
            
            <div className="flex items-center justify-between">
              <button
                onClick={() => handleToggleMeasures(track.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  showMeasures[track.id]
                    ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                {showMeasures[track.id] ? 'Hide Measures' : 'Show Measures'}
              </button>
              
              {showMeasures[track.id] && (
                <div className="text-sm text-gray-600">
                  First measure at: {track.firstMeasureTime.toFixed(2)}s
                </div>
              )}
            {track.mode === 'cue' && (
              <button
                onClick={() => handleToggleCueThumbs(track.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  showCueThumbs[track.id]
                    ? 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
              >
                {showCueThumbs[track.id] ? 'Hide Cue Thumbs' : 'Show Cue Thumbs'}
              </button>
            )}
            </div>
          </div>

          <div 
            className="bg-gray-50 rounded-lg overflow-hidden relative box-border" 
            style={{ height: '140px' }}
          >
            {audioContext && (
              <WaveformDisplay
                audioFile={track.file}
                mode={track.mode}
                audioContext={audioContext}
                loopStart={track.loopStart}
                loopEnd={track.loopEnd}
                cuePoints={track.cuePoints}
                onLoopPointsChange={(start, end) => handleLoopPointsChange(track.id, start, end)}
                onCuePointChange={(index, time) => handleCuePointChange(track.id, index, time)}
                playhead={track.mode === 'loop' ? loopPlayhead : samplePlayhead}
                playbackTime={playbackTimes[track.id] || 0}
                zoomLevel={zoomLevels[track.id] || 0.25}
                onZoomIn={() => handleZoomIn(track.id)}
                onZoomOut={() => handleZoomOut(track.id)}
                onResetZoom={() => handleResetZoom(track.id)}
                trackId={track.id}
                showMeasures={showMeasures[track.id]}
                tempo={track.tempo}
                timeSignature={track.timeSignature}
                firstMeasureTime={track.firstMeasureTime}
                onFirstMeasureChange={(time) => handleFirstMeasureChange(track.id, time)}
                onTimeSignatureChange={(timeSignature) => handleTimeSignatureChange(track.id, timeSignature)}
                showCueThumbs={showCueThumbs[track.id]}
              />
            )}
          </div>

          {/* Track Controls */}
          {audioContext && (
            <TrackControls
              key={`controls-${track.id}`}
              mode={track.mode}
              audioContext={audioContext}
              audioBuffer={track.buffer}
              loopStart={track.loopStart}
              loopEnd={track.loopEnd}
              cuePoints={track.cuePoints}
              onLoopPointsChange={(start, end) => handleLoopPointsChange(track.id, start, end)}
              onCuePointChange={(index, time) => handleCuePointChange(track.id, index, time)}
              ensureAudio={ensureAudioBeforeAction}
              trackColor={track.mode === 'loop' ? 'indigo' : 'red'}
              setPlayhead={track.mode === 'loop' ? setLoopPlayhead : setSamplePlayhead}
              isSelected={track.id === selectedCueTrackId}
              onSelect={() => handleTrackSelect(track.id)}
              onPlaybackTimeChange={(time) => handlePlaybackTimeChange(track.id, time)}
              onSpeedChange={(speed) => handleSpeedChange(track.id, speed)}
              trackTempo={track.tempo}
            />
          )}

          {track.mode === 'cue' && track.id === selectedCueTrackId && (
            <div className="mt-4 bg-gray-100 p-3 rounded-md text-gray-700 text-sm">
              Press keyboard number keys 1-0 to trigger the corresponding cue points.
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Studio; 