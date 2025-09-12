import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUser } from './useUser';
import { analytics } from '../services/analyticsService';

/**
 * Hook that automatically syncs analytics service with current user and tier
 * This ensures analytics always has the correct user ID and tier information
 */
export const useAnalyticsWithAuth = () => {
  const { user } = useAuth();
  const { tier } = useUser();

  useEffect(() => {
    if (user) {
      // Update analytics with current user and tier
      analytics.setUser(user.id, tier.id);
    } else {
      // Clear analytics user for guests
      analytics.setUser('', 'guest');
    }
  }, [user, tier.id]);

  return {
    // Return analytics instance for direct use if needed
    analytics,
    // Helper to track events with automatic tier inclusion
    trackEvent: <K extends keyof import('../services/analyticsService').TrackingEvents>(
      event: K,
      properties: import('../services/analyticsService').TrackingEvents[K]
    ) => {
      // Ensure userTier is always included
      const propertiesWithTier = {
        ...properties,
        userTier: tier.id,
      };
      analytics.track(event, propertiesWithTier as any);
    }
  };
};
