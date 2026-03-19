import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserAccess } from '../hooks/useUserAccess';
import { createCheckoutSession } from '../services/stripeService';
import { Check, Star, Crown, User } from 'lucide-react';

const isLive = import.meta.env.VITE_STRIPE_MODE === 'live';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  popular?: boolean;
  priceId: string;
  planTier: 'free' | 'starter' | 'pro';
}

const starterPriceId = isLive
  ? import.meta.env.VITE_STRIPE_LIVE_PRICE_STARTER_MONTHLY ?? ''
  : import.meta.env.VITE_STRIPE_TEST_PRICE_STARTER_MONTHLY ?? '';

const proMonthlyPriceId = isLive
  ? import.meta.env.VITE_STRIPE_LIVE_PRICE_MONTHLY ?? ''
  : import.meta.env.VITE_STRIPE_TEST_PRICE_MONTHLY ?? '';

const proYearlyPriceId = isLive
  ? import.meta.env.VITE_STRIPE_LIVE_PRICE_YEARLY ?? ''
  : import.meta.env.VITE_STRIPE_TEST_PRICE_YEARLY ?? '';

const plans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    interval: 'monthly',
    planTier: 'free',
    features: [
      '5 track uploads',
      '3 saved sessions',
      '2 recordings',
      'MP3 export',
      'Multiple sources + catalog',
      'Cue trigger style',
    ],
    priceId: '',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$5',
    interval: 'monthly',
    planTier: 'starter',
    features: [
      '12 uploads, 8 sessions, 8 recordings',
      'MP3 export',
      'Full sample suggestions',
      'Keep creating without hitting Free limits',
    ],
    priceId: starterPriceId,
  },
  {
    id: 'pro-monthly',
    name: 'Pro',
    price: '$10',
    interval: 'monthly',
    planTier: 'pro',
    popular: true,
    features: [
      'Unlimited uploads, sessions & recordings',
      'WAV export for your DAW',
      'Hold & One-Shot trigger styles',
      'Full performance + production control',
    ],
    priceId: proMonthlyPriceId,
  },
  {
    id: 'pro-yearly',
    name: 'Pro (Yearly)',
    price: '$96',
    originalPrice: '$120',
    interval: 'yearly',
    planTier: 'pro',
    features: [
      'Everything in Pro monthly',
      '2 months free vs monthly',
      'Priority support & early features',
    ],
    priceId: proYearlyPriceId,
  },
];

