import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserAccess } from '../hooks/useUserAccess';
import { createCheckoutSession } from '../services/stripeService';
import { Check, Star, Zap, Crown, User } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  popular?: boolean;
  earlyAdopter?: boolean;
  priceId: string;
}

const plans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free Creator',
    price: '$0',
    interval: 'monthly',
    features: [
      '3 track uploads per month',
      'Basic saved sessions',
      'Access to 10 rotating curated library tracks',
      'Community support',
      'Basic measure detection',
      'Standard audio tools'
    ],
    priceId: ''
  },
  {
    id: import.meta.env.VITE_STRIPE_MODE === 'live' 
      ? import.meta.env.VITE_STRIPE_LIVE_PRODUCT_MONTHLY 
      : import.meta.env.VITE_STRIPE_TEST_PRODUCT_MONTHLY,
    name: 'Pro Creator Monthly',
    price: '$8',
    interval: 'monthly',
    features: [
      'Unlimited track uploads',
      'Unlimited saved sessions',
      'Unlimited curated library tracks',
      'Download your recordings',
      'AI-powered tagging (coming soon)',
      'Advanced loop detection (coming soon)',
      'Audio export tools (coming soon)',
      'Priority support & early features'
    ],
    priceId: import.meta.env.VITE_STRIPE_MODE === 'live' 
      ? import.meta.env.VITE_STRIPE_LIVE_PRICE_MONTHLY 
      : import.meta.env.VITE_STRIPE_TEST_PRICE_MONTHLY
  },
  {
    id: import.meta.env.VITE_STRIPE_MODE === 'live' 
      ? import.meta.env.VITE_STRIPE_LIVE_PRODUCT_YEARLY 
      : import.meta.env.VITE_STRIPE_TEST_PRODUCT_YEARLY,
    name: 'Pro Creator Yearly',
    price: '$72',
    originalPrice: '$96',
    interval: 'yearly',
    features: [
      'Everything in Monthly plan',
      '25% discount vs monthly',
      'Early access to new features',
      'Creator dashboard (coming soon)',
      'Monetization tools (coming soon)'
    ],
    popular: true,
    priceId: import.meta.env.VITE_STRIPE_MODE === 'live' 
      ? import.meta.env.VITE_STRIPE_LIVE_PRICE_YEARLY 
      : import.meta.env.VITE_STRIPE_TEST_PRICE_YEARLY
  },
  {
    id: import.meta.env.VITE_STRIPE_MODE === 'live' 
      ? import.meta.env.VITE_STRIPE_LIVE_PRODUCT_EARLY_ADOPTER 
      : import.meta.env.VITE_STRIPE_TEST_PRODUCT_EARLY_ADOPTER,
    name: 'Early Adopter Promo',
    price: '$64',
    originalPrice: '$96',
    interval: 'yearly',
    features: [
      'Full Pro Creator access',
      'Limited time pricing',
      'Lifetime early access to new features',
      'Direct input on product roadmap',
      'Special early adopter badge'
    ],
    earlyAdopter: true,
    priceId: import.meta.env.VITE_STRIPE_MODE === 'live' 
      ? import.meta.env.VITE_STRIPE_LIVE_PRICE_EARLY_ADOPTER 
      : import.meta.env.VITE_STRIPE_TEST_PRICE_EARLY_ADOPTER
  }
];

