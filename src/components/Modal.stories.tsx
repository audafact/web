import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal } from './Modal';

const meta: Meta<typeof Modal> = {
  title: 'Components/Modal',
  component: Modal,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    onClose: { action: 'modal closed' },
    children: {
      control: 'text',
      description: 'Content to display in the modal',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to manage modal state
const ModalWrapper = ({ isOpen: initialOpen = false, children, ...props }: any) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  
  return (
    <div>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Open Modal
      </button>
      <Modal 
        {...props}
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
      >
        {children}
      </Modal>
    </div>
  );
};

export const Default: Story = {
  render: (args) => (
    <ModalWrapper {...args}>
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Modal Title</h2>
        <p className="mb-4">This is the modal content. Click outside or press Escape to close.</p>
        <button className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Action Button
        </button>
      </div>
    </ModalWrapper>
  ),
};

export const WithCustomContent: Story = {
  render: (args) => (
    <ModalWrapper {...args}>
      <div className="p-8 max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Confirm Action</h2>
        <p className="mb-6 text-center text-gray-600">
          Are you sure you want to perform this action? This cannot be undone.
        </p>
        <div className="flex gap-4 justify-center">
          <button className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600">
            Delete
          </button>
          <button className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600">
            Cancel
          </button>
        </div>
      </div>
    </ModalWrapper>
  ),
};

export const LargeContent: Story = {
  render: (args) => (
    <ModalWrapper {...args}>
      <div className="p-8 max-w-2xl">
        <h2 className="text-3xl font-bold mb-6">Large Modal Content</h2>
        <div className="space-y-4">
          <p>This is a modal with more content to demonstrate how it handles larger content areas.</p>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-semibold mb-2">Information Box</h3>
            <p>This is an information box within the modal to show nested content.</p>
          </div>
          <button className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
            Full Width Button
          </button>
        </div>
      </div>
    </ModalWrapper>
  ),
};
