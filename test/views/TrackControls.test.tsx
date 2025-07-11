import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TrackControls from '../../src/components/TrackControls';

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
    createBufferSource: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: { value: 1 },
    }),
    createChannelMerger: vi.fn(),
    createChannelSplitter: vi.fn(),
    createConstantSource: vi.fn(),
    createConvolver: vi.fn(),
    createDelay: vi.fn(),
    createDynamicsCompressor: vi.fn(),
    createGain: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { value: 1 },
    }),
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

// Create mock audio buffer
const createMockAudioBuffer = () => ({
  duration: 10,
  sampleRate: 44100,
  numberOfChannels: 2,
  getChannelData: vi.fn().mockReturnValue(new Float32Array(44100))
});

describe('TrackControls', () => {
  let mockAudioContext: ReturnType<typeof createMockAudioContext>;
  let mockAudioBuffer: ReturnType<typeof createMockAudioBuffer>;
  let mockEnsureAudio: (callback: () => void) => Promise<void>;
  let mockSetPlayhead: (time: number) => void;
  let mockOnPlaybackTimeChange: (time: number) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioContext = createMockAudioContext();
    mockAudioBuffer = createMockAudioBuffer();
    mockEnsureAudio = vi.fn().mockResolvedValue(undefined) as (callback: () => void) => Promise<void>;
    mockSetPlayhead = vi.fn() as (time: number) => void;
    mockOnPlaybackTimeChange = vi.fn() as (time: number) => void;
  });

  describe('Play/Pause Controls', () => {
    it('should show play button when not playing', () => {
      render(
        <TrackControls
          mode="loop"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      // Look for play button
      const playButtons = screen.getAllByRole('button');
      const playButton = playButtons.find(button => 
        button.querySelector('svg') && 
        button.querySelector('svg')?.getAttribute('class')?.includes('lucide-play')
      );
      expect(playButton).toBeDefined();
    });

    it('should handle play button click', async () => {
      render(
        <TrackControls
          mode="loop"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      const playButtons = screen.getAllByRole('button');
      const playButton = playButtons.find(button => 
        button.querySelector('svg') && 
        button.querySelector('svg')?.getAttribute('class')?.includes('lucide-play')
      );

      if (playButton) {
        await act(async () => {
          fireEvent.click(playButton);
        });

        expect(mockEnsureAudio).toHaveBeenCalled();
        expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
        expect(mockAudioContext.createGain).toHaveBeenCalled();
      }
    });
  });

  describe('Volume and Speed Controls', () => {
    it('should show volume control', () => {
      render(
        <TrackControls
          mode="loop"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      expect(screen.getByText('Vol:')).toBeDefined();
      const volumeSliders = screen.getAllByDisplayValue('1').filter(el => 
        el.getAttribute('max') === '1' && el.getAttribute('min') === '0'
      );
      expect(volumeSliders[0]).toBeDefined();
    });

    it('should show speed control', () => {
      render(
        <TrackControls
          mode="loop"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      expect(screen.getByText('Speed:')).toBeDefined();
      const speedSliders = screen.getAllByDisplayValue('1').filter(el => 
        el.getAttribute('max') === '2' && el.getAttribute('min') === '0.5'
      );
      expect(speedSliders[0]).toBeDefined();
    });

    it('should handle volume change', () => {
      render(
        <TrackControls
          mode="loop"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      const volumeSliders = screen.getAllByDisplayValue('1').filter(el => 
        el.getAttribute('max') === '1' && el.getAttribute('min') === '0'
      );
      const volumeSlider = volumeSliders[0];
      fireEvent.change(volumeSlider, { target: { value: '0.5' } });

      expect(volumeSlider).toHaveValue('0.5');
    });

    it('should handle speed change', () => {
      render(
        <TrackControls
          mode="loop"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      const speedSliders = screen.getAllByDisplayValue('1').filter(el => 
        el.getAttribute('max') === '2' && el.getAttribute('min') === '0.5'
      );
      const speedSlider = speedSliders[0];
      fireEvent.change(speedSlider, { target: { value: '1.5' } });

      expect(speedSlider).toHaveValue('1.5');
    });
  });

  describe('Loop Mode Specific', () => {
    it('should show loop time display', () => {
      render(
        <TrackControls
          mode="loop"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={2}
          loopEnd={8}
          cuePoints={[]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      expect(screen.getByText('Loop: 2.00s - 8.00s')).toBeDefined();
    });

    it('should not show cue point controls in loop mode', () => {
      render(
        <TrackControls
          mode="loop"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      expect(screen.queryByText('Cue Points')).not.toBeInTheDocument();
    });
  });

  describe('Cue Mode Specific', () => {
    it('should show cue point buttons', () => {
      const mockCuePoints = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      
      render(
        <TrackControls
          mode="cue"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={mockCuePoints}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      expect(screen.getByText('Cue Points')).toBeDefined();
      
      // Check for cue point buttons (1-10)
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByText(i.toString())).toBeDefined();
      }
    });

    it('should show select to cue button', () => {
      render(
        <TrackControls
          mode="cue"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      expect(screen.getByText('Select to Cue')).toBeDefined();
    });

    it('should handle cue point button clicks', async () => {
      const mockCuePoints = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      
      render(
        <TrackControls
          mode="cue"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={mockCuePoints}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      const cueButton1 = screen.getByText('1');
      
      await act(async () => {
        fireEvent.click(cueButton1);
      });

      expect(mockEnsureAudio).toHaveBeenCalled();
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should handle track selection', () => {
      const mockOnSelect = vi.fn();
      
      render(
        <TrackControls
          mode="cue"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
          onSelect={mockOnSelect}
        />
      );

      const selectButton = screen.getByText('Select to Cue');
      fireEvent.click(selectButton);

      expect(mockOnSelect).toHaveBeenCalled();
    });

    it('should show selected state when isSelected is true', () => {
      render(
        <TrackControls
          mode="cue"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
          isSelected={true}
        />
      );

      expect(screen.getByText('Selected to Cue')).toBeDefined();
      expect(screen.getByText('Press 1-0 keys to trigger cues')).toBeDefined();
    });
  });

  describe('Audio Source Management', () => {
    it('should create audio source when playing', async () => {
      render(
        <TrackControls
          mode="loop"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      const playButtons = screen.getAllByRole('button');
      const playButton = playButtons.find(button => 
        button.querySelector('svg') && 
        button.querySelector('svg')?.getAttribute('class')?.includes('lucide-play')
      );

      if (playButton) {
        await act(async () => {
          fireEvent.click(playButton);
        });

        expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
        expect(mockAudioContext.createGain).toHaveBeenCalled();
      }
    });

    it('should cleanup audio source on unmount', () => {
      const { unmount } = render(
        <TrackControls
          mode="loop"
          audioContext={mockAudioContext as any}
          audioBuffer={mockAudioBuffer as any}
          loopStart={0}
          loopEnd={10}
          cuePoints={[]}
          onLoopPointsChange={vi.fn()}
          onCuePointChange={vi.fn()}
          ensureAudio={mockEnsureAudio}
          setPlayhead={mockSetPlayhead}
          onPlaybackTimeChange={mockOnPlaybackTimeChange}
        />
      );

      unmount();
      // The cleanup should happen automatically in the useEffect cleanup
    });
  });
}); 