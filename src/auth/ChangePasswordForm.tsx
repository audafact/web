import React, { useState } from "react";
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const MIN_LENGTH = 6;

export const ChangePasswordForm: React.FC<{ onSuccessMessage?: string }> = ({
  onSuccessMessage = "Password updated successfully.",
}) => {
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (newPassword.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters long`);
      setLoading(false);
      return;
    }

    try {
      const result = await updatePassword(newPassword);

      if (result.success) {
        setMessage(onSuccessMessage);
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(result.error || "An error occurred");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="profile-new-password"
          className="block text-sm font-medium audafact-text-secondary mb-1"
        >
          New password
        </label>
        <div className="relative">
          <input
            type={showNewPassword ? 'text' : 'password'}
            id="profile-new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 pr-11 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-audafact-accent-cyan text-audafact-text-primary placeholder-audafact-text-secondary"
            placeholder="Enter new password"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(prev => !prev)}
            className="absolute inset-y-0 right-0 flex items-center px-3 audafact-text-secondary hover:audafact-text-primary"
            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
          >
            {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="profile-confirm-password"
          className="block text-sm font-medium audafact-text-secondary mb-1"
        >
          Confirm new password
        </label>
        <div className="relative">
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            id="profile-confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 pr-11 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan focus:border-audafact-accent-cyan text-audafact-text-primary placeholder-audafact-text-secondary"
            placeholder="Confirm new password"
            autoComplete="new-password"
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
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
};

export const OAuthPasswordHint: React.FC = () => (
  <div className="space-y-3 text-sm audafact-text-secondary">
    <p>
      Your account does not use an email password (for example, you may have
      signed in with Google).
    </p>
    <p>
      To set a password so you can sign in with email, open{" "}
      <Link to="/auth" className="text-audafact-accent-blue hover:text-opacity-80 font-medium">
        Sign in
      </Link>
      , choose <strong className="audafact-text-primary">Reset</strong>, and
      send a link to your email.
    </p>
  </div>
);
