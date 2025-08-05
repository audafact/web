import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingWalkthrough from '../../src/components/OnboardingWalkthrough';
import { OnboardingStep } from '../../src/components/OnboardingWalkthrough';

// Mock DOM querySelector
const mockQuerySelector = vi.fn();
Object.defineProperty(document, 'querySelector', {
  value: mockQuerySelector,
  writable: true
});

describe('OnboardingWalkthrough', () => {
  const mockSteps: OnboardingStep[] = [
    {
      id: 'step1',
      title: 'Welcome',
      description: 'Welcome to the app!',
      targetSelector: '.test-element',
      position: 'center'
    },
    {
      id: 'step2',
      title: 'Navigation',
      description: 'Use these controls to navigate.',
      targetSelector: '.nav-controls',
      position: 'bottom'
    }
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    steps: mockSteps,
    currentStep: 0,
    onStepChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuerySelector.mockReturnValue({
      getBoundingClientRect: () => ({
        top: 100,
        left: 100,
        width: 200,
        height: 50
      })
    });
  });

  it('renders when open', () => {
    render(<OnboardingWalkthrough {...defaultProps} />);
    
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the app!')).toBeInTheDocument();
  });

  it('shows progress indicator', () => {
    render(<OnboardingWalkthrough {...defaultProps} />);
    
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  it('calls onNext when Next button is clicked', () => {
    render(<OnboardingWalkthrough {...defaultProps} />);
    
    const nextButton = screen.getByText('Next →');
    fireEvent.click(nextButton);
    
    expect(defaultProps.onStepChange).toHaveBeenCalledWith(1);
  });

  it('calls onComplete when Next is clicked on last step', () => {
    render(
      <OnboardingWalkthrough 
        {...defaultProps} 
        currentStep={1} 
      />
    );
    
    const finishButton = screen.getByText('Finish');
    fireEvent.click(finishButton);
    
    expect(defaultProps.onComplete).toHaveBeenCalled();
  });

  it('calls onPrevious when Previous button is clicked', () => {
    render(
      <OnboardingWalkthrough 
        {...defaultProps} 
        currentStep={1} 
      />
    );
    
    const prevButton = screen.getByText('← Previous');
    fireEvent.click(prevButton);
    
    expect(defaultProps.onStepChange).toHaveBeenCalledWith(0);
  });

  it('disables Previous button on first step', () => {
    render(<OnboardingWalkthrough {...defaultProps} />);
    
    const prevButton = screen.getByText('← Previous');
    expect(prevButton).toBeDisabled();
  });

  it('calls onClose when Skip is clicked', () => {
    render(<OnboardingWalkthrough {...defaultProps} />);
    
    const skipButton = screen.getByText('Skip');
    fireEvent.click(skipButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when X is clicked', () => {
    render(<OnboardingWalkthrough {...defaultProps} />);
    
    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    render(
      <OnboardingWalkthrough 
        {...defaultProps} 
        isOpen={false} 
      />
    );
    
    expect(screen.queryByText('Welcome')).not.toBeInTheDocument();
  });

  it('executes action when step has action', () => {
    const mockAction = vi.fn();
    const stepsWithAction: OnboardingStep[] = [
      {
        ...mockSteps[0],
        action: mockAction
      }
    ];

    render(
      <OnboardingWalkthrough 
        {...defaultProps} 
        steps={stepsWithAction} 
      />
    );
    
    expect(mockAction).toHaveBeenCalled();
  });
}); 