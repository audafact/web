import { useCallback } from 'react';
import { analytics, trackEvent, trackError, trackFeatureError, trackMetric, TrackingEvents } from '../services/analyticsService';
import { useUserTier } from './useUserTier';

export const useAnalytics = () => {
  const { userTier } = useUserTier();
  
  const trackEventWithTier = useCallback(<K extends keyof TrackingEvents>(
    event: K, 
    properties: TrackingEvents[K]
  ) => {
    // Ensure userTier is included in properties if not already present
    const propertiesWithTier = {
      ...properties,
      userTier: (properties as any).userTier || userTier
    };
    
    trackEvent(event, propertiesWithTier as TrackingEvents[K]);
  }, [userTier]);
  
  const trackFunnelProgress = useCallback((stage: string, properties: any) => {
    // This is handled automatically by the analytics service
    // when tracking events that match funnel stages
    console.log(`Funnel progress: ${stage}`, properties);
  }, []);
  
  const trackErrorWithContext = useCallback((error: Error, context: string) => {
    trackError(error, context);
  }, []);
  
  const trackFeatureErrorWithContext = useCallback((feature: string, error: Error) => {
    trackFeatureError(feature, error);
  }, []);
  
  const trackMetricWithTier = useCallback((name: string, value: number) => {
    trackMetric(name, value);
  }, []);
  
  const trackFeatureResponseTime = useCallback((feature: string) => {
    return analytics.trackFeatureResponseTime(feature);
  }, []);
  
  const trackDemoSession = useCallback((action: 'started' | 'ended', data?: any) => {
    if (action === 'started') {
      trackEventWithTier('demo_session_started', {
        timestamp: Date.now()
      });
    } else if (action === 'ended') {
      trackEventWithTier('demo_session_ended', {
        duration: data?.duration || 0,
        actions: data?.actions || []
      });
    }
  }, [trackEventWithTier]);
  
  const trackLibraryInteraction = useCallback((
    action: 'opened' | 'previewed' | 'added' | 'searched',
    data: any
  ) => {
    switch (action) {
      case 'opened':
        trackEventWithTier('library_panel_opened', {
          userTier
        });
        break;
      case 'previewed':
        trackEventWithTier('library_track_previewed', {
          trackId: data.trackId,
          genre: data.genre,
          bpm: data.bpm,
          userTier
        });
        break;
      case 'added':
        trackEventWithTier('library_track_added', {
          trackId: data.trackId,
          genre: data.genre,
          userTier
        });
        break;
      case 'searched':
        trackEventWithTier('library_search_performed', {
          searchTerm: data.searchTerm,
          resultsCount: data.resultsCount,
          userTier
        });
        break;
    }
  }, [trackEventWithTier, userTier]);
  
  const trackStudioAction = useCallback((
    action: 'uploaded' | 'saved' | 'recording_started' | 'recording_stopped' | 'downloaded',
    data: any
  ) => {
    switch (action) {
      case 'uploaded':
        trackEventWithTier('track_uploaded', {
          fileName: data.fileName,
          fileSize: data.fileSize,
          fileType: data.fileType,
          userTier
        });
        break;
      case 'saved':
        trackEventWithTier('session_saved', {
          sessionName: data.sessionName,
          userTier,
          isModified: data.isModified
        });
        break;
      case 'recording_started':
        trackEventWithTier('recording_started', {
          userTier
        });
        break;
      case 'recording_stopped':
        trackEventWithTier('recording_stopped', {
          userTier
        });
        break;
      case 'downloaded':
        trackEventWithTier('recording_downloaded', {
          fileName: data.fileName,
          format: data.format,
          userTier
        });
        break;
    }
  }, [trackEventWithTier, userTier]);
  
  return {
    trackEvent: trackEventWithTier,
    trackFunnelProgress,
    trackError: trackErrorWithContext,
    trackFeatureError: trackFeatureErrorWithContext,
    trackMetric: trackMetricWithTier,
    trackFeatureResponseTime,
    trackDemoSession,
    trackLibraryInteraction,
    trackStudioAction,
    getSessionId: () => analytics.getSessionId(),
    getRetryQueueLength: () => analytics.getRetryQueueLength(),
    getFunnelConversionRate: () => analytics.getFunnelConversionRate(),
    getAverageMetric: (name: string) => analytics.getAverageMetric(name)
  };
}; 