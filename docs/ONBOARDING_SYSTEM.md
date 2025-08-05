# 🎯 Onboarding System Documentation

## Overview

The Audafact onboarding system provides an interactive walkthrough that guides new users through the app's key features. It's designed to be non-intrusive, allowing users to exit anytime and re-engage when needed.

## Features

- **Step-by-step guidance** with highlighted UI elements
- **Keyboard navigation** (arrow keys, space, escape)
- **Progress tracking** with localStorage persistence
- **Re-engageable** - users can restart the tutorial anytime
- **Contextual actions** - automatically performs actions during the walkthrough
- **Responsive design** - works on desktop and mobile
- **Help system** - floating help button and comprehensive help modal

## Components

### 1. OnboardingWalkthrough
The main overlay component that displays the tutorial steps.

**Props:**
- `isOpen: boolean` - Controls visibility
- `onClose: () => void` - Called when user exits
- `onComplete: () => void` - Called when tutorial finishes
- `steps: OnboardingStep[]` - Array of tutorial steps
- `currentStep: number` - Current step index
- `onStepChange: (step: number) => void` - Called when step changes

### 2. HelpButton
Floating button that allows users to restart the tutorial or access help.

**Props:**
- `onStartTutorial: () => void` - Starts the tutorial
- `onShowHelp: () => void` - Opens help modal
- `className?: string` - Additional CSS classes

### 3. HelpModal
Comprehensive help modal with keyboard shortcuts, tips, and feature explanations.

**Props:**
- `isOpen: boolean` - Controls visibility
- `onClose: () => void` - Called when modal closes

## Configuration

### Onboarding Steps

Steps are defined in `src/config/onboardingConfig.ts`:

```typescript
interface OnboardingStep {
  id: string;                    // Unique identifier
  title: string;                 // Step title
  description: string;           // Step description
  targetSelector: string;        // CSS selector for target element
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'; // Tooltip position
  action?: () => void;           // Optional action to perform
  required?: boolean;            // Whether step can be skipped
}
```

### Creating Custom Steps

1. **Define the step:**
```typescript
{
  id: 'custom-feature',
  title: 'Custom Feature',
  description: 'This is how to use the custom feature.',
  targetSelector: '[data-testid="custom-button"]',
  position: 'bottom',
  action: () => {
    // Perform custom action
  }
}
```

2. **Add data attributes to target elements:**
```tsx
<button data-testid="custom-button">
  Custom Button
</button>
```

3. **Add the step to the configuration:**
```typescript
export const createOnboardingSteps = (handlers) => [
  // ... existing steps
  {
    id: 'custom-feature',
    title: 'Custom Feature',
    description: 'This is how to use the custom feature.',
    targetSelector: '[data-testid="custom-button"]',
    position: 'bottom',
    action: handlers.onCustomAction
  }
];
```

## Integration

### In Studio Component

The onboarding system is integrated into the Studio component:

```typescript
// Initialize onboarding
const onboarding = useOnboarding(onboardingSteps);

// Start onboarding after track loads
if (onboarding.shouldShowOnboarding()) {
  setTimeout(() => {
    onboarding.startOnboarding();
  }, 1000);
}

// Render components
<OnboardingWalkthrough
  isOpen={onboarding.isOpen}
  onClose={onboarding.closeOnboarding}
  onComplete={onboarding.completeOnboarding}
  steps={onboardingSteps}
  currentStep={onboarding.currentStep}
  onStepChange={onboarding.setCurrentStep}
/>

<HelpButton
  onStartTutorial={onboarding.startOnboarding}
  onShowHelp={() => setShowHelpModal(true)}
/>

<HelpModal
  isOpen={showHelpModal}
  onClose={() => setShowHelpModal(false)}
/>
```

## User Experience

### First-Time Users
1. Load a random track
2. Onboarding automatically starts after 1 second
3. Users are guided through key features
4. Can skip or exit anytime
5. Progress is saved to localStorage

### Returning Users
1. Can access help via floating button
2. Can restart tutorial anytime
3. Help modal provides comprehensive information
4. Keyboard shortcuts available

### Keyboard Shortcuts
- `?` - Open help modal
- `Arrow Keys` - Navigate tutorial steps
- `Space` - Next step
- `Escape` - Close tutorial/help

## Customization

### Adding New Features
1. Create step configuration
2. Add data attributes to UI elements
3. Define handlers for actions
4. Update help modal content

### Styling
The onboarding system uses Tailwind CSS classes that match the app's design system:
- `audafact-*` classes for colors and styling
- Responsive design with mobile considerations
- Smooth animations and transitions

### Localization
To support multiple languages:
1. Extract text to translation files
2. Update step configurations to use translation keys
3. Update help modal content

## Testing

Run the onboarding tests:
```bash
npm test OnboardingWalkthrough
```

The test suite covers:
- Component rendering
- User interactions
- Keyboard navigation
- Action execution
- State management

## Best Practices

1. **Keep steps focused** - Each step should cover one concept
2. **Use clear selectors** - Prefer data-testid attributes
3. **Provide context** - Explain why features are useful
4. **Allow skipping** - Don't force users through every step
5. **Test thoroughly** - Ensure selectors work across devices
6. **Update regularly** - Keep content current with app changes

## Troubleshooting

### Common Issues

1. **Elements not found**
   - Check that data-testid attributes are present
   - Verify selectors are correct
   - Ensure elements are rendered before onboarding starts

2. **Actions not working**
   - Verify handlers are properly defined
   - Check that required state is available
   - Test actions manually

3. **Positioning issues**
   - Check element dimensions
   - Verify viewport calculations
   - Test on different screen sizes

### Debug Mode

Enable debug logging by setting:
```typescript
localStorage.setItem('audafact_debug_onboarding', 'true');
```

This will log step transitions and element targeting to the console. 