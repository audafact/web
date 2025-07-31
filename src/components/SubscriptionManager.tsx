import React, { useState } from 'react';
import { useUserAccess } from '../hooks/useUserAccess';
import { createCustomerPortalSession, cancelSubscription } from '../services/stripeService';
import { CreditCard, Calendar, AlertTriangle, CheckCircle, Settings } from 'lucide-react';

export const SubscriptionManager: React.FC = () => {
  const { accessTier, subscriptionId, planInterval, loading } = useUserAccess();
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { url, error } = await createCustomerPortalSession();
      if (error) {
        alert(`Error: ${error}`);
        return;
      }
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Portal session error:', error);
      alert('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to Pro features at the end of your current billing period.')) {
      return;
    }

    setCancelLoading(true);
    try {
      const { success, error } = await cancelSubscription();
      if (error) {
        alert(`Error: ${error}`);
        return;
      }
      if (success) {
        alert('Your subscription has been canceled. You will have access until the end of your billing period.');
        window.location.reload();
      }
    } catch (error) {
      console.error('Cancel subscription error:', error);
      alert('Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (accessTier !== 'pro') {
    return (
      <div className="audafact-card p-6">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-audafact-accent-cyan mx-auto mb-4" />
          <h3 className="text-lg font-semibold audafact-heading mb-2">
            Free Plan Active
          </h3>
          <p className="audafact-text-secondary mb-4">
            You're currently on the free plan. Upgrade to Pro Creator to unlock all features.
          </p>
          <a
            href="/pricing"
            className="audafact-button-primary"
          >
            Upgrade to Pro
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="audafact-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <CheckCircle className="h-8 w-8 text-audafact-accent-green mr-3" />
          <div>
            <h3 className="text-lg font-semibold audafact-heading">
              Pro Creator Plan
            </h3>
            <p className="text-sm audafact-text-secondary">
              {planInterval === 'monthly' ? 'Monthly billing' : 'Annual billing'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold audafact-heading">
            {planInterval === 'monthly' ? '$8' : '$72'}
          </div>
          <div className="text-sm audafact-text-secondary">
            per {planInterval === 'monthly' ? 'month' : 'year'}
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex items-center text-sm audafact-text-secondary">
          <CreditCard className="h-4 w-4 mr-2" />
          <span>Subscription ID: {subscriptionId?.slice(-8) || 'N/A'}</span>
        </div>
        <div className="flex items-center text-sm audafact-text-secondary">
          <Calendar className="h-4 w-4 mr-2" />
          <span>Billing Cycle: {planInterval === 'monthly' ? 'Monthly' : 'Annual'}</span>
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={handleManageBilling}
          disabled={portalLoading}
          className="flex-1 flex items-center justify-center px-4 py-2 border border-audafact-divider rounded-md shadow-sm text-sm font-medium audafact-text-secondary bg-audafact-surface-2 hover:bg-audafact-divider focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-audafact-accent-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {portalLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-audafact-text-secondary mr-2"></div>
          ) : (
            <Settings className="h-4 w-4 mr-2" />
          )}
          Manage Billing
        </button>
        
        <button
          onClick={handleCancelSubscription}
          disabled={cancelLoading}
          className="flex-1 flex items-center justify-center px-4 py-2 border border-audafact-alert-red rounded-md shadow-sm text-sm font-medium text-audafact-alert-red bg-audafact-surface-2 hover:bg-audafact-alert-red hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-audafact-alert-red disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {cancelLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-audafact-alert-red mr-2"></div>
          ) : (
            <AlertTriangle className="h-4 w-4 mr-2" />
          )}
          Cancel Subscription
        </button>
      </div>

      <div className="mt-4 p-4 bg-audafact-accent-blue bg-opacity-10 rounded-md border border-audafact-accent-blue border-opacity-20">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-audafact-accent-blue" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium audafact-heading">
              Need help?
            </h3>
            <div className="mt-2 text-sm audafact-text-secondary">
              <p>
                Contact our support team if you have any questions about your subscription or billing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 