export const Pricing: React.FC = () => {
  const { user } = useAuth();
  const { accessTier, loading: accessLoading } = useUserAccess();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: PricingPlan) => {
    if (!user) {
      // For anonymous users, redirect to signup
      window.location.href = '/auth?redirect=pricing';
      return;
    }

    // Don't allow subscribing to free plan if already on it
    if (plan.id === 'free' && accessTier === 'free') {
      return;
    }

    setLoading(plan.id);
    try {
      const { url, error } = await createCheckoutSession(plan.priceId);
      if (error) {
        console.error('Checkout error:', error);
        alert('Failed to create checkout session. Please try again.');
        return;
      }
      
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const getCurrentPlan = () => {
    if (!user) return null;
    if (accessTier === 'pro') {
      return plans.find(plan => plan.id !== 'free' && plan.interval === 'yearly') || plans[1]; // Default to yearly pro
    }
    return plans[0]; // Free plan
  };

  const currentPlan = getCurrentPlan();

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user is already pro, show upgrade message
  if (user && accessTier === 'pro') {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="audafact-card-enhanced p-8">
            <div className="flex justify-center mb-6">
              <div className="bg-audafact-accent-green bg-opacity-20 p-3 rounded-full">
                <Check className="h-8 w-8 text-audafact-accent-green" />
              </div>
            </div>
            <h1 className="text-3xl font-bold audafact-heading mb-4">
              You're already a Pro Creator!
            </h1>
            <p className="text-lg audafact-text-secondary mb-8">
              You have access to all premium features. Enjoy creating amazing music!
            </p>
            <a
              href="/studio"
              className="audafact-button-primary"
            >
              Go to Studio
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold audafact-heading mb-6">
          Choose Your Creator Plan
        </h1>
        <p className="text-xl audafact-text-secondary max-w-2xl mx-auto">
          Start free and upgrade when you're ready. All plans include access to our curated audio library 
          and powerful music creation tools.
        </p>
        {!user && (
          <div className="mt-6">
            <p className="text-sm audafact-text-secondary mb-3">
              Already have an account? 
              <a href="/auth" className="text-audafact-accent-cyan hover:underline ml-1">
                Sign in here
              </a>
            </p>
          </div>
        )}
      </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            const isFreePlan = plan.id === 'free';
            
            return (
              <div
                key={plan.id}
                className={`relative audafact-card-enhanced audafact-card-hover p-6 transition-all duration-200 ${
                  plan.popular ? 'ring-2 ring-audafact-accent-blue scale-105' : ''
                } ${isCurrentPlan ? 'ring-2 ring-audafact-accent-green' : ''}`}
              >
                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-audafact-accent-green text-audafact-bg-primary px-3 py-1 rounded-full text-xs font-semibold flex items-center">
                      <User className="h-3 w-3 mr-1" />
                      Current Plan
                    </span>
                  </div>
                )}

                {/* Popular Badge */}
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-audafact-accent-blue text-audafact-text-primary px-3 py-1 rounded-full text-xs font-semibold flex items-center">
                      <Star className="h-3 w-3 mr-1" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Early Adopter Badge */}
                {plan.earlyAdopter && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-audafact-accent-cyan text-audafact-bg-primary px-3 py-1 rounded-full text-xs font-semibold flex items-center">
                      <Zap className="h-3 w-3 mr-1" />
                      Limited Time
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center mb-3">
                    {plan.popular && <Crown className="h-5 w-5 text-audafact-accent-cyan mr-2" />}
                    <h3 className="text-xl font-bold audafact-heading">{plan.name}</h3>
                  </div>
                  
                  <div className="mb-3">
                    <span className="text-3xl font-bold audafact-heading">{plan.price}</span>
                    {!isFreePlan && (
                      <span className="audafact-text-secondary">/{plan.interval === 'monthly' ? 'month' : 'year'}</span>
                    )}
                  </div>
                  
                  {plan.originalPrice && (
                    <div className="text-sm audafact-text-secondary">
                      <span className="line-through">{plan.originalPrice}</span>
                      <span className="text-audafact-accent-green font-semibold ml-2">
                        Save ${parseInt(plan.originalPrice.replace('$', '')) - parseInt(plan.price.replace('$', ''))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-4 w-4 text-audafact-accent-green mr-2 mt-0.5 flex-shrink-0" />
                      <span className="audafact-text-secondary text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={loading === plan.id || isCurrentPlan}
                  className={`w-full py-2 px-4 rounded-lg font-semibold transition-all duration-200 text-sm ${
                    isCurrentPlan
                      ? 'bg-audafact-accent-green text-audafact-bg-primary cursor-default'
                      : plan.popular
                      ? 'audafact-button-primary'
                      : plan.earlyAdopter
                      ? 'bg-audafact-accent-cyan text-audafact-bg-primary hover:bg-opacity-90'
                      : isFreePlan
                      ? 'audafact-button-secondary'
                      : 'audafact-button-secondary'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading === plan.id ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : !user ? (
                    'Sign Up'
                  ) : isFreePlan ? (
                    'Get Started'
                  ) : (
                    `Get ${plan.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center audafact-heading mb-8">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="audafact-card p-6">
              <h3 className="text-lg font-semibold audafact-heading mb-2">
                Can I cancel anytime?
              </h3>
              <p className="audafact-text-secondary">
                Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
              </p>
            </div>
            <div className="audafact-card p-6">
              <h3 className="text-lg font-semibold audafact-heading mb-2">
                What payment methods do you accept?
              </h3>
              <p className="audafact-text-secondary">
                We accept all major credit cards, debit cards, and digital wallets through our secure Stripe integration.
              </p>
            </div>
            <div className="audafact-card p-6">
              <h3 className="text-lg font-semibold audafact-heading mb-2">
                Is there a free plan?
              </h3>
              <p className="audafact-text-secondary">
                Yes! We offer a free tier with 3 track uploads per month and basic features. 
                Perfect for getting started with music creation.
              </p>
            </div>
            <div className="audafact-card p-6">
              <h3 className="text-lg font-semibold audafact-heading mb-2">
                Can I change my plan later?
              </h3>
              <p className="audafact-text-secondary">
                Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}; 