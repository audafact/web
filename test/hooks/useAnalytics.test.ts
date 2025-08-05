import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { AnalyticsService } from '../../src/services/analyticsService';

// Mock the analytics service
vi.mock('../../src/services/analyticsService', () => ({
  analytics: {
    track: vi.fn(),
    trackError: vi.fn(),
    trackFeatureError: vi.fn(),
    trackMetric: vi.fn(),
    trackFeatureResponseTime: vi.fn(),
    getSessionId: vi.fn(() => 'test-session-id'),
    getRetryQueueLength: vi.fn(() => 0),
    getFunnelConversionRate: vi.fn(() => ({})),
    getAverageMetric: vi.fn(() => 0)
  },
  trackEvent: vi.fn(),
  trackError: vi.fn(),
  trackFeatureError: vi.fn(),
  trackMetric: vi.fn()
}));

// Mock useUserTier
vi.mock('../../src/hooks/useUserTier', () => ({
  useUserTier: () => ({
    userTier: 'guest'
  })
}));

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide analytics tracking functions', () => {
    const { result } = renderHook(() => useAnalytics());

    expect(result.current.trackEvent).toBeDefined();
    expect(result.current.trackFunnelProgress).toBeDefined();
    expect(result.current.trackError).toBeDefined();
    expect(result.current.trackFeatureError).toBeDefined();
    expect(result.current.trackMetric).toBeDefined();
    expect(result.current.trackFeatureResponseTime).toBeDefined();
    expect(result.current.trackDemoSession).toBeDefined();
    expect(result.current.trackLibraryInteraction).toBeDefined();
    expect(result.current.trackStudioAction).toBeDefined();
  });

  it('should track events with user tier', () => {
    const { result } = renderHook(() => useAnalytics());
    const mockTrackEvent = vi.mocked(result.current.trackEvent);

    act(() => {
      result.current.trackEvent('demo_track_loaded', {
        trackId: 'test-track',
        genre: 'house',
        bpm: 128
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('demo_track_loaded', {
      trackId: 'test-track',
      genre: 'house',
      bpm: 128,
      userTier: 'guest'
    });
  });

  it('should track demo session events', () => {
    const { result } = renderHook(() => useAnalytics());
    const mockTrackEvent = vi.mocked(result.current.trackEvent);

    act(() => {
      result.current.trackDemoSession('started');
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('demo_session_started', {
      timestamp: expect.any(Number)
    });

    act(() => {
      result.current.trackDemoSession('ended', {
        duration: 5000,
        actions: ['play', 'pause']
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('demo_session_ended', {
      duration: 5000,
      actions: ['play', 'pause']
    });
  });

  it('should track library interactions', () => {
    const { result } = renderHook(() => useAnalytics());
    const mockTrackEvent = vi.mocked(result.current.trackEvent);

    act(() => {
      result.current.trackLibraryInteraction('opened', {});
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('library_panel_opened', {
      userTier: 'guest'
    });

    act(() => {
      result.current.trackLibraryInteraction('previewed', {
        trackId: 'track-123',
        genre: 'house',
        bpm: 128
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('library_track_previewed', {
      trackId: 'track-123',
      genre: 'house',
      bpm: 128,
      userTier: 'guest'
    });

    act(() => {
      result.current.trackLibraryInteraction('added', {
        trackId: 'track-123',
        genre: 'house'
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('library_track_added', {
      trackId: 'track-123',
      genre: 'house',
      userTier: 'guest'
    });

    act(() => {
      result.current.trackLibraryInteraction('searched', {
        searchTerm: 'house',
        resultsCount: 5
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('library_search_performed', {
      searchTerm: 'house',
      resultsCount: 5,
      userTier: 'guest'
    });
  });

  it('should track studio actions', () => {
    const { result } = renderHook(() => useAnalytics());
    const mockTrackEvent = vi.mocked(result.current.trackEvent);

    act(() => {
      result.current.trackStudioAction('uploaded', {
        fileName: 'track.wav',
        fileSize: 1024000,
        fileType: 'audio/wav'
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('track_uploaded', {
      fileName: 'track.wav',
      fileSize: 1024000,
      fileType: 'audio/wav',
      userTier: 'guest'
    });

    act(() => {
      result.current.trackStudioAction('saved', {
        sessionName: 'My Session',
        isModified: true
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('session_saved', {
      sessionName: 'My Session',
      userTier: 'guest',
      isModified: true
    });

    act(() => {
      result.current.trackStudioAction('recording_started', {});
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('recording_started', {
      userTier: 'guest'
    });

    act(() => {
      result.current.trackStudioAction('recording_stopped', {});
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('recording_stopped', {
      userTier: 'guest'
    });

    act(() => {
      result.current.trackStudioAction('downloaded', {
        fileName: 'recording.wav',
        format: 'wav'
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('recording_downloaded', {
      fileName: 'recording.wav',
      format: 'wav',
      userTier: 'guest'
    });
  });

  it('should track errors', () => {
    const { result } = renderHook(() => useAnalytics());
    const mockTrackError = vi.mocked(result.current.trackError);

    const error = new Error('Test error');

    act(() => {
      result.current.trackError(error, 'test_context');
    });

    expect(mockTrackError).toHaveBeenCalledWith(error, 'test_context');
  });

  it('should track feature errors', () => {
    const { result } = renderHook(() => useAnalytics());
    const mockTrackFeatureError = vi.mocked(result.current.trackFeatureError);

    const error = new Error('Feature error');

    act(() => {
      result.current.trackFeatureError('test_feature', error);
    });

    expect(mockTrackFeatureError).toHaveBeenCalledWith('test_feature', error);
  });

  it('should track metrics', () => {
    const { result } = renderHook(() => useAnalytics());
    const mockTrackMetric = vi.mocked(result.current.trackMetric);

    act(() => {
      result.current.trackMetric('test_metric', 100);
    });

    expect(mockTrackMetric).toHaveBeenCalledWith('test_metric', 100);
  });

  it('should provide feature response time tracking', () => {
    const { result } = renderHook(() => useAnalytics());
    const mockTrackFeatureResponseTime = vi.mocked(result.current.trackFeatureResponseTime);

    act(() => {
      const endTracking = result.current.trackFeatureResponseTime('test_feature');
      expect(typeof endTracking).toBe('function');
    });

    expect(mockTrackFeatureResponseTime).toHaveBeenCalledWith('test_feature');
  });

  it('should provide analytics data access', () => {
    const { result } = renderHook(() => useAnalytics());

    expect(result.current.getSessionId()).toBe('test-session-id');
    expect(result.current.getRetryQueueLength()).toBe(0);
    expect(result.current.getFunnelConversionRate()).toEqual({});
    expect(result.current.getAverageMetric('test')).toBe(0);
  });

  it('should handle funnel progress tracking', () => {
    const { result } = renderHook(() => useAnalytics());
    const mockTrackFunnelProgress = vi.mocked(result.current.trackFunnelProgress);

    act(() => {
      result.current.trackFunnelProgress('Demo Started', {
        trackId: 'test-track'
      });
    });

    expect(mockTrackFunnelProgress).toHaveBeenCalledWith('Demo Started', {
      trackId: 'test-track'
    });
  });
}); 