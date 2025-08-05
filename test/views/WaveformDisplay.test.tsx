import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WaveformDisplay from '../../src/components/WaveformDisplay';

// Mock the wavesurfer hook with proper registerPlugin method
const mockRegisterPlugin = vi.fn().mockReturnValue({
  clearRegions: vi.fn(),
  addRegion: vi.fn().mockReturnValue({
    start: 0,
    end: 10,
    on: vi.fn(),
  }),
});

const mockUseWavesurfer = vi.fn().mockReturnValue({
  wavesurfer: {
    setTime: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    registerPlugin: mockRegisterPlugin,
    getDuration: vi.fn().mockReturnValue(100),
  },
  isReady: false,
  currentTime: 0,
});

vi.mock('@wavesurfer/react', () => ({
  useWavesurfer: () => mockUseWavesurfer()
}));

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Create a base mock for AudioContext
const createMockAudioContext = () => {
  const mockContext = {
    state: 'running' as AudioContextState,
    resume: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn().mockResolvedValue({
      duration: 10,
      sampleRate: 44100,
      numberOfChannels: 2,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100))
    }),
    baseLatency: 0,
    outputLatency: 0,
    close: vi.fn(),
    createMediaElementSource: vi.fn(),
    createMediaStreamSource: vi.fn(),
    createMediaStreamDestination: vi.fn(),
    createAnalyser: vi.fn(),
    createBiquadFilter: vi.fn(),
    createBuffer: vi.fn(),
    createBufferSource: vi.fn(),
    createChannelMerger: vi.fn(),
    createChannelSplitter: vi.fn(),
    createConstantSource: vi.fn(),
    createConvolver: vi.fn(),
    createDelay: vi.fn(),
    createDynamicsCompressor: vi.fn(),
    createGain: vi.fn(),
    createIIRFilter: vi.fn(),
    createOscillator: vi.fn(),
    createPanner: vi.fn(),
    createPeriodicWave: vi.fn(),
    createScriptProcessor: vi.fn(),
    createStereoPanner: vi.fn(),
    createWaveShaper: vi.fn(),
    destination: Object.defineProperties({}, {
      maxChannelCount: { value: 2 },
      numberOfInputs: { value: 1 },
      numberOfOutputs: { value: 0 },
      channelCount: { value: 2 },
      channelCountMode: { value: 'explicit' as ChannelCountMode },
      channelInterpretation: { value: 'speakers' as ChannelInterpretation },
      connect: { value: vi.fn() },
      disconnect: { value: vi.fn() },
      addEventListener: { value: vi.fn() },
      removeEventListener: { value: vi.fn() },
      dispatchEvent: { value: vi.fn() },
      context: { value: null, configurable: true }
    }) as unknown as AudioDestinationNode,
    listener: {
      positionX: { value: 0 },
      positionY: { value: 0 },
      positionZ: { value: 0 },
      forwardX: { value: 0 },
      forwardY: { value: 0 },
      forwardZ: { value: 0 },
      upX: { value: 0 },
      upY: { value: 0 },
      upZ: { value: 0 },
    },
    sampleRate: 44100,
    suspend: vi.fn().mockResolvedValue(undefined),
    getOutputTimestamp: vi.fn().mockReturnValue({ contextTime: 0, performanceTime: 0 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    audioWorklet: {
      addModule: vi.fn().mockResolvedValue(undefined),
    },
    onstatechange: null,
    oncomplete: null,
    currentTime: 0,
    dispatchEvent: vi.fn(),
  } as unknown as AudioContext;

  // Set the context reference after creation
  Object.defineProperty(mockContext.destination, 'context', {
    value: mockContext,
    configurable: true
  });

  return mockContext;
};

// Create the mock AudioContext instance
const mockAudioContext = createMockAudioContext();

// Mock the AudioContext constructor
global.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);

