import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

export const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from the URL hash/fragment
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          setError(error.message);
          setLoading(false);
          return;
        }

        if (data.session) {
          // Successfully authenticated, redirect to studio
          navigate('/studio', { replace: true });
        } else {
          // No session found, redirect back to auth page
          navigate('/auth', { replace: true });
        }
      } catch (err) {
        console.error('Unexpected error during auth callback:', err);
        setError('An unexpected error occurred');
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-audafact-surface-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-audafact-accent-cyan mx-auto mb-4"></div>
          <p className="audafact-text-secondary">Completing sign in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-audafact-surface-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-audafact-alert-red mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold audafact-heading mb-2">Sign In Failed</h2>
          <p className="audafact-text-secondary mb-4">{error}</p>
          <button
            onClick={() => navigate('/auth')}
            className="audafact-button-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}; 