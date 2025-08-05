import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntentManagementService } from '../../src/services/intentManagementService';
import { PostSignupAction } from '../../src/types/postSignup';

describe('Intent Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  afterEach(() => {
    localStorage.clear();
  });
  
  it('should cache and retrieve intents', () => {
    const intentService = IntentManagementService.getInstance();
    
    const action: PostSignupAction = {
      id: 'test_action',
      type: 'upload',
      timestamp: Date.now(),
      context: {},
      priority: 'high'
    };
    
    intentService.cacheIntent(action);
    
    const cache = intentService.getIntentCache();
    expect(cache.actions).toHaveLength(1);
    expect(cache.actions[0].id).toBe('test_action');
  });
  
  it('should clean expired intents', () => {
    const intentService = IntentManagementService.getInstance();
    
    const expiredAction: PostSignupAction = {
      id: 'expired_action',
      type: 'upload',
      timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      context: {},
      priority: 'high',
      expiresAt: Date.now() - (60 * 60 * 1000) // 1 hour ago
    };
    
    intentService.cacheIntent(expiredAction);
    
    const cache = intentService.getIntentCache();
    expect(cache.actions).toHaveLength(0);
  });
  
  it('should sort actions by priority', () => {
    const intentService = IntentManagementService.getInstance();
    
    const lowPriorityAction: PostSignupAction = {
      id: 'low_action',
      type: 'upload',
      timestamp: Date.now(),
      context: {},
      priority: 'low'
    };
    
    const highPriorityAction: PostSignupAction = {
      id: 'high_action',
      type: 'save_session',
      timestamp: Date.now(),
      context: {},
      priority: 'high'
    };
    
    intentService.cacheIntent(lowPriorityAction);
    intentService.cacheIntent(highPriorityAction);
    
    const cache = intentService.getIntentCache();
    expect(cache.actions[0].priority).toBe('high');
    expect(cache.actions[1].priority).toBe('low');
  });
  
  it('should update user tier', () => {
    const intentService = IntentManagementService.getInstance();
    
    intentService.updateUserTier('pro');
    
    const cache = intentService.getIntentCache();
    expect(cache.userTier).toBe('pro');
  });
  
  it('should clear intent cache', () => {
    const intentService = IntentManagementService.getInstance();
    
    const action: PostSignupAction = {
      id: 'test_action',
      type: 'upload',
      timestamp: Date.now(),
      context: {},
      priority: 'high'
    };
    
    intentService.cacheIntent(action);
    intentService.clearIntentCache();
    
    const cache = intentService.getIntentCache();
    expect(cache.actions).toHaveLength(0);
  });
}); 