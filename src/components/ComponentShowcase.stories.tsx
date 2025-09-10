import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import HelpButton from './HelpButton';
import { Modal } from './Modal';
import Tooltip from './Tooltip';
import LibraryTrackItem from './LibraryTrackItem';

const meta: Meta = {
  title: 'Showcase/Component Showcase',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

const mockTrack = {
  id: '1',
  name: 'Showcase Track',
  artist: 'Demo Artist',
  genre: 'Electronic',
  bpm: 128,
  key: 'C',
  duration: 240,
  fileKey: 'showcase-track-key',
  previewKey: 'showcase-preview-key',
  type: 'mp3' as const,
  size: '6MB',
  tags: ['electronic', 'demo', 'showcase'],
  isProOnly: false,
  previewUrl: 'https://example.com/preview.mp3',
  rotationWeek: 1,
  isActive: true,
  isDemo: false,
};

export const AllComponents: Story = {
  render: () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    return (
      <div className="audafact-bg-primary audafact-text-primary min-h-screen p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-3xl font-bold audafact-heading mb-8">Audafact Component Showcase</h1>
          
          {/* Help Button Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold audafact-heading">Help Button</h2>
            <div className="relative h-32 bg-audafact-surface-1 rounded-lg p-4">
              <HelpButton 
                onStartTutorial={() => console.log('Tutorial started')}
                onShowHelp={() => console.log('Help shown')}
              />
              <p className="text-sm audafact-text-secondary">Click the help button in the bottom right corner</p>
            </div>
          </section>

          {/* Modal Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold audafact-heading">Modal</h2>
            <div className="space-x-4">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-audafact-accent-cyan text-audafact-bg-primary px-4 py-2 rounded hover:bg-opacity-90"
              >
                Open Modal
              </button>
            </div>
            <Modal 
              isOpen={isModalOpen} 
              onClose={() => setIsModalOpen(false)}
            >
              <div className="p-6 max-w-md">
                <h3 className="text-xl font-bold mb-4 audafact-heading">Modal Example</h3>
                <p className="mb-4 audafact-text-secondary">
                  This is an example modal with some content. Click outside or press Escape to close.
                </p>
                <div className="flex gap-2 justify-end">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="bg-audafact-surface-2 text-audafact-text-primary px-4 py-2 rounded hover:bg-audafact-divider"
                  >
                    Close
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="bg-audafact-accent-cyan text-audafact-bg-primary px-4 py-2 rounded hover:bg-opacity-90"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </Modal>
          </section>

          {/* Tooltip Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold audafact-heading">Tooltips</h2>
            <div className="flex gap-4 items-center">
              <Tooltip content="This is a top tooltip" position="top">
                <button className="bg-audafact-surface-2 text-audafact-text-primary px-4 py-2 rounded hover:bg-audafact-divider">
                  Hover me (Top)
                </button>
              </Tooltip>
              <Tooltip content="This is a right tooltip" position="right">
                <button className="bg-audafact-surface-2 text-audafact-text-primary px-4 py-2 rounded hover:bg-audafact-divider">
                  Hover me (Right)
                </button>
              </Tooltip>
              <Tooltip content="This is a bottom tooltip" position="bottom">
                <button className="bg-audafact-surface-2 text-audafact-text-primary px-4 py-2 rounded hover:bg-audafact-divider">
                  Hover me (Bottom)
                </button>
              </Tooltip>
              <Tooltip content="This is a left tooltip" position="left">
                <button className="bg-audafact-surface-2 text-audafact-text-primary px-4 py-2 rounded hover:bg-audafact-divider">
                  Hover me (Left)
                </button>
              </Tooltip>
            </div>
          </section>

          {/* Library Track Item Section */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold audafact-heading">Library Track Item</h2>
            <div className="max-w-md">
              <LibraryTrackItem 
                track={mockTrack}
                isPreviewing={false}
                onPreview={() => console.log('Preview clicked')}
                onAddToStudio={() => console.log('Add to studio clicked')}
                canAddToStudio={true}
                isProOnly={false}
              />
            </div>
          </section>

          {/* Interactive Elements */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold audafact-heading">Interactive Elements</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-audafact-surface-1 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 audafact-heading">Buttons</h3>
                <div className="space-y-2">
                  <button className="w-full bg-audafact-accent-cyan text-audafact-bg-primary py-2 rounded hover:bg-opacity-90">
                    Primary Button
                  </button>
                  <button className="w-full bg-audafact-surface-2 text-audafact-text-primary py-2 rounded hover:bg-audafact-divider">
                    Secondary Button
                  </button>
                </div>
              </div>
              
              <div className="bg-audafact-surface-1 p-4 rounded-lg">
                <h3 className="font-semibold mb-2 audafact-heading">Form Elements</h3>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    placeholder="Text input"
                    className="w-full bg-audafact-surface-2 text-audafact-text-primary px-3 py-2 rounded border border-audafact-divider"
                  />
                  <select className="w-full bg-audafact-surface-2 text-audafact-text-primary px-3 py-2 rounded border border-audafact-divider">
                    <option>Select an option</option>
                    <option>Option 1</option>
                    <option>Option 2</option>
                  </select>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  },
};
