import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../services/analyticsService';
import { useUserTier } from './useUserTier';

export const usePostSignupActions = () => {
  const { user } = useAuth();
  const { tier } = useUserTier();
  
  const handlePostSignupRedirect = () => {
    const redirectAction = localStorage.getItem('postSignupAction');
    
    if (redirectAction) {
      localStorage.removeItem('postSignupAction');
      
      // Track post-signup action
      trackEvent('post_signup_action', { 
        action: redirectAction,
        userTier: tier 
      });
      
      // Return the action to be handled by the parent component
      return redirectAction;
    }
    
    return null;
  };
  
  // Auto-handle post-signup actions when user becomes authenticated
  useEffect(() => {
    if (user) {
      const action = handlePostSignupRedirect();
      if (action) {
        // Dispatch an event that components can listen to
        window.dispatchEvent(new CustomEvent('postSignupAction', {
          detail: { action }
        }));
      }
    }
  }, [user, tier]);
  
  return {
    handlePostSignupRedirect
  };
}; 