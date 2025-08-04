import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserTier } from './useUserTier';
import { AccessService, AccessStatus, EnhancedAccessService } from '../services/accessService';

export const useAccessControl = () => {
  const { user } = useAuth();
  const { tier } = useUserTier();
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAccessStatus = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const status = await AccessService.getUserAccessStatus(user.id, tier.id);
      setAccessStatus(status);
    } catch (error) {
      console.error('Error fetching access status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAccessStatus();
  }, [user?.id, tier.id]);

  const canAccessFeature = (feature: string): boolean => {
    return EnhancedAccessService.canAccessFeature(feature, tier);
  };

  const canPerformAction = async (action: 'upload' | 'save_session' | 'record' | 'add_library_track' | 'download'): Promise<boolean> => {
    if (!user?.id) return false;
    
    const hasFeatureAccess = canAccessFeature(action);
    if (!hasFeatureAccess) return false;
    
    return EnhancedAccessService.checkUsageLimits(user.id, tier, action);
  };

  const getUpgradeMessage = (action: string): string => {
    const config = EnhancedAccessService.getFeatureGateConfig(action);
    return config.message;
  };

  return {
    accessStatus,
    loading,
    refreshAccessStatus,
    canAccessFeature,
    canPerformAction,
    getUpgradeMessage,
    tier
  };
};