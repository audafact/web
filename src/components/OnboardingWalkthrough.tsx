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
  const ranActionForStepRef = useRef<string | null>(null);
  const [, setPositionTick] = useState<number>(0);

  useEffect(() => {
    if (!isOpen || currentStep >= steps.length) return;

    const step = steps[currentStep];
    
    // Use a small delay to ensure DOM is ready
    const findElement = () => {
      // Ensure any step action (which may mutate the layout) runs before measuring
      if (step.action && ranActionForStepRef.current !== step.id) {
        ranActionForStepRef.current = step.id;
        try {
          step.action();
        } catch (error) {
          console.warn('Onboarding action failed:', error);
        }
        // Wait a frame so the DOM reflects the action, then re-run
        requestAnimationFrame(() => setTimeout(findElement, 50));
        return;
      }
      // There can be multiple matching elements (e.g., per-track controls).
      // Choose the first visible, on-screen element closest to the viewport center.
      // For some steps we want to prefer a specific selector.

      const getPreferredMatches = (): HTMLElement[] => {
        // Step-specific selector preferences
        if (step.id === 'track-modes') {
          const preferred = Array.from(document.querySelectorAll('[data-testid="preview-mode-button"]')) as HTMLElement[];
          if (preferred.length > 0) return preferred;
        }
        if (step.id === 'volume-controls') {
          const preferred = Array.from(document.querySelectorAll('[data-testid="volume-control"]')) as HTMLElement[];
          if (preferred.length > 0) return preferred;
        }
        return Array.from(document.querySelectorAll(step.targetSelector)) as HTMLElement[];
      };

      const allMatches = getPreferredMatches();

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const viewportCenterX = viewportWidth / 2;
      const viewportCenterY = viewportHeight / 2;

      const candidates = allMatches
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const isDisplayed = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
          const hasSize = rect.width > 0 && rect.height > 0;
          const fullyOnScreen = rect.top >= 0 && rect.left >= 0 && rect.bottom <= viewportHeight && rect.right <= viewportWidth;
          const partiallyOnScreen = rect.right > 0 && rect.bottom > 0 && rect.left < viewportWidth && rect.top < viewportHeight;
          const onScreen = fullyOnScreen || partiallyOnScreen;
          const visible = isDisplayed && hasSize && onScreen;
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distanceToCenter = Math.hypot(centerX - viewportCenterX, centerY - viewportCenterY);
          return { el, rect, visible, distanceToCenter, fullyOnScreen };
        })
        .filter((x) => x.visible);

      let element: HTMLElement | undefined;
      if (candidates.length === 0) {
        element = allMatches[0];
      } else if (step.id === 'volume-controls') {
        // Prefer the left-most visible range (volume slider is left-most), bias to fully visible
        const sorted = candidates.sort((a, b) => {
          if (a.fullyOnScreen !== b.fullyOnScreen) return a.fullyOnScreen ? -1 : 1;
          return a.rect.left - b.rect.left;
        });
        element = sorted[0].el;
      } else {
        // Prefer fully visible closest to center; fallback to partially visible
        const fully = candidates
          .filter((c) => c.fullyOnScreen)
          .sort((a, b) => a.distanceToCenter - b.distanceToCenter);
        if (fully.length > 0) {
          element = fully[0].el;
        } else {
          element = candidates
            .sort((a, b) => a.distanceToCenter - b.distanceToCenter)[0].el;
        }
      }
      
      // Debug mode
      const isDebugMode = localStorage.getItem('audafact_debug_onboarding') === 'true';
      
      if (element) {
        setTargetElement(element);
        
        if (isDebugMode) {
          console.log(`Onboarding: Found element for step "${step.id}"`, element);
        }
        
        // Ensure the element is scrolled into view so the overlay positions correctly
        try {
          element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
        } catch {
          // Fallback without options in older environments
          element.scrollIntoView();
        }
        // Force a re-measure on the next frame after potential scroll
        requestAnimationFrame(() => setTargetElement(element));

        // Action already executed above (once per step)
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
    const timeoutId = setTimeout(findElement, 150);

    return () => clearTimeout(timeoutId);
  }, [isOpen, currentStep]);

  // Keep overlay in sync when user scrolls or resizes
  useEffect(() => {
    if (!isOpen) return;
    const handle = () => setPositionTick((v) => v + 1);
    window.addEventListener('scroll', handle, { passive: true });
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle);
      window.removeEventListener('resize', handle);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.repeat) return; // avoid auto-repeat causing race conditions
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
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

  const getHighlightPadding = () => {
    if (step.id === 'time-tempo-controls') return 2;
    return 4;
  };

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
      {/* Backdrop with cutout for highlighted element */}
      {targetElement && (
        <>
          {/* Top backdrop */}
          <div 
            className="absolute bg-black bg-opacity-50 backdrop-blur-sm"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: targetElement.getBoundingClientRect().top - 4,
            }}
            onClick={step.required ? undefined : handleNext}
          />
          
          {/* Bottom backdrop */}
          <div 
            className="absolute bg-black bg-opacity-50 backdrop-blur-sm"
            style={{
              top: targetElement.getBoundingClientRect().bottom + 4,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onClick={step.required ? undefined : handleNext}
          />
          
          {/* Left backdrop */}
          <div 
            className="absolute bg-black bg-opacity-50 backdrop-blur-sm"
            style={{
              top: targetElement.getBoundingClientRect().top - 4,
              left: 0,
              width: targetElement.getBoundingClientRect().left - 4,
              height: targetElement.getBoundingClientRect().height + 8,
            }}
            onClick={step.required ? undefined : handleNext}
          />
          
          {/* Right backdrop */}
          <div 
            className="absolute bg-black bg-opacity-50 backdrop-blur-sm"
            style={{
              top: targetElement.getBoundingClientRect().top - 4,
              left: targetElement.getBoundingClientRect().right + 4,
              right: 0,
              height: targetElement.getBoundingClientRect().height + 8,
            }}
            onClick={step.required ? undefined : handleNext}
          />
        </>
      )}

      {/* Fallback backdrop when no target element */}
      {!targetElement && (
        <div 
          className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={step.required ? undefined : handleNext}
        />
      )}

      {/* Highlight overlay */}
      {targetElement && (
        <div
          className="absolute border-2 border-audafact-accent-cyan rounded-lg shadow-lg transition-all duration-300 ease-in-out"
          style={{
            top: targetElement.getBoundingClientRect().top - getHighlightPadding(),
            left: targetElement.getBoundingClientRect().left - getHighlightPadding(),
            width: targetElement.getBoundingClientRect().width + getHighlightPadding() * 2,
            height: targetElement.getBoundingClientRect().height + getHighlightPadding() * 2,
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