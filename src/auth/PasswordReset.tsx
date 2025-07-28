import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const PasswordReset = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { resetPassword } = useAuth();

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

    try {
      const result = await resetPassword(email);

      if (result.success) {
        setMessage('Password reset email sent! Please check your inbox.');
        setEmail('');
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