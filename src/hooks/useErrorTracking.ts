import { useCallback } from 'react';

export const useErrorTracking = () => {
  const trackError = useCallback(async (error: Error, context: string, additionalContext: Record<string, any> = {}) => {
    try {
      const { EnhancedAnalyticsService } = await import('../services/enhancedAnalyticsService');
      const analytics = EnhancedAnalyticsService.getInstance();
      await analytics.trackError(error, context, additionalContext);
    } catch (trackingError) {
      console.warn('Failed to track error:', trackingError);
    }
  }, []);

  const trackCustomError = useCallback(async (message: string, context: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
    try {
      const { EnhancedAnalyticsService } = await import('../services/enhancedAnalyticsService');
      const analytics = EnhancedAnalyticsService.getInstance();
      await analytics.trackCustomError(message, context, severity);
    } catch (trackingError) {
      console.warn('Failed to track custom error:', trackingError);
    }
  }, []);

  return {
    trackError,
    trackCustomError
  };
}; 