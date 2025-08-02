import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserAccess } from './useUserAccess';
import { AccessService, AccessStatus } from '../services/accessService';

export const useAccessControl = () => {
  const { user } = useAuth();
  const { accessTier } = useUserAccess();
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAccessStatus = async () => {
    if (!user?.id || !accessTier) return;
    
    setLoading(true);
    try {
      const status = await AccessService.getUserAccessStatus(user.id, accessTier);
      setAccessStatus(status);
    } catch (error) {
      console.error('Error fetching access status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAccessStatus();
  }, [user?.id, accessTier]);

  const canPerformAction = async (action: 'upload' | 'save_session' | 'record' | 'add_library_track' | 'download'): Promise<boolean> => {
    if (!user?.id || !accessTier) return false;
    return AccessService.canPerformAction(user.id, accessTier, action);
  };

  const getUpgradeMessage = (action: 'upload' | 'save_session' | 'record' | 'add_library_track' | 'download'): string => {
    return AccessService.getUpgradeMessage(action);
  };

  const isProUser = accessTier === 'pro';

  return {
    accessStatus,
    loading,
    refreshAccessStatus,
    canPerformAction,
    getUpgradeMessage,
    isProUser
  };
};