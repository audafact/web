import { useCallback } from 'react';
import { EnhancedAnalyticsService } from '../services/enhancedAnalyticsService';

export const usePerformanceTracking = (metricName: string) => {
  const analytics = EnhancedAnalyticsService.getInstance();
  
  const trackMetric = useCallback((value: number, context: Record<string, any> = {}) => {
    analytics.trackPerformance(metricName, value, context);
  }, [metricName, analytics]);
  
  const startTimer = useCallback(() => {
    return analytics.startPerformanceTimer(metricName);
  }, [metricName, analytics]);
  
  return { trackMetric, startTimer };
}; 