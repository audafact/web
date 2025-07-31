import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserAccess } from '../hooks/useUserAccess';
import { createCheckoutSession } from '../services/stripeService';
import { Check, Star, Zap, Crown } from 'lucide-react';

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
    id: 'monthly',
    name: 'Pro Creator',
    price: '$8',
    interval: 'monthly',
    features: [
      'Unlimited tracks and recordings',
      'Advanced audio analysis',
      'Export in multiple formats',
      'Priority support',
      'Cloud storage (10GB)',
      'Collaborative features'
    ],
    priceId: 'price_monthly' // You'll replace this with actual Stripe price IDs
  },
  {
    id: 'yearly',
    name: 'Pro Creator',
    price: '$72',
    originalPrice: '$96',
    interval: 'yearly',
    features: [
      'Everything in Monthly plan',
      '25% discount vs monthly',
      'Early access to new features',
      'Extended cloud storage (20GB)',
      'Advanced analytics dashboard'
    ],
    popular: true,
    priceId: 'price_yearly'
  },
  {
    id: 'early-adopter',
    name: 'Early Adopter',
    price: '$64',
    originalPrice: '$96',
    interval: 'yearly',
    features: [
      'Everything in Yearly plan',
      'Limited time offer',
      'Lifetime access to beta features',
      'Exclusive community access',
      'Direct feedback channel'
    ],
    earlyAdopter: true,
    priceId: 'price_early_adopter'
  }
];

export const Pricing: React.FC = () => {
  const { user } = useAuth();
  const { accessTier, loading: accessLoading } = useUserAccess();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: PricingPlan) => {
    if (!user) {
      // Redirect to auth or show auth modal
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

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If user is already pro, show upgrade message
  if (accessTier === 'pro') {
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
          Choose Your Plan
        </h1>
        <p className="text-xl audafact-text-secondary max-w-2xl mx-auto">
          Unlock your creative potential with our Pro Creator plans. 
          Start creating professional music today.
        </p>
      </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative audafact-card-enhanced audafact-card-hover p-8 transition-all duration-200 ${
                plan.popular ? 'ring-2 ring-audafact-accent-blue scale-105' : ''
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-audafact-accent-blue text-audafact-text-primary px-4 py-2 rounded-full text-sm font-semibold flex items-center">
                    <Star className="h-4 w-4 mr-1" />
                    Most Popular
                  </span>
                </div>
              )}

              {/* Early Adopter Badge */}
              {plan.earlyAdopter && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-audafact-accent-cyan text-audafact-bg-primary px-4 py-2 rounded-full text-sm font-semibold flex items-center">
                    <Zap className="h-4 w-4 mr-1" />
                    Limited Time
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <div className="flex items-center justify-center mb-4">
                  {plan.popular && <Crown className="h-6 w-6 text-audafact-accent-cyan mr-2" />}
                  <h3 className="text-2xl font-bold audafact-heading">{plan.name}</h3>
                </div>
                
                <div className="mb-4">
                  <span className="text-4xl font-bold audafact-heading">{plan.price}</span>
                  <span className="audafact-text-secondary">/{plan.interval === 'monthly' ? 'month' : 'year'}</span>
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
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-audafact-accent-green mr-3 mt-0.5 flex-shrink-0" />
                    <span className="audafact-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={loading === plan.id}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                  plan.popular
                    ? 'audafact-button-primary'
                    : plan.earlyAdopter
                    ? 'bg-audafact-accent-cyan text-audafact-bg-primary hover:bg-opacity-90'
                    : 'audafact-button-secondary'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === plan.id ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  `Get ${plan.name}`
                )}
              </button>
            </div>
          ))}
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
                Is there a free trial?
              </h3>
              <p className="audafact-text-secondary">
                We offer a free tier with basic features. Upgrade to Pro Creator to unlock all premium features.
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