import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePostSignupActions } from '../../src/hooks/usePostSignupActions';
import { IntentManagementService } from '../../src/services/intentManagementService';
import { PostSignupActionService } from '../../src/services/postSignupActionService';
import { DemoSessionManager } from '../../src/services/demoSessionManager';
import { PostSignupFlowHandler } from '../../src/services/postSignupFlowHandler';

// Mock the auth context
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test_user', email: 'test@example.com' }
  })
}));

// Mock the user tier hook
vi.mock('../../src/hooks/useUserTier', () => ({
  useUserTier: () => ({
    tier: { id: 'free', name: 'Free User' }
  })
}));

// Mock the message system hook
vi.mock('../../src/hooks/useMessageSystem', () => ({
  useMessageSystem: () => ({
    showSuccessMessage: vi.fn(),
    showErrorMessage: vi.fn()
  })
}));

// Mock the analytics service
vi.mock('../../src/services/analyticsService', () => ({
  analytics: {
    track: vi.fn(),
    setUser: vi.fn()
  }
}));

// Mock the services
vi.mock('../../src/services/intentManagementService', () => ({
  IntentManagementService: {
    getInstance: vi.fn(() => ({
      cacheIntent: vi.fn(),
      getIntentCache: vi.fn(() => ({ actions: [] })),
      clearIntentCache: vi.fn(),
      updateUserTier: vi.fn()
    }))
  }
}));

vi.mock('../../src/services/postSignupActionService', () => ({
  PostSignupActionService: {
    getInstance: vi.fn(() => ({
      executePendingActions: vi.fn().mockResolvedValue()
    })),
    setMessageFunctions: vi.fn()
  }
}));

vi.mock('../../src/services/demoSessionManager', () => ({
  DemoSessionManager: {
    getInstance: vi.fn(() => ({
      saveDemoState: vi.fn(),
      restoreDemoState: vi.fn(() => true)
    }))
  }
}));

// Mock the PostSignupFlowHandler
vi.mock('../../src/services/postSignupFlowHandler', () => ({
  PostSignupFlowHandler: Object.assign(
    vi.fn().mockImplementation(() => ({
      handleSignupSuccess: vi.fn().mockResolvedValue(),
      handleTierUpgrade: vi.fn().mockResolvedValue()
    })),
    {
      setMessageFunctions: vi.fn()
    }
  )
}));

describe('usePostSignupActions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    localStorage.clear();
  });
  
  it('should cache intent', () => {
    const { result } = renderHook(() => usePostSignupActions());
    
    const mockCacheIntent = vi.fn();
    const mockIntentService = {
      cacheIntent: mockCacheIntent,
      getIntentCache: vi.fn(() => ({ actions: [] })),
      clearIntentCache: vi.fn(),
      updateUserTier: vi.fn()
    };
    vi.mocked(IntentManagementService.getInstance).mockReturnValue(mockIntentService);
    
    act(() => {
      result.current.cacheIntent({
        type: 'upload',
        context: {},
        priority: 'high'
      });
    });
    
    expect(mockCacheIntent).toHaveBeenCalled();
  });
  
  it('should execute pending actions', async () => {
    const { result } = renderHook(() => usePostSignupActions());
    
    const mockExecutePendingActions = vi.fn().mockResolvedValue();
    const mockActionService = {
      executePendingActions: mockExecutePendingActions
    };
    vi.mocked(PostSignupActionService.getInstance).mockReturnValue(mockActionService);
    
    // Wait for the initial effect to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    await act(async () => {
      await result.current.executePendingActions();
    });
    
    expect(mockExecutePendingActions).toHaveBeenCalledWith('free');
  });
  
  it('should handle signup success', async () => {
    const { result } = renderHook(() => usePostSignupActions());
    
    // Mock the PostSignupFlowHandler constructor to return a properly mocked instance
    const mockHandler = {
      handleSignupSuccess: vi.fn().mockResolvedValue(undefined)
    };
    vi.mocked(PostSignupFlowHandler).mockImplementation(() => mockHandler);
    
    await act(async () => {
      await result.current.handleSignupSuccess('upload');
    });
    
    expect(mockHandler.handleSignupSuccess).toHaveBeenCalled();
  });
  
  it('should handle tier upgrade', async () => {
    const { result } = renderHook(() => usePostSignupActions());
    
    // Mock the PostSignupFlowHandler constructor to return a properly mocked instance
    const mockHandler = {
      handleTierUpgrade: vi.fn().mockResolvedValue(undefined)
    };
    vi.mocked(PostSignupFlowHandler).mockImplementation(() => mockHandler);
    
    await act(async () => {
      await result.current.handleTierUpgrade('pro');
    });
    
    expect(mockHandler.handleTierUpgrade).toHaveBeenCalled();
  });
  
  it('should save demo state', () => {
    const { result } = renderHook(() => usePostSignupActions());
    
    const mockSaveDemoState = vi.fn();
    const mockDemoManager = {
      saveDemoState: mockSaveDemoState,
      restoreDemoState: vi.fn(() => true)
    };
    vi.mocked(DemoSessionManager.getInstance).mockReturnValue(mockDemoManager);
    
    const testState = { test: 'state' };
    
    act(() => {
      result.current.saveDemoState(testState);
    });
    
    expect(mockSaveDemoState).toHaveBeenCalledWith(testState);
  });
  
  it('should restore demo state', () => {
    const { result } = renderHook(() => usePostSignupActions());
    
    const mockRestoreDemoState = vi.fn().mockReturnValue(true);
    const mockDemoManager = {
      saveDemoState: vi.fn(),
      restoreDemoState: mockRestoreDemoState
    };
    vi.mocked(DemoSessionManager.getInstance).mockReturnValue(mockDemoManager);
    
    act(() => {
      const restored = result.current.restoreDemoState();
      expect(restored).toBe(true);
    });
    
    expect(mockRestoreDemoState).toHaveBeenCalled();
  });
  
  it('should clear intent cache', () => {
    const { result } = renderHook(() => usePostSignupActions());
    
    const mockClearIntentCache = vi.fn();
    const mockIntentService = {
      cacheIntent: vi.fn(),
      getIntentCache: vi.fn(() => ({ actions: [] })),
      clearIntentCache: mockClearIntentCache,
      updateUserTier: vi.fn()
    };
    vi.mocked(IntentManagementService.getInstance).mockReturnValue(mockIntentService);
    
    act(() => {
      result.current.clearIntentCache();
    });
    
    expect(mockClearIntentCache).toHaveBeenCalled();
  });
  
  it('should get intent cache', () => {
    const { result } = renderHook(() => usePostSignupActions());
    
    const mockGetIntentCache = vi.fn().mockReturnValue({ actions: [] });
    const mockIntentService = {
      cacheIntent: vi.fn(),
      getIntentCache: mockGetIntentCache,
      clearIntentCache: vi.fn(),
      updateUserTier: vi.fn()
    };
    vi.mocked(IntentManagementService.getInstance).mockReturnValue(mockIntentService);
    
    act(() => {
      const cache = result.current.getIntentCache();
      expect(cache).toEqual({ actions: [] });
    });
    
    expect(mockGetIntentCache).toHaveBeenCalled();
  });
}); 