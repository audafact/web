import { useState, useEffect } from 'react';
import { trackEvent } from '../services/analyticsService';

interface SignupModalState {
  isOpen: boolean;
  trigger: string;
  action?: string;
}

export const useSignupModal = () => {
  const [modalState, setModalState] = useState<SignupModalState>({
    isOpen: false,
    trigger: '',
    action: undefined
  });

  // Remove the event listener from the hook since GlobalModalManager handles it

  const showSignupModal = (trigger: string, action?: string) => {
    setModalState({
      isOpen: true,
      trigger,
      action
    });
    
    trackEvent('signup_modal_shown', {
      trigger,
      userTier: 'guest'
    });
  };

  const closeSignupModal = () => {
    setModalState(prev => ({
      ...prev,
      isOpen: false
    }));
    
    trackEvent('signup_modal_dismissed', {
      trigger: modalState.trigger,
      userTier: 'guest'
    });
  };

  return {
    modalState,
    showSignupModal,
    closeSignupModal
  };
};

// Global function for triggering signup modal from anywhere
export const showSignupModal = (trigger: string, action?: string) => {
  window.dispatchEvent(new CustomEvent('showSignupModal', {
    detail: { trigger, action }
  }));
}; 