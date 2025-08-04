import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../services/analyticsService';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: string;
  action?: string;
}

const SignupModal: React.FC<SignupModalProps> = ({
  isOpen,
  onClose,
  trigger,
  action
}) => {
  const { signInWithGoogle, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      trackEvent('signup_modal_shown', {
        trigger,
        userTier: 'guest'
      });
    }
  }, [isOpen, trigger]);

  const handleClose = () => {
    trackEvent('signup_modal_dismissed', {
      trigger,
      userTier: 'guest'
    });
    onClose();
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await signInWithGoogle();
      trackEvent('signup_completed', {
        method: 'google',
        trigger,
        upgradeRequired: false
      });
      onClose();
    } catch (error) {
      setError('Failed to sign in with Google');
      trackEvent('signup_error', {
        trigger,
        error: 'google_signin_failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      await signIn(email, password);
      trackEvent('signup_completed', {
        method: 'email',
        trigger,
        upgradeRequired: false
      });
      onClose();
    } catch (error) {
      setError('Failed to sign in with email');
      trackEvent('signup_error', {
        trigger,
        error: 'email_signin_failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTriggerMessage = () => {
    switch (trigger) {
      case 'add_library_track':
        return 'Add tracks to your studio';
      case 'save_session':
        return 'Save your session';
      case 'upload':
        return 'Upload your own tracks';
      case 'record':
        return 'Record your performance';
      case 'download':
        return 'Download your tracks';
      default:
        return 'Access premium features';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold audafact-heading mb-2">
            Unlock {getTriggerMessage()}
          </h2>
          <p className="audafact-text-secondary">
            Sign up to access all features and start creating amazing music
          </p>
        </div>

        {error && (
          <div className="bg-audafact-alert-red text-audafact-text-primary p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full bg-audafact-surface-2 text-audafact-text-primary py-3 px-4 rounded-lg font-medium hover:bg-audafact-divider transition-colors disabled:opacity-50 border border-audafact-divider"
          >
            {isLoading ? 'Signing in...' : 'Continue with Google'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-audafact-divider"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-audafact-surface-1 audafact-text-secondary">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-audafact-surface-2 border border-audafact-divider text-audafact-text-primary px-4 py-3 rounded-lg focus:outline-none focus:border-audafact-accent-cyan placeholder-audafact-text-secondary"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-audafact-surface-2 border border-audafact-divider text-audafact-text-primary px-4 py-3 rounded-lg focus:outline-none focus:border-audafact-accent-cyan placeholder-audafact-text-secondary"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full audafact-button-primary py-3 px-4 disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign up with Email'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm audafact-text-secondary">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default SignupModal; 