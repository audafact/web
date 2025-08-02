import { supabase } from './supabase';

interface CheckoutSessionResponse {
  url?: string;
  error?: string;
}

export const createCheckoutSession = async (priceId: string): Promise<CheckoutSessionResponse> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'User not authenticated' };
    }

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
      return { error: error.message || 'Failed to create checkout session' };
    }

    return { url: data?.url };
  } catch (error) {
    return { error: 'Failed to create checkout session' };
  }
};

export const createCustomerPortalSession = async (): Promise<CheckoutSessionResponse> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'User not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      body: {
        userId: user.id,
        returnUrl: `${window.location.origin}/studio`
      }
    });

    if (error) {
      return { error: error.message || 'Failed to create portal session' };
    }

    return { url: data?.url };
  } catch (error) {
    return { error: 'Failed to create portal session' };
  }
};

export const cancelSubscription = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: {
        userId: user.id
      }
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to cancel subscription' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to cancel subscription' };
  }
}; 