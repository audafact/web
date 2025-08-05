import { PostSignupAction, IntentCache, INTENT_CACHE_KEY } from '../types/postSignup';

export class IntentManagementService {
  private static instance: IntentManagementService;
  
  private constructor() {}
  
  static getInstance(): IntentManagementService {
    if (!IntentManagementService.instance) {
      IntentManagementService.instance = new IntentManagementService();
    }
    return IntentManagementService.instance;
  }
  
  cacheIntent(action: PostSignupAction): void {
    try {
      const existing = this.getIntentCache();
      const updatedActions = [
        ...existing.actions.filter(a => a.id !== action.id),
        action
      ].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
      const cache: IntentCache = {
        actions: updatedActions,
        sessionId: this.getSessionId(),
        lastUpdated: Date.now(),
        userTier: 'guest' // Will be updated after signup
      };
      
      localStorage.setItem(INTENT_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to cache intent:', error);
    }
  }
  
  getIntentCache(): IntentCache {
    try {
      const stored = localStorage.getItem(INTENT_CACHE_KEY);
      if (!stored) {
        return {
          actions: [],
          sessionId: this.getSessionId(),
          lastUpdated: Date.now(),
          userTier: 'guest'
        };
      }
      
      const cache: IntentCache = JSON.parse(stored);
      
      // Clean expired actions
      const now = Date.now();
      const validActions = cache.actions.filter(action => {
        if (!action.expiresAt) return true;
        return now < action.expiresAt;
      });
      
      if (validActions.length !== cache.actions.length) {
        cache.actions = validActions;
        this.updateIntentCache(cache);
      }
      
      return cache;
    } catch (error) {
      console.error('Failed to get intent cache:', error);
      return {
        actions: [],
        sessionId: this.getSessionId(),
        lastUpdated: Date.now(),
        userTier: 'guest'
      };
    }
  }
  
  clearIntentCache(): void {
    try {
      localStorage.removeItem(INTENT_CACHE_KEY);
    } catch (error) {
      console.error('Failed to clear intent cache:', error);
    }
  }
  
  updateUserTier(newTier: string): void {
    try {
      const cache = this.getIntentCache();
      cache.userTier = newTier;
      cache.lastUpdated = Date.now();
      this.updateIntentCache(cache);
    } catch (error) {
      console.error('Failed to update user tier:', error);
    }
  }
  
  private updateIntentCache(cache: IntentCache): void {
    localStorage.setItem(INTENT_CACHE_KEY, JSON.stringify(cache));
  }
  
  private getSessionId(): string {
    return localStorage.getItem('session_id') || `session_${Date.now()}`;
  }
} 