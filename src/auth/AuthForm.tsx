import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from './GoogleSignInButton';

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

  const { signIn, signUp } = useAuth();

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

    try {
      const result = mode === 'signin' 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (result.success) {
        setMessage(mode === 'signin' ? 'Signed in successfully!' : 'Account created! Please check your email to verify your account.');
        if (onSuccess) {
          onSuccess();
        }
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
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-audafact-accent-cyan text-audafact-text-primary placeholder-audafact-text-secondary"
            placeholder="Enter your password"
            required
          />
        </div>

        {mode === 'signup' && (
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium audafact-text-secondary mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-audafact-accent-cyan text-audafact-text-primary placeholder-audafact-text-secondary"
              placeholder="Confirm your password"
              required
            />
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