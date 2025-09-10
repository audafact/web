import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export const PasswordReset = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  const { resetPassword } = useAuth();

  // Get Turnstile site key from environment variables
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // Initialize Turnstile widget
  useEffect(() => {
    if (turnstileSiteKey && turnstileRef.current) {
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

      return () => {
        if (widgetId && window.turnstile) {
          window.turnstile.remove(widgetId);
        }
      };
    }
  }, [turnstileSiteKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    if (!captchaToken) {
      setError('Please complete the CAPTCHA verification');
      setLoading(false);
      return;
    }

    try {
      const result = await resetPassword(email, captchaToken);

      if (result.success) {
        setMessage('Password reset email sent! Please check your inbox.');
        setEmail('');
        setCaptchaToken(null);
      } else {
        setError(result.error || 'An error occurred');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 audafact-card-enhanced">
      <h2 className="text-2xl font-bold mb-6 text-center audafact-heading">Reset Password</h2>
      
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

        {turnstileSiteKey && (
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
          {loading ? 'Sending...' : 'Send Reset Email'}
        </button>
      </form>
    </div>
  );
}; 