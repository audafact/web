import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Studio from '../../src/views/Studio';
import { AudioProvider } from '../../src/context/AudioContext';
import { expect as chaiExpect } from 'chai';

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock the AudioContext
vi.mock('../../src/context/AudioContext', () => ({
  useAudioContext: () => ({
    audioContext: {
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
      decodeAudioData: vi.fn().mockResolvedValue({
        duration: 10,
        sampleRate: 44100,
        numberOfChannels: 2,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(44100))
      })
    },
    initializeAudio: vi.fn().mockResolvedValue({
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
      decodeAudioData: vi.fn().mockResolvedValue({
        duration: 10,
        sampleRate: 44100,
        numberOfChannels: 2,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(44100))
      })
    }),
    resumeAudioContext: vi.fn().mockResolvedValue(undefined),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('Studio Upload Audio Button', () => {
  const renderStudio = () => {
    return render(
      <AudioProvider>
        <Studio />
      </AudioProvider>
    );
  };

  it('shows the upload audio button initially', () => {
    renderStudio();
    const uploadButtons = screen.getAllByRole('button', { name: 'Upload Audio' });
    expect(uploadButtons[0]).toBeDefined();
  });

  it('shows mode selector options when clicking upload button', () => {
    renderStudio();
    
    const uploadButtons = screen.getAllByRole('button', { name: 'Upload Audio' });
    fireEvent.click(uploadButtons[0]);
    
    expect(screen.getByText('Loop Mode')).toBeDefined();
    expect(screen.getByText('Chop Mode')).toBeDefined();
  });

  it('triggers file input when selecting Loop Mode', () => {
    renderStudio();
    
    // Click upload button to show options
    const uploadButtons = screen.getAllByRole('button', { name: 'Upload Audio' });
    fireEvent.click(uploadButtons[0]);
    
    // Click Loop Mode option
    const loopModeButton = screen.getByText('Loop Mode');
    fireEvent.click(loopModeButton);
    
    // Get the hidden file input
    const fileInputs = screen.getAllByLabelText('Upload Audio');
    expect(fileInputs[0].getAttribute('accept')).toBe('audio/*');
  });

  it('triggers file input when selecting Chop Mode', () => {
    renderStudio();
    
    // Click upload button to show options
    const uploadButtons = screen.getAllByRole('button', { name: 'Upload Audio' });
    fireEvent.click(uploadButtons[0]);
    
    // Click Chop Mode option
    const chopModeButton = screen.getByText('Chop Mode');
    fireEvent.click(chopModeButton);
    
    // Get the hidden file input
    const fileInputs = screen.getAllByLabelText('Upload Audio');
    expect(fileInputs[0].getAttribute('accept')).toBe('audio/*');
  });

  it('handles file upload after selecting a mode', async () => {
    renderStudio();
    
    // Click upload button to show options
    const uploadButtons = screen.getAllByRole('button', { name: 'Upload Audio' });
    fireEvent.click(uploadButtons[0]);
    
    // Click Loop Mode option
    const loopModeButton = screen.getByText('Loop Mode');
    fireEvent.click(loopModeButton);
    
    // Create a mock audio file
    const file = new File(['mock audio data'], 'test.mp3', { type: 'audio/mp3' });
    
    // Set up the mock URL.createObjectURL to return a mock URL
    mockCreateObjectURL.mockReturnValue('mock-url');
    
    // Mock FileReader
    const mockFileReader = {
      readAsArrayBuffer: vi.fn(),
      onload: null as ((e: { target: { result: ArrayBuffer } }) => void) | null,
      result: new ArrayBuffer(8)
    };
    global.FileReader = vi.fn(() => mockFileReader) as any;
    
    // Simulate file input change
    const fileInputs = screen.getAllByLabelText('Upload Audio');
    Object.defineProperty(fileInputs[0], 'files', {
      value: [file],
    });
    
    await act(async () => {
      fireEvent.change(fileInputs[0]);
    });

    // Simulate FileReader onload
    if (mockFileReader.onload) {
      await act(async () => {
        mockFileReader.onload!({ target: { result: new ArrayBuffer(8) } });
      });
    }

    // Wait for the file to be processed and UI to update
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Verify the file was uploaded successfully
    expect(screen.getByText('Loop Track')).toBeDefined();
    // Find the speed text within the Loop Track section
    const speedTexts = screen.getAllByText('1.0x');
    expect(speedTexts[0]).toBeDefined();
  });
});

describe('Studio Track Controls', () => {
  const renderStudioWithTrack = async () => {
    const renderResult = render(
      <AudioProvider>
        <Studio />
      </AudioProvider>
    );
    
    // Upload a file first
    const uploadButtons = screen.getAllByRole('button', { name: 'Upload Audio' });
    fireEvent.click(uploadButtons[0]);
    
    const loopModeButton = screen.getByText('Loop Mode');
    fireEvent.click(loopModeButton);
    
    const file = new File(['mock audio data'], 'test.mp3', { type: 'audio/mp3' });
    mockCreateObjectURL.mockReturnValue('mock-url');
    
    const mockFileReader = {
      readAsArrayBuffer: vi.fn(),
      onload: null as ((e: { target: { result: ArrayBuffer } }) => void) | null,
      result: new ArrayBuffer(8)
    };
    global.FileReader = vi.fn(() => mockFileReader) as any;
    
    const fileInputs = screen.getAllByLabelText('Upload Audio');
    Object.defineProperty(fileInputs[0], 'files', {
      value: [file],
    });
    
    await act(async () => {
      fireEvent.change(fileInputs[0]);
    });

    if (mockFileReader.onload) {
      await act(async () => {
        mockFileReader.onload!({ target: { result: new ArrayBuffer(8) } });
      });
    }

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    return renderResult;
  };

  it('shows play/pause button for loop tracks', async () => {
    await renderStudioWithTrack();
    
    // Look for the play button (should be present in the track controls)
    const playButtons = screen.getAllByRole('button');
    const playButton = playButtons.find(button => 
      button.querySelector('svg') && 
      button.querySelector('svg')?.getAttribute('class')?.includes('lucide-play')
    );
    expect(playButton).toBeDefined();
  });

  it('shows volume and speed controls', async () => {
    await renderStudioWithTrack();
    
    // Check for volume control
    expect(screen.getByText('Vol:')).toBeDefined();
    const volumeSliders = screen.getAllByDisplayValue('1').filter(el => 
      el.getAttribute('max') === '1' && el.getAttribute('min') === '0'
    );
    expect(volumeSliders[0]).toBeDefined();
    
    // Check for speed control
    expect(screen.getByText('Speed:')).toBeDefined();
    const speedSliders = screen.getAllByDisplayValue('1').filter(el => 
      el.getAttribute('max') === '2' && el.getAttribute('min') === '0.5'
    );
    expect(speedSliders[0]).toBeDefined();
  });

  it('shows loop time display for loop tracks', async () => {
    await renderStudioWithTrack();
    
    // Check for loop time display
    expect(screen.getByText(/Loop: 0\.00s - 10\.00s/)).toBeDefined();
  });
});

describe('Studio Cue Track Functionality', () => {
  const renderStudioWithCueTrack = async () => {
    const renderResult = render(
      <AudioProvider>
        <Studio />
      </AudioProvider>
    );
    
    // Upload a file in cue mode
    const uploadButtons = screen.getAllByRole('button', { name: 'Upload Audio' });
    fireEvent.click(uploadButtons[0]);
    
    const chopModeButton = screen.getByText('Chop Mode');
    fireEvent.click(chopModeButton);
    
    const file = new File(['mock audio data'], 'test.mp3', { type: 'audio/mp3' });
    mockCreateObjectURL.mockReturnValue('mock-url');
    
    const mockFileReader = {
      readAsArrayBuffer: vi.fn(),
      onload: null as ((e: { target: { result: ArrayBuffer } }) => void) | null,
      result: new ArrayBuffer(8)
    };
    global.FileReader = vi.fn(() => mockFileReader) as any;
    
    const fileInputs = screen.getAllByLabelText('Upload Audio');
    Object.defineProperty(fileInputs[0], 'files', {
      value: [file],
    });
    
    await act(async () => {
      fireEvent.change(fileInputs[0]);
    });

    if (mockFileReader.onload) {
      await act(async () => {
        mockFileReader.onload!({ target: { result: new ArrayBuffer(8) } });
      });
    }

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    return renderResult;
  };

  it('shows cue point buttons for cue tracks', async () => {
    await renderStudioWithCueTrack();
    
    // Check for cue points section
    expect(screen.getByText('Cue Points')).toBeDefined();
    
    // Check for cue point buttons (1-10)
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(i.toString())).toBeDefined();
    }
  });

  it('shows select to cue button for cue tracks', async () => {
    await renderStudioWithCueTrack();
    
    // Check for select to cue button
    expect(screen.getByText('Select to Cue')).toBeDefined();
  });

  it('allows selecting a cue track for keyboard control', async () => {
    await renderStudioWithCueTrack();
    
    const selectButton = screen.getByText('Select to Cue');
    
    await act(async () => {
      fireEvent.click(selectButton);
    });
    
    // Button should change to "Selected to Cue"
    expect(screen.getByText('Selected to Cue')).toBeDefined();
    
    // Should show keyboard instruction
    expect(screen.getByText('Press keyboard number keys 1-0 to trigger the corresponding cue points.')).toBeDefined();
  });
}); 