import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from './GoogleSignInButton';
import { authService } from './authService';

interface AuthFormProps {
  mode: 'signin' | 'signup';
  onSuccess?: () => void;
}

export const AuthForm = ({ mode, onSuccess }: AuthFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | undefined>(undefined);
  const navigate = useNavigate();

  const { signIn, signUp } = useAuth();

  // Get Turnstile site key from environment variables
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Initialize Turnstile widget
  useEffect(() => {
    if (
      (mode === 'signup' || mode === 'signin') &&
      !mfaStep &&
      turnstileSiteKey &&
      turnstileRef.current
    ) {
      // Clear any existing widget
      turnstileRef.current.innerHTML = '';
      
      // Initialize Turnstile widget
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
      turnstileWidgetIdRef.current = widgetId;

      return () => {
        turnstileWidgetIdRef.current = undefined;
        if (widgetId && window.turnstile) {
          window.turnstile.remove(widgetId);
        }
      };
    }
  }, [mode, turnstileSiteKey, mfaStep]);

  const resetCaptchaChallenge = () => {
    setCaptchaToken(null);
    const widgetId = turnstileWidgetIdRef.current;
    if (widgetId && window.turnstile) {
      window.turnstile.reset(widgetId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // Validation
    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if ((mode === 'signup' || mode === 'signin') && !captchaToken) {
      setError('Please complete the CAPTCHA verification');
      setLoading(false);
      return;
    }

    try {
      const result = mode === 'signin' 
        ? await signIn(email, password, captchaToken || undefined)
        : await signUp(email, password, captchaToken || undefined);

      if (result.success) {
        if (mode === 'signin') {
          if (result.mfaRequired) {
            let factorId = result.mfaTotpFactorIds?.[0];
            if (!factorId) {
              const listed = await authService.listMfaFactors();
              if (listed.success && listed.totp?.length) {
                factorId = listed.totp.find((f) => f.status === 'verified')
                  ?.id;
              }
            }
            if (!factorId) {
              setError(
                'Two-factor sign-in is required, but no authenticator factor was found. Try again or contact support.'
              );
              setLoading(false);
              return;
            }
            setMfaFactorId(factorId);
            setMfaStep(true);
            setMfaCode('');
            resetCaptchaChallenge();
            setLoading(false);
            return;
          }
          setMessage('Signed in successfully!');
          if (onSuccess) {
            onSuccess();
          }
        } else {
          // For signup, redirect to check email page
          navigate('/auth/check-email', { 
            state: { email },
            replace: true 
          });
        }
      } else {
        setError(result.error || 'An error occurred');
        resetCaptchaChallenge();
      }
    } catch (err) {
      setError('An unexpected error occurred');
      resetCaptchaChallenge();
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || !mfaCode.trim()) {
      setError('Enter the code from your authenticator app');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await authService.verifyMfaLogin(
        mfaFactorId,
        mfaCode.trim()
      );
      if (result.success) {
        setMessage('Signed in successfully!');
        setMfaStep(false);
        setMfaFactorId(null);
        setMfaCode('');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(result.error || 'Invalid code');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaCancel = async () => {
    setLoading(true);
    await authService.signOut();
    setMfaStep(false);
    setMfaFactorId(null);
    setMfaCode('');
    setError('');
    setMessage('');
    setLoading(false);
  };

  if (mode === 'signin' && mfaStep && mfaFactorId) {
    return (
      <div className="max-w-md mx-auto p-6 audafact-card-enhanced">
        <h2 className="text-2xl font-bold mb-2 text-center audafact-heading">
          Two-factor authentication
        </h2>
        <p className="text-sm text-center audafact-text-secondary mb-6">
          Enter the 6-digit code from your authenticator app.
        </p>
        <form onSubmit={handleMfaSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="mfaCode"
              className="block text-sm font-medium audafact-text-secondary mb-1"
            >
              Authentication code
            </label>
            <input
              type="text"
              id="mfaCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, ''))}
              className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-audafact-accent-cyan text-audafact-text-primary"
              placeholder="000000"
              maxLength={12}
              required
              autoFocus
            />
          </div>
          {error && (
            <div className="text-audafact-alert-red text-sm bg-audafact-surface-2 border border-audafact-alert-red p-3 rounded-lg">
              {error}
            </div>
          )}
          {message && (
            <div className="text-audafact-accent-green text-sm bg-audafact-surface-2 border border-audafact-accent-green p-3 rounded-lg">
              {message}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || mfaCode.trim().length < 6}
            className="w-full audafact-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying…' : 'Verify and sign in'}
          </button>
          <button
            type="button"
            onClick={() => void handleMfaCancel()}
            disabled={loading}
            className="w-full text-sm audafact-text-secondary hover:text-audafact-heading py-2"
          >
            Cancel and use a different account
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 audafact-card-enhanced">
      <h2 className="text-2xl font-bold mb-6 text-center audafact-heading">
        {mode === 'signin' ? 'Sign In' : 'Sign Up'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium audafact-text-secondary mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-audafact-accent-cyan text-audafact-text-primary placeholder-audafact-text-secondary"
            placeholder="Enter your email"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium audafact-text-secondary mb-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 pr-11 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-audafact-accent-cyan text-audafact-text-primary placeholder-audafact-text-secondary"
              placeholder="Enter your password"
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
        </div>

        {mode === 'signup' && (
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium audafact-text-secondary mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-11 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-audafact-accent-cyan text-audafact-text-primary placeholder-audafact-text-secondary"
                placeholder="Confirm your password"
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
          </div>
        )}

        {(mode === 'signup' || mode === 'signin') && turnstileSiteKey && (
          <div>
            <label className="block text-sm font-medium audafact-text-secondary mb-2">
              Security Verification
            </label>
            <div ref={turnstileRef} className="flex justify-center"></div>
          </div>
        )}

        {error && (
          <div className="text-audafact-alert-red text-sm bg-audafact-surface-2 border border-audafact-alert-red p-3 rounded-lg">
            {error}
          </div>
        )}

        {message && (
          <div className="text-audafact-accent-green text-sm bg-audafact-surface-2 border border-audafact-accent-green p-3 rounded-lg">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full audafact-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-audafact-divider"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-audafact-surface-1-enhanced text-audafact-text-secondary">or</span>
        </div>
      </div>

      {/* Google Sign In */}
      <GoogleSignInButton onSuccess={onSuccess} />
    </div>
  );
}; 