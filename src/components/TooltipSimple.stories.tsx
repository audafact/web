import type { Meta, StoryObj } from '@storybook/react';
import Tooltip from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Debug/Tooltip Simple',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleTest: Story = {
  args: {
    content: 'Simple tooltip test',
    position: 'top',
    trigger: 'hover',
    children: <button className="bg-blue-500 text-white px-4 py-2 rounded">Hover me</button>,
  },
};
