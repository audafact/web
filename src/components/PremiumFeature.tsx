import React from 'react';
import { useUserAccess } from '../hooks/useUserAccess';
import { Crown, Lock } from 'lucide-react';

interface PremiumFeatureProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export const PremiumFeature: React.FC<PremiumFeatureProps> = ({
  children,
  fallback,
  showUpgradePrompt = true
}) => {
  const { accessTier, loading } = useUserAccess();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (accessTier === 'pro') {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <div className="relative">
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 rounded-lg"></div>
      
      {/* Content with reduced opacity */}
      <div className="opacity-30 pointer-events-none">
        {children}
      </div>
      
      {/* Upgrade prompt */}
      <div className="absolute inset-0 flex items-center justify-center z-20">
        <div className="audafact-card-enhanced p-6 shadow-lg max-w-sm mx-4">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-blue p-3 rounded-full">
                <Crown className="h-8 w-8 text-audafact-bg-primary" />
              </div>
            </div>
            <h3 className="text-lg font-semibold audafact-heading mb-2">
              Pro Feature
            </h3>
            <p className="audafact-text-secondary mb-4">
              This feature is available exclusively to Pro Creator subscribers.
            </p>
            <a
              href="/pricing"
              className="audafact-button-primary"
            >
              <Lock className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook for conditional rendering
export const usePremiumFeature = () => {
  const { accessTier, loading } = useUserAccess();
  
  return {
    isPro: accessTier === 'pro',
    isLoading: loading,
    isFree: accessTier === 'free'
  };
}; 