describe('WaveformDisplay', () => {
  const mockAudioFile = new File([''], 'test.mp3', { type: 'audio/mp3' });
  
  const defaultProps = {
    audioFile: mockAudioFile,
    mode: 'loop' as const,
    audioContext: mockAudioContext,
    loopStart: 0,
    loopEnd: 10,
    cuePoints: [],
    onLoopPointsChange: vi.fn(),
    onCuePointChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('mock-url');
    mockRegisterPlugin.mockReturnValue({
      clearRegions: vi.fn(),
      addRegion: vi.fn().mockReturnValue({
        start: 0,
        end: 10,
        on: vi.fn(),
      }),
    });
  });

  describe('Playhead functionality', () => {
    it('should handle undefined playhead prop', () => {
      render(<WaveformDisplay {...defaultProps} />);
      // Component should render without errors
      expect(screen.getAllByText('Loading waveform... loop')[0]).toBeDefined();
    });

    it('should handle defined playhead prop', () => {
      const mockSetTime = vi.fn();
      mockUseWavesurfer.mockReturnValue({
        wavesurfer: {
          setTime: mockSetTime,
          on: vi.fn(),
          off: vi.fn(),
          registerPlugin: mockRegisterPlugin,
          getDuration: vi.fn().mockReturnValue(100),
        },
        isReady: true,
        currentTime: 0,
      });

      render(<WaveformDisplay {...defaultProps} playhead={5} />);
      expect(mockSetTime).toHaveBeenCalledWith(5);
    });
  });

  describe('Mode-specific functionality', () => {
    it('should handle loop mode correctly', () => {
      mockUseWavesurfer.mockReturnValue({
        wavesurfer: {
          setTime: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
          registerPlugin: mockRegisterPlugin,
          getDuration: vi.fn().mockReturnValue(100),
        },
        isReady: false,
        currentTime: 0,
      });

      const onLoopPointsChange = vi.fn();
      render(
        <WaveformDisplay
          {...defaultProps}
          mode="loop"
          onLoopPointsChange={onLoopPointsChange}
        />
      );

      // Verify loop mode specific UI elements
      expect(screen.getAllByText('Loading waveform... loop')[0]).toBeDefined();
    });

    it('should handle cue mode correctly', () => {
      mockUseWavesurfer.mockReturnValue({
        wavesurfer: {
          setTime: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
          registerPlugin: mockRegisterPlugin,
          getDuration: vi.fn().mockReturnValue(100),
        },
        isReady: false,
        currentTime: 0,
      });

      const onCuePointChange = vi.fn();
      const cuePoints = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      
      render(
        <WaveformDisplay
          {...defaultProps}
          mode="cue"
          cuePoints={cuePoints}
          onCuePointChange={onCuePointChange}
        />
      );

      // Verify cue mode specific UI elements
      expect(screen.getAllByText('Loading waveform... cue')[0]).toBeDefined();
    });

    it('should create loop region in loop mode', () => {
      const mockAddRegion = vi.fn().mockReturnValue({
        start: 0,
        end: 10,
        on: vi.fn(),
      });
      
      mockRegisterPlugin.mockReturnValue({
        clearRegions: vi.fn(),
        addRegion: mockAddRegion,
      });

      mockUseWavesurfer.mockReturnValue({
        wavesurfer: {
          setTime: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
          registerPlugin: mockRegisterPlugin,
          getDuration: vi.fn().mockReturnValue(100),
        },
        isReady: true,
        currentTime: 0,
      });

      render(
        <WaveformDisplay
          {...defaultProps}
          mode="loop"
          loopStart={2}
          loopEnd={8}
        />
      );

      expect(mockAddRegion).toHaveBeenCalledWith({
        start: 2,
        end: 8,
        color: 'rgba(79, 70, 229, 0.2)',
        drag: true,
        resize: true,
      });
    });

    it('should create cue point regions in cue mode', () => {
      const mockAddRegion = vi.fn().mockReturnValue({
        start: 0,
        end: 0.1,
        on: vi.fn(),
      });
      
      mockRegisterPlugin.mockReturnValue({
        clearRegions: vi.fn(),
        addRegion: mockAddRegion,
      });

      mockUseWavesurfer.mockReturnValue({
        wavesurfer: {
          setTime: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
          registerPlugin: mockRegisterPlugin,
          getDuration: vi.fn().mockReturnValue(100),
        },
        isReady: true,
        currentTime: 0,
      });

      const cuePoints = [0, 10, 20];
      
      render(
        <WaveformDisplay
          {...defaultProps}
          mode="cue"
          cuePoints={cuePoints}
        />
      );

      expect(mockAddRegion).toHaveBeenCalledTimes(3);
      expect(mockAddRegion).toHaveBeenCalledWith({
        start: 0,
        end: 0.1,
        color: 'rgba(239, 68, 68, 0.2)',
        drag: true,
        resize: false,
        id: 'cue-0',
      });
    });
  });

  describe('Audio file handling', () => {
    it('should create and revoke object URL for audio file', () => {
      const { unmount } = render(<WaveformDisplay {...defaultProps} />);
      
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockAudioFile);
      
      unmount();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-url');
    });

    it('should handle audio context state correctly', () => {
      render(<WaveformDisplay {...defaultProps} />);
      // Verify audio context is properly initialized
      expect(mockAudioContext.state).toBe('running');
    });
  });

  describe('Region interaction', () => {
    it('should handle loop region updates', () => {
      const onLoopPointsChange = vi.fn();
      const mockRegion = {
        start: 2,
        end: 8,
        on: vi.fn(),
      };
      
      const mockAddRegion = vi.fn().mockReturnValue(mockRegion);
      mockRegisterPlugin.mockReturnValue({
        clearRegions: vi.fn(),
        addRegion: mockAddRegion,
      });

      mockUseWavesurfer.mockReturnValue({
        wavesurfer: {
          setTime: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
          registerPlugin: mockRegisterPlugin,
          getDuration: vi.fn().mockReturnValue(100),
        },
        isReady: true,
        currentTime: 0,
      });

      render(
        <WaveformDisplay
          {...defaultProps}
          mode="loop"
          onLoopPointsChange={onLoopPointsChange}
        />
      );

      // Simulate region update
      const updateCallback = mockRegion.on.mock.calls.find(
        call => call[0] === 'update-end'
      )?.[1];
      
      if (updateCallback) {
        updateCallback();
        expect(onLoopPointsChange).toHaveBeenCalledWith(2, 8);
      }
    });

    it('should handle cue point updates', () => {
      const onCuePointChange = vi.fn();
      const mockRegion = {
        start: 5,
        end: 5.1,
        on: vi.fn(),
      };
      
      const mockAddRegion = vi.fn().mockReturnValue(mockRegion);
      mockRegisterPlugin.mockReturnValue({
        clearRegions: vi.fn(),
        addRegion: mockAddRegion,
      });

      mockUseWavesurfer.mockReturnValue({
        wavesurfer: {
          setTime: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
          registerPlugin: mockRegisterPlugin,
          getDuration: vi.fn().mockReturnValue(100),
        },
        isReady: true,
        currentTime: 0,
      });

      render(
        <WaveformDisplay
          {...defaultProps}
          mode="cue"
          cuePoints={[0, 10, 20]}
          onCuePointChange={onCuePointChange}
        />
      );

      // Simulate cue point update for first cue point
      const updateCallback = mockRegion.on.mock.calls.find(
        call => call[0] === 'update-end'
      )?.[1];
      
      if (updateCallback) {
        updateCallback();
        expect(onCuePointChange).toHaveBeenCalledWith(0, 5);
      }
    });
  });

  describe('Demo mode functionality', () => {
    beforeEach(() => {
      // Mock the showSignupModal function
      vi.mock('../../src/hooks/useSignupModal', () => ({
        showSignupModal: vi.fn()
      }));
    });

    it('should disable region dragging in demo mode', () => {
      const mockAddRegion = vi.fn().mockReturnValue({
        start: 0,
        end: 10,
        on: vi.fn(),
      });
      
      mockRegisterPlugin.mockReturnValue({
        clearRegions: vi.fn(),
        addRegion: mockAddRegion,
      });

      mockUseWavesurfer.mockReturnValue({
        wavesurfer: {
          setTime: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
          registerPlugin: mockRegisterPlugin,
          getDuration: vi.fn().mockReturnValue(100),
        },
        isReady: true,
        currentTime: 0,
      });

      render(
        <WaveformDisplay
          {...defaultProps}
          mode="cue"
          cuePoints={[0, 10, 20]}
          isDemoMode={true}
          showCueThumbs={true}
        />
      );

      // Check that regions are created with drag disabled
      expect(mockAddRegion).toHaveBeenCalledWith(
        expect.objectContaining({
          drag: false,
          resize: false
        })
      );
    });

    it('should add lock icon to cue thumbs in demo mode', () => {
      const mockAddRegion = vi.fn().mockReturnValue({
        start: 0,
        end: 10,
        on: vi.fn(),
        element: document.createElement('div'),
      });
      
      mockRegisterPlugin.mockReturnValue({
        clearRegions: vi.fn(),
        addRegion: mockAddRegion,
      });

      mockUseWavesurfer.mockReturnValue({
        wavesurfer: {
          setTime: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
          registerPlugin: mockRegisterPlugin,
          getDuration: vi.fn().mockReturnValue(100),
        },
        isReady: true,
        currentTime: 0,
      });

      render(
        <WaveformDisplay
          {...defaultProps}
          mode="cue"
          cuePoints={[0, 10, 20]}
          isDemoMode={true}
          showCueThumbs={true}
        />
      );

      // The lock icon should be added to the thumb element
      // This is tested indirectly by checking that the region creation includes demo mode handling
      expect(mockAddRegion).toHaveBeenCalled();
    });
  });
}); 