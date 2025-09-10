import type { Meta, StoryObj } from '@storybook/react';
import Tooltip from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    content: {
      control: 'text',
      description: 'Content to display in the tooltip',
    },
    position: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      description: 'Position of the tooltip relative to the trigger',
    },
    trigger: {
      control: 'select',
      options: ['hover', 'click', 'focus'],
      description: 'How the tooltip is triggered',
    },
    delay: {
      control: 'number',
      description: 'Delay in milliseconds before showing the tooltip',
    },
    maxWidth: {
      control: 'number',
      description: 'Maximum width of the tooltip',
    },
    zIndex: {
      control: 'number',
      description: 'Z-index of the tooltip',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: 'This is a tooltip',
    children: <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Hover me</button>,
  },
};

export const DifferentPositions: Story = {
  render: () => (
    <div className="flex gap-8 items-center justify-center">
      <Tooltip content="Top tooltip" position="top">
        <button className="bg-green-500 text-white px-4 py-2 rounded">Top</button>
      </Tooltip>
      <Tooltip content="Right tooltip" position="right">
        <button className="bg-purple-500 text-white px-4 py-2 rounded">Right</button>
      </Tooltip>
      <Tooltip content="Bottom tooltip" position="bottom">
        <button className="bg-orange-500 text-white px-4 py-2 rounded">Bottom</button>
      </Tooltip>
      <Tooltip content="Left tooltip" position="left">
        <button className="bg-red-500 text-white px-4 py-2 rounded">Left</button>
      </Tooltip>
    </div>
  ),
};

export const ClickTrigger: Story = {
  args: {
    content: 'Click to show tooltip',
    trigger: 'click',
    children: <button className="bg-yellow-500 text-black px-4 py-2 rounded">Click me</button>,
  },
};

export const FocusTrigger: Story = {
  args: {
    content: 'Focus to show tooltip',
    trigger: 'focus',
    children: <input className="border border-gray-300 px-4 py-2 rounded" placeholder="Focus me" />,
  },
};

export const LongContent: Story = {
  args: {
    content: 'This is a very long tooltip content that should wrap to multiple lines and demonstrate how the tooltip handles longer text content.',
    maxWidth: 300,
    children: <button className="bg-indigo-500 text-white px-4 py-2 rounded">Long content</button>,
  },
};

export const CustomStyling: Story = {
  args: {
    content: (
      <div className="p-2">
        <div className="font-bold text-white">Custom Tooltip</div>
        <div className="text-sm text-gray-200">With custom HTML content</div>
      </div>
    ),
    children: <button className="bg-pink-500 text-white px-4 py-2 rounded">Custom</button>,
  },
};

export const WithDelay: Story = {
  args: {
    content: 'This tooltip has a 1 second delay',
    delay: 1000,
    children: <button className="bg-teal-500 text-white px-4 py-2 rounded">Delayed</button>,
  },
};
