import React from 'react';
import { useAuth } from '../context/AuthContext';
import { SubscriptionManager } from '../components/SubscriptionManager';
import { User, Settings, CreditCard, Shield } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold audafact-heading mb-4">
            Please sign in to view your profile
          </h1>
          <a
            href="/auth"
            className="audafact-button-primary"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold audafact-heading mb-2">Profile</h1>
        <p className="audafact-text-secondary">Manage your account and subscription</p>
      </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* User Info */}
          <div className="lg:col-span-1">
            <div className="audafact-card-enhanced p-6">
              <div className="flex items-center mb-6">
                <div className="bg-audafact-accent-blue bg-opacity-20 p-3 rounded-full mr-4">
                  <User className="h-8 w-8 text-audafact-accent-blue" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold audafact-heading">Account Info</h2>
                  <p className="audafact-text-secondary">Your personal information</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium audafact-text-secondary mb-1">
                    Email
                  </label>
                  <p className="audafact-heading">{user.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium audafact-text-secondary mb-1">
                    User ID
                  </label>
                  <p className="text-sm audafact-text-secondary font-mono">
                    {user.id.slice(0, 8)}...
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium audafact-text-secondary mb-1">
                    Member Since
                  </label>
                  <p className="audafact-heading">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="audafact-card-enhanced p-6 mt-6">
              <h3 className="text-lg font-semibold audafact-heading mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <a
                  href="/studio"
                  className="flex items-center p-3 audafact-text-secondary hover:bg-audafact-surface-2 rounded-lg transition-colors"
                >
                  <Settings className="h-5 w-5 mr-3 text-audafact-text-secondary" />
                  <span>Go to Studio</span>
                </a>
                <a
                  href="/pricing"
                  className="flex items-center p-3 audafact-text-secondary hover:bg-audafact-surface-2 rounded-lg transition-colors"
                >
                  <CreditCard className="h-5 w-5 mr-3 text-audafact-text-secondary" />
                  <span>View Plans</span>
                </a>
              </div>
            </div>
          </div>

          {/* Subscription Management */}
          <div className="lg:col-span-2">
            <div className="audafact-card-enhanced p-6">
              <div className="flex items-center mb-6">
                <div className="bg-audafact-accent-green bg-opacity-20 p-3 rounded-full mr-4">
                  <Shield className="h-8 w-8 text-audafact-accent-green" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold audafact-heading">Subscription</h2>
                  <p className="audafact-text-secondary">Manage your billing and plan</p>
                </div>
              </div>

              <SubscriptionManager />
            </div>

            {/* Account Security */}
            <div className="audafact-card-enhanced p-6 mt-6">
              <h3 className="text-lg font-semibold audafact-heading mb-4">Security</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-audafact-divider rounded-lg">
                  <div>
                    <h4 className="font-medium audafact-heading">Password</h4>
                    <p className="text-sm audafact-text-secondary">Last changed: Unknown</p>
                  </div>
                  <button className="text-audafact-accent-blue hover:text-opacity-80 text-sm font-medium transition-colors">
                    Change Password
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-audafact-divider rounded-lg">
                  <div>
                    <h4 className="font-medium audafact-heading">Two-Factor Authentication</h4>
                    <p className="text-sm audafact-text-secondary">Add an extra layer of security</p>
                  </div>
                  <button className="text-audafact-accent-blue hover:text-opacity-80 text-sm font-medium transition-colors">
                    Enable 2FA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}; 