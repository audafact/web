import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUserProfileRow } from '../services/userProfileFetch';

interface UserAccess {
  accessTier: 'free' | 'starter' | 'pro' | null;
  subscriptionId: string | null;
  planInterval: 'monthly' | 'yearly' | null;
  proAccessSource: 'founder_manual' | 'invite_code' | null;
  proExpiresAt: string | null;
  loading: boolean;
  error: string | null;
}

export const useUserAccess = (): UserAccess => {
  const { user } = useAuth();
  const [accessTier, setAccessTier] = useState<'free' | 'starter' | 'pro' | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [planInterval, setPlanInterval] = useState<'monthly' | 'yearly' | null>(null);
  const [proAccessSource, setProAccessSource] = useState<'founder_manual' | 'invite_code' | null>(null);
  const [proExpiresAt, setProExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAccess = async () => {
      if (!user) {
        setAccessTier(null);
        setSubscriptionId(null);
        setPlanInterval(null);
        setProAccessSource(null);
        setProExpiresAt(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await fetchUserProfileRow(user.id);

        if (fetchError) {
          setError(fetchError.message);
          setAccessTier('free');
        } else {
          const t = (data?.access_tier || 'free').toLowerCase();
          if (t === 'enterprise' || t === 'pro') setAccessTier('pro');
          else if (t === 'starter') setAccessTier('starter');
          else setAccessTier('free');
          setSubscriptionId(data?.subscription_id || null);
          setPlanInterval((data?.plan_interval as 'monthly' | 'yearly') || null);
          setProAccessSource((data?.pro_access_source as 'founder_manual' | 'invite_code') || null);
          setProExpiresAt(data?.pro_expires_at || null);
        }
      } catch (err) {
        setError('Failed to fetch user access');
        setAccessTier('free');
        setProAccessSource(null);
        setProExpiresAt(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAccess();
  }, [user]);

  return {
    accessTier,
    subscriptionId,
    planInterval,
    proAccessSource,
    proExpiresAt,
    loading,
    error
  };
}; 