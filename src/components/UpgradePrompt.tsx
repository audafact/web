import React from 'react';
import { Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradePromptProps {
  message: string;
  feature: string;
  onClose?: () => void;
  variant?: 'modal' | 'inline' | 'banner';
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  message,
  feature,
  onClose,
  variant = 'modal'
}) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    navigate('/pricing');
    onClose?.();
  };

  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-blue p-4 rounded-lg mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Crown className="h-5 w-5 text-audafact-text-primary" />
            <div>
              <p className="text-sm font-medium text-audafact-text-primary">
                {feature} requires Pro Creator
              </p>
              <p className="text-xs text-audafact-text-primary opacity-90">
                {message}
              </p>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            className="bg-audafact-text-primary text-audafact-accent-cyan px-4 py-2 rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors flex items-center space-x-2"
          >
            <span>Upgrade</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="audafact-card p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-gradient-to-br from-audafact-accent-cyan to-audafact-accent-blue p-3 rounded-full">
            <Crown className="h-6 w-6 text-audafact-text-primary" />
          </div>
        </div>
        <h3 className="text-lg font-semibold audafact-heading mb-2">
          {feature} - Pro Feature
        </h3>
        <p className="audafact-text-secondary mb-4">
          {message}
        </p>
        <button
          onClick={handleUpgrade}
          className="audafact-button-primary"
        >
          Upgrade to Pro Creator
        </button>
      </div>
    );
  }

  // Modal variant
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="audafact-card-enhanced p-6 max-w-md w-full">
        <div className="flex justify-center mb-4">
          <div className="bg-gradient-to-br from-audafact-accent-cyan to-audafact-accent-blue p-3 rounded-full">
            <Crown className="h-8 w-8 text-audafact-text-primary" />
          </div>
        </div>
        
        <h2 className="text-xl font-bold audafact-heading text-center mb-2">
          Upgrade Required
        </h2>
        
        <h3 className="text-lg font-semibold audafact-text-secondary text-center mb-4">
          {feature}
        </h3>
        
        <p className="audafact-text-secondary text-center mb-6">
          {message}
        </p>
        
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="audafact-button-secondary flex-1"
          >
            Maybe Later
          </button>
          <button
            onClick={handleUpgrade}
            className="audafact-button-primary flex-1"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
};