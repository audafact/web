import type { Meta, StoryObj } from '@storybook/react';
import HelpButton from './HelpButton';

const meta: Meta<typeof HelpButton> = {
  title: 'Components/HelpButton',
  component: HelpButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onStartTutorial: { action: 'started tutorial' },
    onShowHelp: { action: 'showed help' },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onStartTutorial: () => console.log('Tutorial started'),
    onShowHelp: () => console.log('Help shown'),
  },
};

export const WithCustomClass: Story = {
  args: {
    onStartTutorial: () => console.log('Tutorial started'),
    onShowHelp: () => console.log('Help shown'),
    className: 'bottom-4 right-4',
  },
};

export const Interactive: Story = {
  args: {
    onStartTutorial: () => alert('Tutorial started!'),
    onShowHelp: () => alert('Help shown!'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Click the help button to see the dropdown menu with options.',
      },
    },
  },
};
