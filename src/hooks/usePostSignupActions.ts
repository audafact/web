import { useState, useCallback, useEffect } from 'react';
import { PostSignupAction, INTENT_EXPIRY_HOURS, SUCCESS_MESSAGES } from '../types/postSignup';
import { IntentManagementService } from '../services/intentManagementService';
import { PostSignupActionService } from '../services/postSignupActionService';
import { PostSignupFlowHandler } from '../services/postSignupFlowHandler';
import { DemoSessionManager } from '../services/demoSessionManager';
import { useAuth } from '../context/AuthContext';
import { useUserTier } from './useUserTier';
import { useMessageSystem } from './useMessageSystem';

export const usePostSignupActions = () => {
  const { user } = useAuth();
  const { tier } = useUserTier();
  const { showSuccessMessage, showErrorMessage } = useMessageSystem();
  const [isProcessing, setIsProcessing] = useState(false);

  // Set up message functions for the services
  useEffect(() => {
    PostSignupFlowHandler.setMessageFunctions(showSuccessMessage, showErrorMessage);
  }, [showSuccessMessage, showErrorMessage]);

  const cacheIntent = useCallback((action: Omit<PostSignupAction, 'id' | 'timestamp'>) => {
    const intentService = IntentManagementService.getInstance();
    
    const fullAction: PostSignupAction = {
      ...action,
      id: `intent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      expiresAt: Date.now() + (INTENT_EXPIRY_HOURS * 60 * 60 * 1000)
    };
    
    intentService.cacheIntent(fullAction);
    
    return fullAction.id;
  }, []);

  const executePendingActions = useCallback(async () => {
    if (!user || isProcessing) return;
    
    setIsProcessing(true);
    try {
      await PostSignupActionService.getInstance().executePendingActions(tier.id);
    } catch (error) {
      console.error('Failed to execute pending actions:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [user, tier.id, isProcessing]);

  const handleSignupSuccess = useCallback(async (trigger?: string) => {
    if (!user) return;
    
    setIsProcessing(true);
    try {
      const handler = new PostSignupFlowHandler();
      await handler.handleSignupSuccess(user, trigger);
    } catch (error) {
      console.error('Failed to handle signup success:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

  const handleTierUpgrade = useCallback(async (newTier: string) => {
    if (!user) return;
    
    setIsProcessing(true);
    try {
      const handler = new PostSignupFlowHandler();
      await handler.handleTierUpgrade(user, newTier);
    } catch (error) {
      console.error('Failed to handle tier upgrade:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

  const saveDemoState = useCallback((state: any) => {
    const demoManager = DemoSessionManager.getInstance();
    demoManager.saveDemoState(state);
  }, []);

  const restoreDemoState = useCallback(() => {
    const demoManager = DemoSessionManager.getInstance();
    return demoManager.restoreDemoState();
  }, []);

  const clearIntentCache = useCallback(() => {
    const intentService = IntentManagementService.getInstance();
    intentService.clearIntentCache();
  }, []);

  const getIntentCache = useCallback(() => {
    const intentService = IntentManagementService.getInstance();
    return intentService.getIntentCache();
  }, []);

  // Auto-execute pending actions when user signs up
  useEffect(() => {
    if (user && tier.id !== 'guest') {
      executePendingActions();
    }
  }, [user, tier.id, executePendingActions]);

  return {
    cacheIntent,
    executePendingActions,
    handleSignupSuccess,
    handleTierUpgrade,
    saveDemoState,
    restoreDemoState,
    clearIntentCache,
    getIntentCache,
    isProcessing
  };
}; 