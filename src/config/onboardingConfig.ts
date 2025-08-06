import { OnboardingStep } from '../components/OnboardingWalkthrough';

export const createOnboardingSteps = (
  handlers: {
    onPlayTrack: () => void;
    onNextTrack: () => void;
    onPreviousTrack: () => void;
    onToggleSidePanel: () => void;
    onSwitchToLoopMode: () => void;
    onSwitchToCueMode: () => void;
    onToggleControls: () => void;
    onAdjustVolume: () => void;
    onSetLoopPoints: () => void;
    onTriggerCue: () => void;
  }
): OnboardingStep[] => [
  {
    id: 'welcome',
    title: 'Welcome to Audafact Studio!',
    description: 'Let\'s take a quick tour of your music production workspace. You can skip this anytime and explore freely.',
    targetSelector: '[data-testid="main-track-card"]',
    position: 'center',
    required: false
  },
  {
    id: 'track-navigation',
    title: 'Track Navigation',
    description: 'Use these arrow buttons to navigate between different tracks. You can also swipe left/right on mobile or use keyboard arrows.',
    targetSelector: '[data-testid="previous-track-button"], [data-testid="next-track-button"]',
    position: 'bottom'
  },
  {
    id: 'playback-controls',
    title: 'Playback Controls',
    description: 'Here you can play, pause, and control the current track. Try playing the track to hear it!',
    targetSelector: '[data-testid="play-button"], button[title*="Play"], button[title*="Pause"]',
    position: 'center',
    action: handlers.onPlayTrack
  },
  {
    id: 'track-modes',
    title: 'Track Modes',
    description: 'Switch between different playback modes: Preview (full track), Loop (repeat a section), and Chop (trigger specific points).',
    targetSelector: '[data-testid="preview-mode-button"], [data-testid="loop-mode-button"], [data-testid="chop-mode-button"]',
    position: 'bottom'
  },
  {
    id: 'loop-mode',
    title: 'Loop Mode',
    description: 'Switch to Loop mode to create repeating sections. You can set custom start and end points on the waveform.',
    targetSelector: '[data-testid="loop-mode-button"]',
    position: 'bottom',
    action: handlers.onSwitchToLoopMode
  },
  {
    id: 'loop-points',
    title: 'Setting Loop Points',
    description: 'Click and drag on the waveform to set your loop start and end points. The highlighted section will repeat continuously.',
    targetSelector: '.audafact-waveform-bg',
    position: 'top',
    action: handlers.onSetLoopPoints
  },
  {
    id: 'cue-mode',
    title: 'Chop Mode',
    description: 'Switch to Chop mode to trigger specific points in the track. Perfect for live performances and remixing.',
    targetSelector: '[data-testid="chop-mode-button"]',
    position: 'bottom',
    action: handlers.onSwitchToCueMode
  },
  {
    id: 'cue-triggering',
    title: 'Triggering Cues',
    description: 'In Chop mode, press keys 1-0 to trigger different cue points. Each number corresponds to a specific position in the track.',
    targetSelector: '.audafact-waveform-bg',
    position: 'top',
    action: handlers.onTriggerCue
  },
  {
    id: 'volume-controls',
    title: 'Volume & Effects',
    description: 'Adjust the volume, playback speed, and apply filters to shape your sound. Try the low-pass and high-pass filters for different effects.',
    targetSelector: '[data-testid="volume-control"], input[type="range"]',
    position: 'bottom',
    action: handlers.onAdjustVolume
  },
  {
    id: 'time-tempo-controls',
    title: 'Time & Tempo',
    description: 'Expand this section to adjust tempo and time signature. Great for matching different tracks and setting the musical grid.',
    targetSelector: '[data-testid="time-tempo-controls-button"]',
    position: 'bottom'
  },
  {
    id: 'side-panel',
    title: 'Track Library',
    description: 'Open the side panel to browse your track library. You can preview tracks and add them to your studio.',
    targetSelector: '[data-testid="side-panel-toggle"]',
    position: 'left'
  },
  {
    id: 'waveform-interaction',
    title: 'Waveform Interaction',
    description: 'Click anywhere on the waveform to jump to that position. Use the zoom controls to get a closer look at specific sections.',
    targetSelector: '.audafact-waveform-bg',
    position: 'top'
  },
  {
    id: 'measures-grid',
    title: 'Measures & Grid',
    description: 'Toggle the measures display to see musical grid lines. This helps with timing and beat matching.',
    targetSelector: '[data-testid="measures-button"]',
    position: 'bottom'
  },
  {
    id: 'completion',
    title: 'You\'re All Set!',
    description: 'You now know the basics of Audafact Studio. Feel free to explore and experiment with different tracks and features. Happy creating!',
    targetSelector: '[data-testid="main-track-card"]',
    position: 'center',
    required: false
  }
];

// Alternative shorter version for quick overview
export const createQuickOnboardingSteps = (
  handlers: {
    onPlayTrack: () => void;
    onNextTrack: () => void;
    onToggleSidePanel: () => void;
    onSwitchToLoopMode: () => void;
    onSwitchToCueMode: () => void;
  }
): OnboardingStep[] => [
  {
    id: 'welcome',
    title: 'Welcome to Audafact Studio!',
    description: 'Let\'s quickly explore the key features of your music production workspace.',
    targetSelector: '[data-testid="main-track-card"]',
    position: 'center'
  },
  {
    id: 'navigation',
    title: 'Track Navigation',
    description: 'Use arrow buttons to switch between tracks, or swipe on mobile.',
    targetSelector: '[data-testid="previous-track-button"], [data-testid="next-track-button"]',
    position: 'bottom'
  },
  {
    id: 'playback',
    title: 'Playback',
    description: 'Play, pause, and control your tracks. Try it now!',
    targetSelector: '[data-testid="play-button"], button[title*="Play"]',
    position: 'bottom',
    action: handlers.onPlayTrack
  },
  {
    id: 'modes',
    title: 'Three Modes',
    description: 'Preview (full track), Loop (repeat section), Chop (trigger points).',
    targetSelector: '[data-testid="preview-mode-button"], [data-testid="loop-mode-button"], [data-testid="chop-mode-button"]',
    position: 'bottom'
  },
  {
    id: 'library',
    title: 'Track Library',
    description: 'Browse and preview tracks from your library.',
    targetSelector: '[data-testid="side-panel-toggle"]',
    position: 'left',
    action: handlers.onToggleSidePanel
  },
  {
    id: 'ready',
    title: 'Ready to Create!',
    description: 'You\'re all set! Explore the features and start making music.',
    targetSelector: '[data-testid="main-track-card"]',
    position: 'center'
  }
]; 