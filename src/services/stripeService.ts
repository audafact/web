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