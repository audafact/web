import { supabase } from './supabase';

interface CheckoutSessionResponse {
  url?: string;
  error?: string;
}

interface SubscriptionData {
  subscriptionId: string;
  customerId: string;
  planInterval: 'monthly' | 'yearly';
  priceId: string;
  status: string;
}

export const createCheckoutSession = async (priceId: string): Promise<CheckoutSessionResponse> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'User not authenticated' };
    }

    // Call the Supabase Edge Function to create checkout session
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        priceId,
        userId: user.id,
        email: user.email,
        successUrl: `${window.location.origin}/checkout-result?success=true`,
        cancelUrl: `${window.location.origin}/checkout-result?canceled=true`
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      return { error: error.message || 'Failed to create checkout session' };
    }

    if (!data?.url) {
      return { error: 'No checkout URL received' };
    }

    return { url: data.url };
  } catch (error) {
    console.error('Stripe service error:', error);
    return { error: 'Failed to create checkout session' };
  }
};

export const getSubscriptionStatus = async (): Promise<SubscriptionData | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('subscription_id, stripe_customer_id, plan_interval, price_id')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      subscriptionId: data.subscription_id,
      customerId: data.stripe_customer_id,
      planInterval: data.plan_interval,
      priceId: data.price_id,
      status: 'active' // You might want to fetch this from Stripe API
    };
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return null;
  }
};

export const cancelSubscription = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Call the Supabase Edge Function to cancel subscription
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: {
        userId: user.id
      }
    });

    if (error) {
      console.error('Cancel subscription error:', error);
      return { success: false, error: error.message || 'Failed to cancel subscription' };
    }

    return { success: true };
  } catch (error) {
    console.error('Cancel subscription service error:', error);
    return { success: false, error: 'Failed to cancel subscription' };
  }
};

export const createCustomerPortalSession = async (): Promise<CheckoutSessionResponse> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'User not authenticated' };
    }

    // Call the Supabase Edge Function to create customer portal session
    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      body: {
        userId: user.id,
        returnUrl: `${window.location.origin}/studio`
      }
    });

    if (error) {
      console.error('Portal session error:', error);
      return { error: error.message || 'Failed to create portal session' };
    }

    if (!data?.url) {
      return { error: 'No portal URL received' };
    }

    return { url: data.url };
  } catch (error) {
    console.error('Portal session service error:', error);
    return { error: 'Failed to create portal session' };
  }
}; 