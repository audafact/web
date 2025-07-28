import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const UserProfile = () => {
  const { user, updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const result = await updatePassword(newPassword);

      if (result.success) {
        setMessage('Password updated successfully!');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(result.error || 'An error occurred');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div>Please sign in to view your profile.</div>;
  }

  return (
    <div className="max-w-md mx-auto p-6 audafact-card-enhanced">
      <h2 className="text-2xl font-bold mb-6 text-center audafact-heading">User Profile</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium audafact-text-secondary mb-1">
            Email
          </label>
          <p className="audafact-text-primary">{user.email}</p>
        </div>

        <div>
          <label className="block text-sm font-medium audafact-text-secondary mb-1">
            User ID
          </label>
          <p className="audafact-text-primary text-sm font-mono">{user.id}</p>
        </div>

        <div>
          <label className="block text-sm font-medium audafact-text-secondary mb-1">
            Account Created
          </label>
          <p className="audafact-text-primary">
            {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>

        <hr className="my-6 border-audafact-divider" />

        <h3 className="text-lg font-semibold mb-4 audafact-heading">Update Password</h3>
        
        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium audafact-text-secondary mb-1">
              New Password
            </label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-audafact-accent-cyan text-audafact-text-primary placeholder-audafact-text-secondary"
              placeholder="Enter new password"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium audafact-text-secondary mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-audafact-accent-cyan text-audafact-text-primary placeholder-audafact-text-secondary"
              placeholder="Confirm new password"
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
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}; 