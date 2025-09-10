import type { Meta, StoryObj } from '@storybook/react';
import Tooltip from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Debug/Tooltip Debug',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const HoverTest: Story = {
  args: {
    content: 'Hover tooltip test',
    trigger: 'hover',
    position: 'top',
    children: <button className="bg-blue-500 text-white px-4 py-2 rounded">Hover me</button>,
  },
};

export const ClickTest: Story = {
  args: {
    content: 'Click tooltip test',
    trigger: 'click',
    position: 'top',
    children: <button className="bg-green-500 text-white px-4 py-2 rounded">Click me</button>,
  },
};

export const FocusTest: Story = {
  args: {
    content: 'Focus tooltip test',
    trigger: 'focus',
    position: 'top',
    children: <input className="border border-gray-300 px-4 py-2 rounded" placeholder="Focus me" />,
  },
};

export const AllPositions: Story = {
  render: () => (
    <div className="flex gap-8 items-center justify-center p-8">
      <Tooltip content="Top tooltip" position="top" trigger="hover">
        <button className="bg-red-500 text-white px-4 py-2 rounded">Top</button>
      </Tooltip>
      <Tooltip content="Right tooltip" position="right" trigger="hover">
        <button className="bg-blue-500 text-white px-4 py-2 rounded">Right</button>
      </Tooltip>
      <Tooltip content="Bottom tooltip" position="bottom" trigger="hover">
        <button className="bg-green-500 text-white px-4 py-2 rounded">Bottom</button>
      </Tooltip>
      <Tooltip content="Left tooltip" position="left" trigger="hover">
        <button className="bg-purple-500 text-white px-4 py-2 rounded">Left</button>
      </Tooltip>
    </div>
  ),
};
