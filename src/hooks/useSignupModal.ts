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

  useEffect(() => {
    const handleShowSignupModal = (event: CustomEvent) => {
      const { trigger, action } = event.detail;
      
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

    // Add event listener for custom signup modal events
    window.addEventListener('showSignupModal', handleShowSignupModal as EventListener);

    return () => {
      window.removeEventListener('showSignupModal', handleShowSignupModal as EventListener);
    };
  }, []);

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