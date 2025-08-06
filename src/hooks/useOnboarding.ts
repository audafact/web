import { useState, useEffect, useCallback } from 'react';
import { OnboardingStep } from '../components/OnboardingWalkthrough';

interface OnboardingState {
  isOpen: boolean;
  currentStep: number;
  hasCompleted: boolean;
  hasBeenShown: boolean;
}

const ONBOARDING_STORAGE_KEY = 'audafact_onboarding_state';

export const useOnboarding = (steps: OnboardingStep[], isAnonymousUser: boolean = false) => {
  const [state, setState] = useState<OnboardingState>({
    isOpen: false,
    currentStep: 0,
    hasCompleted: false,
    hasBeenShown: false
  });

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState(prev => ({
          ...prev,
          hasCompleted: parsed.hasCompleted || false,
          hasBeenShown: parsed.hasBeenShown || false
        }));
      }
    } catch (error) {
      console.warn('Failed to load onboarding state:', error);
    }
  }, []);

  // Save state to localStorage
  const saveState = useCallback((newState: Partial<OnboardingState>) => {
    try {
      const current = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const parsed = current ? JSON.parse(current) : {};
      const updated = { ...parsed, ...newState };
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.warn('Failed to save onboarding state:', error);
    }
  }, []);

  const startOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      currentStep: 0,
      hasBeenShown: true
    }));
    saveState({ hasBeenShown: true });
  }, [saveState]);

  const closeOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false
    }));
  }, []);

  const completeOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      hasCompleted: true
    }));
    saveState({ hasCompleted: true });
  }, [saveState]);

  const setCurrentStep = useCallback((step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(0, Math.min(step, steps.length - 1))
    }));
  }, [steps.length]);

  const resetOnboarding = useCallback(() => {
    setState({
      isOpen: false,
      currentStep: 0,
      hasCompleted: false,
      hasBeenShown: false
    });
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  }, []);

  const shouldShowOnboarding = useCallback(() => {
    // For anonymous users, always show onboarding if not completed
    if (isAnonymousUser) {
      return !state.hasCompleted;
    }
    // For authenticated users, show only if never seen before
    return !state.hasCompleted && !state.hasBeenShown;
  }, [state.hasCompleted, state.hasBeenShown, isAnonymousUser]);

  return {
    ...state,
    startOnboarding,
    closeOnboarding,
    completeOnboarding,
    setCurrentStep,
    resetOnboarding,
    shouldShowOnboarding,
    totalSteps: steps.length
  };
}; 