export const Pricing: React.FC = () => {
  const { user } = useAuth();
  const { accessTier, loading: accessLoading } = useUserAccess();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: PricingPlan) => {
    if (!user) {
      window.location.href = '/auth?redirect=pricing';
      return;
    }

    if (plan.planTier === 'free') return;

    if (!plan.priceId) {
      alert(
        'Checkout for this plan is not configured. Set VITE_STRIPE_TEST_PRICE_STARTER_MONTHLY (and Pro prices) in your environment.'
      );
      return;
    }

    setLoading(plan.id);
    try {
      const tier = plan.planTier === 'starter' ? 'starter' : 'pro';
      const { url, error } = await createCheckoutSession(plan.priceId, tier);
      if (error) {
        console.error('Checkout error:', error);
        alert('Failed to create checkout session. Please try again.');
        return;
      }
      if (url) window.location.href = url;
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const getCurrentPlan = (): PricingPlan | null => {
    if (!user) return null;
    if (accessTier === 'pro') {
      return plans.find((p) => p.id === 'pro-yearly') ?? plans.find((p) => p.id === 'pro-monthly') ?? null;
    }
    if (accessTier === 'starter') {
      return plans.find((p) => p.id === 'starter') ?? null;
    }
    return plans[0];
  };

  const currentPlan = getCurrentPlan();

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold audafact-heading mb-4">You&apos;re on Pro</h1>
            <p className="text-lg audafact-text-secondary mb-8">
              Full performance + production control — WAV export, all trigger styles, unlimited creation.
            </p>
            <a href="/studio" className="audafact-button-primary">
              Go to Studio
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold audafact-heading mb-6">Choose Your Plan</h1>
        <p className="text-xl audafact-text-secondary max-w-2xl mx-auto">
          Start free. Upgrade when you want more room to create — or go Pro for full control.
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

      {user && accessTier === 'starter' && (
        <div className="max-w-2xl mx-auto mb-10 audafact-card-enhanced p-4 text-center audafact-text-secondary text-sm">
          You&apos;re on <strong className="text-audafact-text-primary">Starter</strong>. Upgrade to Pro for WAV
          export, Hold &amp; One-Shot modes, and unlimited everything.
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan?.id === plan.id;
          const isFreePlan = plan.planTier === 'free';
          const missingPrice = !isFreePlan && !plan.priceId;

          return (
            <div
              key={plan.id}
              className={`relative audafact-card-enhanced audafact-card-hover p-6 transition-all duration-200 ${
                plan.popular ? 'ring-2 ring-audafact-accent-blue scale-105' : ''
              } ${isCurrentPlan ? 'ring-2 ring-audafact-accent-green' : ''}`}
            >
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-audafact-accent-green text-audafact-bg-primary px-3 py-1 rounded-full text-xs font-semibold flex items-center">
                    <User className="h-3 w-3 mr-1" />
                    Current Plan
                  </span>
                </div>
              )}

              {plan.popular && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-audafact-accent-blue text-audafact-text-primary px-3 py-1 rounded-full text-xs font-semibold flex items-center">
                    <Star className="h-3 w-3 mr-1" />
                    Full control
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <div className="flex items-center justify-center mb-3">
                  {plan.popular && <Crown className="h-5 w-5 text-audafact-accent-cyan mr-2" />}
                  <h3 className="text-xl font-bold audafact-heading">{plan.name}</h3>
                </div>

                <div className="mb-3">
                  <span className="text-3xl font-bold audafact-heading">{plan.price}</span>
                  {!isFreePlan && (
                    <span className="audafact-text-secondary">
                      /{plan.interval === 'monthly' ? 'month' : 'year'}
                    </span>
                  )}
                </div>

                {plan.originalPrice && (
                  <div className="text-sm audafact-text-secondary">
                    <span className="line-through">{plan.originalPrice}</span>
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-4 w-4 text-audafact-accent-green mr-2 mt-0.5 flex-shrink-0" />
                    <span className="audafact-text-secondary text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={
                  loading === plan.id ||
                  isCurrentPlan ||
                  (missingPrice && !isFreePlan) ||
                  (accessTier === 'starter' && plan.planTier === 'starter')
                }
                className={`w-full py-2 px-4 rounded-lg font-semibold transition-all duration-200 text-sm ${
                  isCurrentPlan
                    ? 'bg-audafact-accent-green text-audafact-bg-primary cursor-default'
                    : plan.popular
                      ? 'audafact-button-primary'
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
                  'Sign up'
                ) : isFreePlan ? (
                  'Get Started'
                ) : missingPrice ? (
                  'Coming soon'
                ) : accessTier === 'free' && plan.planTier === 'starter' ? (
                  'Get Starter'
                ) : accessTier === 'free' && plan.planTier === 'pro' ? (
                  'Go Pro'
                ) : accessTier === 'starter' && plan.planTier === 'pro' ? (
                  'Upgrade to Pro'
                ) : (
                  `Choose ${plan.name}`
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-16 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center audafact-heading mb-8">FAQ</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="audafact-card p-6">
            <h3 className="text-lg font-semibold audafact-heading mb-2">Can I cancel anytime?</h3>
            <p className="audafact-text-secondary">
              Yes. You keep access until the end of your billing period.
            </p>
          </div>
          <div className="audafact-card p-6">
            <h3 className="text-lg font-semibold audafact-heading mb-2">What&apos;s on Free?</h3>
            <p className="audafact-text-secondary">
              Enough to build a habit: uploads, sessions, recordings, MP3 export, and cue-style chops. Pro adds WAV,
              Hold/One-Shot, and unlimited usage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
