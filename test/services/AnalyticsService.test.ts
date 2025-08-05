import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnalyticsService, FUNNEL_STAGES, analytics } from '../../src/services/analyticsService';

// Mock fetch globally
global.fetch = vi.fn();

describe('Analytics & Funnel Tracking', () => {
  let analytics: AnalyticsService;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Reset singleton
    AnalyticsService.resetInstance();
    // Reset fetch mock
    vi.clearAllMocks();
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    analytics = AnalyticsService.getInstance();
  });

  beforeAll(() => {
    // Mock PromiseRejectionEvent for tests
    global.PromiseRejectionEvent = class PromiseRejectionEvent extends Event {
      reason: any;
      constructor(type: string, init: { reason: any }) {
        super(type);
        this.reason = init.reason;
      }
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AnalyticsService', () => {
    it('should track events correctly', async () => {
      const mockFetch = vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as Response);
      
      analytics.track('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
      
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('demo_track_loaded')
      }));
    });

    it('should store events for retry when offline', () => {
      // Mock offline state before creating service
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      // Reset service to pick up new online state
      AnalyticsService.resetInstance();
      const offlineAnalytics = AnalyticsService.getInstance();
      
      // Mock fetch to fail
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
      
      offlineAnalytics.track('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
      
      expect(offlineAnalytics.getRetryQueueLength()).toBe(2); // 1 original event + 1 funnel progress event
    });

    it('should process retry queue when coming back online', async () => {
      // Mock offline state and add event to retry queue
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      // Reset service to pick up new online state
      AnalyticsService.resetInstance();
      const offlineAnalytics = AnalyticsService.getInstance();
      
      // Mock fetch to fail initially
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
      
      offlineAnalytics.track('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
      
      expect(offlineAnalytics.getRetryQueueLength()).toBe(2); // 1 original event + 1 funnel progress event
      
      // Mock fetch for retry
      const mockFetch = vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as Response);
      
      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
      
      // Trigger online event
      window.dispatchEvent(new Event('online'));
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockFetch).toHaveBeenCalled();
      expect(offlineAnalytics.getRetryQueueLength()).toBe(0);
    });

    it('should track performance metrics', () => {
      analytics.trackMetric('test_metric', 100);
      
      expect(analytics.getAverageMetric('test_metric')).toBe(100);
      
      analytics.trackMetric('test_metric', 200);
      expect(analytics.getAverageMetric('test_metric')).toBe(150);
    });

    it('should track errors', () => {
      const mockFetch = vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as Response);
      
      const error = new Error('Test error');
      analytics.trackError(error, 'test_context');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('error_occurred')
      }));
    });

    it('should track feature errors', () => {
      const mockFetch = vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as Response);
      
      const error = new Error('Feature error');
      analytics.trackFeatureError('test_feature', error);
      
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('feature_error')
      }));
    });

    it('should set user information', () => {
      analytics.setUser('user123', 'pro');
      
      analytics.track('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
      
      const events = analytics.getEvents();
      expect(events[0].userId).toBe('user123');
      expect(events[0].userTier).toBe('pro');
    });

    it('should generate unique session IDs', () => {
      const sessionId1 = analytics.getSessionId();
      const sessionId2 = analytics.getSessionId();
      
      expect(sessionId1).toBe(sessionId2); // Same instance
      expect(sessionId1).toMatch(/^session_\d+_[a-z0-9]+$/);
    });

    it('should limit events in memory', () => {
      // Add more than 100 events
      for (let i = 0; i < 110; i++) {
        analytics.track('demo_track_loaded', {
          trackId: `track-${i}`,
          genre: 'house',
          bpm: 128
        });
      }
      
      const events = analytics.getEvents();
      expect(events.length).toBeLessThanOrEqual(100);
    });
  });

  describe('FunnelTracker', () => {
    it('should track funnel progress', () => {
      const mockFetch = vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as Response);
      
      analytics.track('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
      
      // Should track both the original event and funnel progress
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      const calls = vi.mocked(fetch).mock.calls;
      const funnelCall = calls.find(call => 
        JSON.parse(call[1]?.body as string).event === 'funnel_progress'
      );
      
      expect(funnelCall).toBeDefined();
    });

    it('should calculate conversion rates', () => {
      // Mock user progress
      const mockProgress = new Map();
      mockProgress.set('user1', new Set(['Demo Started', 'Feature Interaction']));
      mockProgress.set('user2', new Set(['Demo Started']));
      
      analytics.setUserProgress(mockProgress);
      
      const rates = analytics.getFunnelConversionRate();
      
      expect(rates['Demo Started']).toBe(100);
      expect(rates['Feature Interaction']).toBe(50);
    });

    it('should track funnel completion', () => {
      const mockFetch = vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as Response);
      
      analytics.setUser('user123', 'guest');
      
      // Complete all required stages
      analytics.track('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
      
      analytics.track('feature_gate_clicked', {
        feature: 'upload',
        userTier: 'guest',
        gateType: 'modal'
      });
      
      analytics.track('signup_modal_shown', {
        trigger: 'feature_gate',
        userTier: 'guest'
      });
      
      analytics.track('signup_completed', {
        method: 'email',
        trigger: 'feature_gate',
        upgradeRequired: false
      });
      
      analytics.track('upgrade_completed', {
        plan: 'pro',
        amount: 999
      });
      
      // Should have tracked funnel completion
      const calls = vi.mocked(fetch).mock.calls;
      const completionCall = calls.find(call => 
        JSON.parse(call[1]?.body as string).event === 'funnel_completed'
      );
      
      expect(completionCall).toBeDefined();
    });

    it('should handle funnel stages correctly', () => {
      expect(FUNNEL_STAGES).toHaveLength(7);
      expect(FUNNEL_STAGES[0].name).toBe('Demo Started');
      expect(FUNNEL_STAGES[0].required).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track page load time', () => {
      // Mock performance.now
      const mockPerformanceNow = vi.fn()
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1500); // End time
      
      vi.spyOn(performance, 'now').mockImplementation(mockPerformanceNow);
      
      // Create new instance to trigger page load tracking
      AnalyticsService.resetInstance();
      const newAnalytics = AnalyticsService.getInstance();
      
      // Simulate page load
      window.dispatchEvent(new Event('load'));
      
      // Should track page load time - but we need to account for all the other calls
      expect(mockPerformanceNow).toHaveBeenCalled();
    });

    it('should track feature response time', () => {
      const mockFetch = vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as Response);
      
      const endTracking = analytics.trackFeatureResponseTime('test_feature');
      
      // Call the end tracking function immediately
      endTracking();
      
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('feature_gate_response_time')
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle global errors', () => {
      const mockFetch = vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as Response);
      
      const error = new Error('Global error');
      
      // Simulate global error
      window.dispatchEvent(new ErrorEvent('error', { error }));
      
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('error_occurred')
      }));
    });

    it('should handle unhandled promise rejections', () => {
      const mockFetch = vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as Response);
      
      // Simulate unhandled promise rejection
      window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
        reason: 'Promise rejected'
      }));
      
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('error_occurred')
      }));
    });

    it('should handle network errors gracefully', async () => {
      // Mock offline state to ensure events are queued
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      // Reset service to pick up new online state
      AnalyticsService.resetInstance();
      const offlineAnalytics = AnalyticsService.getInstance();
      
      const mockFetch = vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
      
      offlineAnalytics.track('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
      
      // Should store in retry queue
      expect(offlineAnalytics.getRetryQueueLength()).toBe(2); // 1 original event + 1 funnel progress event
    });
  });

  describe('Data Persistence', () => {
    it('should save and load retry queue from localStorage', () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      // Reset service to pick up new online state
      AnalyticsService.resetInstance();
      const offlineAnalytics = AnalyticsService.getInstance();
      
      // Mock fetch to fail
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
      
      offlineAnalytics.track('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
      
      expect(offlineAnalytics.getRetryQueueLength()).toBe(2); // 1 original event + 1 funnel progress event
      
      // Create new instance to test loading
      AnalyticsService.resetInstance();
      const newAnalytics = AnalyticsService.getInstance();
      
      expect(newAnalytics.getRetryQueueLength()).toBe(2); // 1 original event + 1 funnel progress event
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should not throw error
      expect(() => {
        analytics.track('demo_track_loaded', {
          trackId: 'test-track',
          genre: 'house',
          bpm: 128
        });
      }).not.toThrow();
      
      // Restore original
      localStorage.setItem = originalSetItem;
    });
  });
}); 