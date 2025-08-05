import { useCallback } from 'react';
import { EnhancedAnalyticsService } from '../services/enhancedAnalyticsService';

export const useErrorTracking = () => {
  const analytics = EnhancedAnalyticsService.getInstance();
  
  const trackError = useCallback((
    error: Error, 
    context: string, 
    additionalContext: Record<string, any> = {}
  ) => {
    analytics.trackError(error, context, additionalContext);
  }, [analytics]);
  
  const trackCustomError = useCallback((
    message: string,
    context: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) => {
    analytics.trackCustomError(message, context, severity);
  }, [analytics]);
  
  return { trackError, trackCustomError };
}; 