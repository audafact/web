import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
  required?: boolean;
}

interface OnboardingWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  steps: OnboardingStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
}

const OnboardingWalkthrough: React.FC<OnboardingWalkthroughProps> = ({
  isOpen,
  onClose,
  onComplete,
  steps,
  currentStep,
  onStepChange
}) => {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || currentStep >= steps.length) return;

    const step = steps[currentStep];
    
    // Use a small delay to ensure DOM is ready
    const findElement = () => {
      const element = document.querySelector(step.targetSelector) as HTMLElement;
      
      // Debug mode
      const isDebugMode = localStorage.getItem('audafact_debug_onboarding') === 'true';
      
      if (element) {
        setTargetElement(element);
        
        if (isDebugMode) {
          console.log(`Onboarding: Found element for step "${step.id}"`, element);
        }
        
        // Execute action if provided
        if (step.action) {
          try {
            step.action();
          } catch (error) {
            console.warn('Onboarding action failed:', error);
          }
        }
      } else {
        console.warn(`Onboarding: Element not found for selector: ${step.targetSelector}`);
        if (isDebugMode) {
          console.log('Available elements with data-testid:', 
            Array.from(document.querySelectorAll('[data-testid]'))
              .map(el => ({ testid: el.getAttribute('data-testid'), tag: el.tagName }))
          );
        }
        setTargetElement(null);
      }
    };

    // Try immediately, then with a small delay
    findElement();
    const timeoutId = setTimeout(findElement, 100);

    return () => clearTimeout(timeoutId);
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, currentStep, steps.length]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      onStepChange(currentStep + 1);
    } else {
      onComplete();
    }
  }, [currentStep, steps.length, onStepChange, onComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  }, [currentStep, onStepChange]);

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!targetElement) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const rect = targetElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Tooltip dimensions and padding
    const tooltipWidth = 320;
    const tooltipHeight = 250; // Increased height to account for content
    const padding = 40; // Increased padding for better spacing

    // Default positioning
    let top = rect.top + rect.height / 2;
    let left = rect.left + rect.width / 2;
    let transform = 'translate(-50%, -50%)';

    switch (step.position) {
      case 'top':
        top = rect.top - 20;
        left = rect.left + rect.width / 2;
        transform = 'translateX(-50%)';
        
        // If tooltip would go off the top, flip to bottom
        if (top < tooltipHeight / 2 + padding) {
          top = rect.bottom + 20;
        }
        break;
        
      case 'bottom':
        // Add extra space for volume controls to avoid blocking the highlighted area
        const extraSpace = step.id === 'volume-controls' ? 120 : 60;
        top = rect.bottom + extraSpace;
        left = rect.left + rect.width / 2;
        transform = 'translateX(-50%)';
        
        // If tooltip would go off the bottom, flip to top
        if (top > viewportHeight - tooltipHeight - padding) {
          top = rect.top - extraSpace;
        }
        break;
        
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - 20;
        transform = 'translateY(-50%)';
        
        // If tooltip would go off the left, flip to right
        if (left < tooltipWidth / 2 + padding) {
          left = rect.right + 20;
        }
        break;
        
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + 20;
        transform = 'translateY(-50%)';
        
        // If tooltip would go off the right, flip to left
        if (left > viewportWidth - tooltipWidth / 2 - padding) {
          left = rect.left - 20;
        }
        break;
        
      case 'center':
      default:
        // Center in the viewport, not relative to the target element
        top = viewportHeight / 2;
        left = viewportWidth / 2;
        transform = 'translate(-50%, -50%)';
        break;
    }

    // Ensure tooltip stays within viewport bounds with extra margin
    const minLeft = tooltipWidth / 2 + padding;
    const maxLeft = viewportWidth - tooltipWidth / 2 - padding;
    const minTop = tooltipHeight / 2 + padding;
    const maxTop = viewportHeight - tooltipHeight / 2 - padding;

    // Clamp horizontal position
    left = Math.max(minLeft, Math.min(maxLeft, left));
    
    // Clamp vertical position with extra bottom margin
    const extraBottomMargin = 80; // Increased extra space from bottom edge
    const adjustedMaxTop = Math.min(maxTop, viewportHeight - tooltipHeight - extraBottomMargin);
    top = Math.max(minTop, Math.min(adjustedMaxTop, top));
    
    // Special handling for volume controls to position above the target
    if (step.id === 'volume-controls' && targetElement) {
      const rect = targetElement.getBoundingClientRect();
      top = rect.top - tooltipHeight - 40; // Position above with extra space
    }
    // Only reposition if tooltip is very close to bottom edge and would be cut off
    else if (top > viewportHeight - tooltipHeight - 50) {
      // Position above the target element instead
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const newTop = rect.top - tooltipHeight - 20;
        // Only move up if there's actually space above and it's better than current position
        if (newTop > padding && newTop < top) {
          top = newTop;
        }
      }
    }

    return { top: `${top}px`, left: `${left}px`, transform };
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={step.required ? undefined : handleNext}
      />

      {/* Highlight overlay */}
      {targetElement && (
        <div
          className="absolute border-2 border-audafact-accent-cyan rounded-lg shadow-lg transition-all duration-300 ease-in-out"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
            pointerEvents: 'none',
            boxShadow: '0 0 0 4px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.5)',
            opacity: targetElement ? 1 : 0,
            zIndex: 5 // Lower than the tooltip (z-50) but higher than background
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={overlayRef}
        className="absolute bg-audafact-surface-1 border border-audafact-divider rounded-lg shadow-xl max-w-sm p-4 transition-all duration-300 ease-in-out"
        style={{
          ...getTooltipPosition(),
          zIndex: 60 // Higher than highlight overlay
        }}
      >
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-audafact-text-secondary">
            Step {currentStep + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSkip}
              className="text-xs text-audafact-text-secondary hover:text-audafact-text-primary transition-colors"
            >
              Skip
            </button>
            <button
              onClick={onClose}
              className="text-xs text-audafact-text-secondary hover:text-audafact-text-primary transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-audafact-surface-2 rounded-full h-1 mb-3">
          <div
            className="bg-audafact-accent-cyan h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <h3 className="font-medium text-audafact-text-primary mb-2">
          {step.title}
        </h3>
        <p className="text-sm text-audafact-text-secondary mb-4">
          {step.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              currentStep === 0
                ? 'text-audafact-text-secondary cursor-not-allowed'
                : 'text-audafact-accent-cyan hover:bg-audafact-surface-2'
            }`}
          >
            ← Previous
          </button>

          <div className="flex items-center gap-2 text-xs text-audafact-text-secondary">
            <span>Use arrow keys or click to navigate</span>
          </div>

          <button
            onClick={handleNext}
            className="px-3 py-1 text-xs bg-audafact-accent-cyan text-audafact-bg-primary rounded hover:bg-opacity-90 transition-colors"
          >
            {currentStep === steps.length - 1 ? 'Finish' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWalkthrough; 