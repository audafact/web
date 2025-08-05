import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PostSignupFlowHandler } from '../../src/services/postSignupFlowHandler';
import { IntentManagementService } from '../../src/services/intentManagementService';
import { PostSignupActionService } from '../../src/services/postSignupActionService';
import { DemoSessionManager } from '../../src/services/demoSessionManager';

// Mock the analytics service
vi.mock('../../src/services/analyticsService', () => ({
  analytics: {
    track: vi.fn()
  }
}));

describe('Post-Signup Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    localStorage.clear();
  });
  
  it('should handle signup success', async () => {
    const mockUser = { id: 'test_user', email: 'test@example.com' };
    const handler = new PostSignupFlowHandler();
    
    // Mock the action service
    const mockExecutePendingActions = vi.fn();
    vi.spyOn(PostSignupActionService.getInstance(), 'executePendingActions')
      .mockImplementation(mockExecutePendingActions);
    
    // Mock demo session manager
    const mockRestoreDemoState = vi.fn().mockReturnValue(false);
    vi.spyOn(DemoSessionManager.getInstance(), 'restoreDemoState')
      .mockImplementation(mockRestoreDemoState);
    
    await handler.handleSignupSuccess(mockUser, 'upload');
    
    expect(mockExecutePendingActions).toHaveBeenCalledWith('free');
    expect(mockRestoreDemoState).toHaveBeenCalled();
  });
  
  it('should handle tier upgrade', async () => {
    const mockUser = { id: 'test_user', email: 'test@example.com' };
    const handler = new PostSignupFlowHandler();
    
    // Mock the action service
    const mockExecutePendingActions = vi.fn();
    vi.spyOn(PostSignupActionService.getInstance(), 'executePendingActions')
      .mockImplementation(mockExecutePendingActions);
    
    await handler.handleTierUpgrade(mockUser, 'pro');
    
    expect(mockExecutePendingActions).toHaveBeenCalledWith('pro');
  });
  
  it('should update user tier in intent cache on signup', async () => {
    const mockUser = { id: 'test_user', email: 'test@example.com' };
    const handler = new PostSignupFlowHandler();
    
    // Mock services
    vi.spyOn(PostSignupActionService.getInstance(), 'executePendingActions')
      .mockResolvedValue();
    vi.spyOn(DemoSessionManager.getInstance(), 'restoreDemoState')
      .mockReturnValue(false);
    
    await handler.handleSignupSuccess(mockUser);
    
    const intentCache = IntentManagementService.getInstance().getIntentCache();
    expect(intentCache.userTier).toBe('free');
  });
  
  it('should update user tier in intent cache on upgrade', async () => {
    const mockUser = { id: 'test_user', email: 'test@example.com' };
    const handler = new PostSignupFlowHandler();
    
    // Mock the action service
    vi.spyOn(PostSignupActionService.getInstance(), 'executePendingActions')
      .mockResolvedValue();
    
    await handler.handleTierUpgrade(mockUser, 'pro');
    
    const intentCache = IntentManagementService.getInstance().getIntentCache();
    expect(intentCache.userTier).toBe('pro');
  });
  
  it('should handle errors gracefully', async () => {
    const mockUser = { id: 'test_user', email: 'test@example.com' };
    const handler = new PostSignupFlowHandler();
    
    // Mock services to throw errors
    vi.spyOn(PostSignupActionService.getInstance(), 'executePendingActions')
      .mockRejectedValue(new Error('Test error'));
    vi.spyOn(DemoSessionManager.getInstance(), 'restoreDemoState')
      .mockReturnValue(false);
    
    // Should not throw
    await expect(handler.handleSignupSuccess(mockUser)).resolves.not.toThrow();
  });
}); 