import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { usePostSignupActions } from '../hooks/usePostSignupActions';
import { trackEvent } from '../services/analyticsService';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { SIGNUP_MODAL_CONFIGS } from '../config/signupModalConfigs';

const INTENT_EXPIRY_HOURS = 24;

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: string;
}

const SignupModal: React.FC<SignupModalProps> = ({
  isOpen,
  onClose,
  trigger,
}) => {
  const { signUp, signIn } = useAuth();
  const { cacheIntent } = usePostSignupActions();
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (isOpen) {
      setAuthMode('signup');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setCaptchaToken(null);
      setError(null);
      trackEvent('signup_modal_shown', {
        trigger,
        userTier: 'guest'
      });
    }
  }, [isOpen, trigger]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('authModalVisibilityChange', {
        detail: { isOpen }
      })
    );
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !turnstileSiteKey || !turnstileRef.current) {
      return;
    }

    turnstileRef.current.innerHTML = '';

    const widgetId = window.turnstile?.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => {
        setCaptchaToken(token);
      },
      'error-callback': () => {
        setCaptchaToken(null);
        setError('CAPTCHA verification failed. Please try again.');
      },
      'expired-callback': () => {
        setCaptchaToken(null);
      },
      'timeout-callback': () => {
        setCaptchaToken(null);
      }
    });

    return () => {
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [isOpen, turnstileSiteKey, authMode]);

  const handleClose = () => {
    trackEvent('signup_modal_dismissed', {
      trigger,
      userTier: 'guest'
    });
    onClose();
  };

  const handleGoogleSignInStart = () => {
    // Cache the intent if there's a trigger
    if (trigger) {
      cacheIntent({
        type: trigger as any,
        context: {},
        priority: 'high',
        expiresAt: Date.now() + (INTENT_EXPIRY_HOURS * 60 * 60 * 1000)
      });
    }
    
    trackEvent('signup_completed', {
      method: 'google',
      trigger,
      upgradeRequired: false
    });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (authMode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (authMode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    if (turnstileSiteKey && !captchaToken) {
      setError('Please complete the CAPTCHA verification');
      setIsLoading(false);
      return;
    }
    
    try {
      // Cache the intent if there's a trigger
      if (trigger) {
        cacheIntent({
          type: trigger as any,
          context: {},
          priority: 'high',
          expiresAt: Date.now() + (INTENT_EXPIRY_HOURS * 60 * 60 * 1000)
        });
      }
      
      const result =
        authMode === 'signup'
          ? await signUp(email, password, captchaToken || undefined)
          : await signIn(email, password, captchaToken || undefined);
      if (!result.success) {
        throw new Error(
          result.error || (authMode === 'signup' ? 'Email signup failed' : 'Email sign-in failed')
        );
      }
      trackEvent(authMode === 'signup' ? 'signup_completed' : 'signin_completed', {
        method: authMode === 'signup' ? 'email' : 'email_signin',
        trigger,
        upgradeRequired: false
      });
      
      if (authMode === 'signup') {
        onClose();
        window.location.href = `/auth/check-email?email=${encodeURIComponent(email)}`;
        return;
      }

      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : authMode === 'signup'
            ? 'Failed to sign up with email'
            : 'Failed to sign in with email'
      );
      trackEvent(authMode === 'signup' ? 'signup_error' : 'signin_error', {
        trigger,
        error: authMode === 'signup' ? 'email_signup_failed' : 'email_signin_failed'
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
      case 'custom_cue_points':
        return 'Set custom cue points';
      case 'add_second_source':
        return 'multiple tracks';
      case 'trigger_styles':
        return 'Hold and One-Shot trigger styles';
      default:
        return 'Access premium features';
    }
  };

  const triggerConfig = trigger ? SIGNUP_MODAL_CONFIGS[trigger] : undefined;
  const modalTitle = triggerConfig?.title ?? `Unlock ${getTriggerMessage()}`;
  const modalMessage =
    triggerConfig?.message ??
    'Sign up to access all features and start creating amazing music';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} containerClassName="z-[10010]">
      <div className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold audafact-heading mb-2">
            {modalTitle}
          </h2>
          <p className="audafact-text-secondary">
            {modalMessage}
          </p>
        </div>

        {error && (
          <div className="bg-audafact-alert-red text-audafact-text-primary p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-audafact-surface-2 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setError(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                authMode === 'signup'
                  ? 'bg-audafact-surface-1 audafact-text-primary'
                  : 'audafact-text-secondary hover:audafact-text-primary'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setError(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                authMode === 'signin'
                  ? 'bg-audafact-surface-1 audafact-text-primary'
                  : 'audafact-text-secondary hover:audafact-text-primary'
              }`}
            >
              Sign In
            </button>
          </div>

          <GoogleSignInButton onClick={handleGoogleSignInStart} />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-audafact-divider"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-audafact-surface-1 audafact-text-secondary">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-audafact-surface-2 border border-audafact-divider text-audafact-text-primary px-4 py-3 rounded-lg focus:outline-none focus:border-audafact-accent-cyan placeholder-audafact-text-secondary"
              required
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-audafact-surface-2 border border-audafact-divider text-audafact-text-primary px-4 py-3 pr-12 rounded-lg focus:outline-none focus:border-audafact-accent-cyan placeholder-audafact-text-secondary"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 audafact-text-secondary hover:audafact-text-primary"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {authMode === 'signup' && (
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-audafact-surface-2 border border-audafact-divider text-audafact-text-primary px-4 py-3 pr-12 rounded-lg focus:outline-none focus:border-audafact-accent-cyan placeholder-audafact-text-secondary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 audafact-text-secondary hover:audafact-text-primary"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}
            {turnstileSiteKey && (
              <div>
                <label className="block text-sm font-medium audafact-text-secondary mb-2">
                  Security Verification
                </label>
                <div ref={turnstileRef} className="flex justify-center" />
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full audafact-button-primary py-3 px-4 disabled:opacity-50"
            >
              {isLoading
                ? authMode === 'signup'
                  ? 'Creating account...'
                  : 'Signing in...'
                : authMode === 'signup'
                  ? 'Sign up with Email'
                  : 'Sign in with Email'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm audafact-text-secondary">
            {authMode === 'signup'
              ? 'By signing up, you agree to our Terms of Service and Privacy Policy'
              : 'By signing in, you agree to our Terms of Service and Privacy Policy'}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default SignupModal; 