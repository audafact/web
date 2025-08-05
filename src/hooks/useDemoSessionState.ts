import { useState, useEffect, useCallback } from 'react';
import { DemoSessionState } from '../types/postSignup';
import { DemoSessionManager } from '../services/demoSessionManager';
import { useUserTier } from './useUserTier';

export const useDemoSessionState = () => {
  const { tier } = useUserTier();
  const [currentState, setCurrentState] = useState<DemoSessionState | null>(null);
  const demoManager = DemoSessionManager.getInstance();

  // Save demo state periodically for guests
  useEffect(() => {
    if (tier.id === 'guest') {
      const interval = setInterval(() => {
        const state = getCurrentSessionState();
        if (state) {
          demoManager.saveDemoState(state);
          setCurrentState(state);
        }
      }, 30000); // Save every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [tier.id]);

  // Try to restore demo state when user becomes free tier
  useEffect(() => {
    if (tier.id === 'free') {
      const restored = demoManager.restoreDemoState();
      if (restored) {
        // Update current state to reflect restored state
        const state = getCurrentSessionState();
        if (state) {
          setCurrentState(state);
        }
      }
    }
  }, [tier.id]);

  const saveCurrentState = useCallback(() => {
    const state = getCurrentSessionState();
    if (state) {
      demoManager.saveDemoState(state);
      setCurrentState(state);
    }
  }, []);

  const restoreState = useCallback(() => {
    return demoManager.restoreDemoState();
  }, []);

  const clearState = useCallback(() => {
    demoManager.clearDemoState();
    setCurrentState(null);
  }, []);

  return {
    currentState,
    saveCurrentState,
    restoreState,
    clearState
  };
};

// Placeholder function to get current session state
// This would be implemented to integrate with the actual audio system
const getCurrentSessionState = (): DemoSessionState | null => {
  // TODO: Integrate with actual audio system to get real state
  // For now, return a placeholder state
  return {
    currentTrack: null,
    playbackPosition: 0,
    cuePoints: [],
    loopRegions: [],
    mode: 'preview',
    volume: 1,
    tempo: 120,
    timestamp: Date.now()
  };
}; 