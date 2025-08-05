import { useEffect, useCallback } from 'react';

export const usePerformanceTracking = () => {
  const trackPerformance = useCallback(async (metric: string, value: number, context: Record<string, any> = {}) => {
    try {
      const { EnhancedAnalyticsService } = await import('../services/enhancedAnalyticsService');
      const analytics = EnhancedAnalyticsService.getInstance();
      await analytics.trackPerformance(metric, value, context);
    } catch (error) {
      console.warn('Failed to track performance metric:', error);
    }
  }, []);

  const startTimer = useCallback(async (metric: string) => {
    try {
      const { EnhancedAnalyticsService } = await import('../services/enhancedAnalyticsService');
      const analytics = EnhancedAnalyticsService.getInstance();
      return await analytics.startPerformanceTimer(metric);
    } catch (error) {
      console.warn('Failed to start performance timer:', error);
      return () => {}; // Return no-op function
    }
  }, []);

  return {
    trackPerformance,
    startTimer
  };
}; 