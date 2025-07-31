import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

interface UserAccess {
  accessTier: 'free' | 'pro' | null;
  subscriptionId: string | null;
  planInterval: 'monthly' | 'yearly' | null;
  loading: boolean;
  error: string | null;
}

export const useUserAccess = (): UserAccess => {
  const { user } = useAuth();
  const [accessTier, setAccessTier] = useState<'free' | 'pro' | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [planInterval, setPlanInterval] = useState<'monthly' | 'yearly' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAccess = async () => {
      if (!user) {
        setAccessTier(null);
        setSubscriptionId(null);
        setPlanInterval(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('users')
          .select('access_tier, subscription_id, plan_interval')
          .eq('id', user.id)
          .single();

        if (fetchError) {
          console.error('Error fetching user access:', fetchError);
          setError(fetchError.message);
          setAccessTier('free'); // Default to free tier on error
        } else {
          setAccessTier(data?.access_tier || 'free');
          setSubscriptionId(data?.subscription_id || null);
          setPlanInterval(data?.plan_interval || null);
        }
      } catch (err) {
        console.error('Error in useUserAccess:', err);
        setError('Failed to fetch user access');
        setAccessTier('free'); // Default to free tier on error
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
    loading,
    error
  };
}; 