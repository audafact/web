import type { Meta, StoryObj } from '@storybook/react';
import LibraryTrackItem from './LibraryTrackItem';

const meta: Meta<typeof LibraryTrackItem> = {
  title: 'Components/LibraryTrackItem',
  component: LibraryTrackItem,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    track: {
      description: 'The track data object',
    },
    isPreviewing: {
      control: 'boolean',
      description: 'Whether the track is currently being previewed',
    },
    onPreview: { action: 'preview clicked' },
    onAddToStudio: { action: 'add to studio clicked' },
    canAddToStudio: {
      control: 'boolean',
      description: 'Whether the track can be added to studio',
    },
    isProOnly: {
      control: 'boolean',
      description: 'Whether the track is pro-only',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockTrack = {
  id: '1',
  name: 'Sample Track',
  artist: 'Test Artist',
  genre: 'Electronic',
  bpm: 120,
  key: 'C',
  duration: 180,
  fileKey: 'sample-track-key',
  previewKey: 'sample-preview-key',
  type: 'mp3' as const,
  size: '5MB',
  tags: ['electronic', 'dance'],
  isProOnly: false,
  previewUrl: 'https://example.com/preview.mp3',
  rotationWeek: 1,
  isActive: true,
  isDemo: false,
};

export const Default: Story = {
  args: {
    track: mockTrack,
    isPreviewing: false,
    onPreview: () => console.log('Preview clicked'),
    onAddToStudio: () => console.log('Add to studio clicked'),
    canAddToStudio: true,
    isProOnly: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'A basic library track item with all standard features enabled.',
      },
    },
  },
};

export const ProOnly: Story = {
  args: {
    track: {
      ...mockTrack,
      name: 'Pro Track',
      isProOnly: true,
    },
    isPreviewing: false,
    onPreview: () => console.log('Preview clicked'),
    onAddToStudio: () => console.log('Add to studio clicked'),
    canAddToStudio: false,
    isProOnly: true,
  },
};

export const CurrentlyPreviewing: Story = {
  args: {
    track: mockTrack,
    isPreviewing: true,
    onPreview: () => console.log('Preview clicked'),
    onAddToStudio: () => console.log('Add to studio clicked'),
    canAddToStudio: true,
    isProOnly: false,
  },
};

export const WavTrack: Story = {
  args: {
    track: {
      ...mockTrack,
      name: 'WAV Track',
      type: 'wav' as const,
      size: '15MB',
    },
    isPreviewing: false,
    onPreview: () => console.log('Preview clicked'),
    onAddToStudio: () => console.log('Add to studio clicked'),
    canAddToStudio: true,
    isProOnly: false,
  },
};
