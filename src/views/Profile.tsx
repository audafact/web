import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../hooks/useUser';
import { SubscriptionManager } from '../components/SubscriptionManager';
import { User, Settings, CreditCard, Shield } from 'lucide-react';
import {
  ChangePasswordForm,
  OAuthPasswordHint,
} from '../auth/ChangePasswordForm';
import { TwoFactorSettings } from '../auth/TwoFactorSettings';
import { userHasEmailPasswordIdentity } from '../auth/changePasswordIdentity';

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const { isStarter } = useUser();
  const [passwordOpen, setPasswordOpen] = useState(false);

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

  const canChangePassword = userHasEmailPasswordIdentity(user);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold audafact-heading mb-2">Profile</h1>
        <p className="audafact-text-secondary">Manage your account and subscription</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
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

            <SubscriptionManager isStarter={isStarter} />
          </div>

          <div className="audafact-card-enhanced p-6 mt-6">
            <h3 className="text-lg font-semibold audafact-heading mb-4">Security</h3>
            <div className="space-y-4">
              <div className="p-4 border border-audafact-divider rounded-lg">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-medium audafact-heading">Password</h4>
                    <p className="text-sm audafact-text-secondary">
                      {canChangePassword
                        ? 'Update the password you use with your email.'
                        : 'Email password is not set for this account.'}
                    </p>
                  </div>
                  {canChangePassword ? (
                    <button
                      type="button"
                      onClick={() => setPasswordOpen((o) => !o)}
                      className="text-audafact-accent-blue hover:text-opacity-80 text-sm font-medium transition-colors shrink-0"
                    >
                      {passwordOpen ? 'Close' : 'Change password'}
                    </button>
                  ) : null}
                </div>
                {canChangePassword && passwordOpen ? (
                  <div className="mt-4 pt-4 border-t border-audafact-divider">
                    <ChangePasswordForm />
                  </div>
                ) : null}
                {!canChangePassword ? (
                  <div className="mt-4 pt-4 border-t border-audafact-divider">
                    <OAuthPasswordHint />
                  </div>
                ) : null}
              </div>

              <div className="p-4 border border-audafact-divider rounded-lg">
                <h4 className="font-medium audafact-heading mb-1">Two-factor authentication</h4>
                <p className="text-sm audafact-text-secondary mb-4">
                  Add an extra layer of security when signing in with your password.
                </p>
                <TwoFactorSettings />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
