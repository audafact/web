import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

export const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check if we have authentication data in the hash
        if (window.location.hash && window.location.hash.includes('access_token')) {
          // Parse the hash to extract the access token
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken) {
            // Set the session manually with the tokens from the hash
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            if (error) {
              setError(error.message);
              setLoading(false);
              return;
            }

            if (data.session?.user) {
              navigate('/studio', { replace: true });
              return;
            }
          }
        }
        
        // If no hash with access token, wait a moment and check for session
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if we have a session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        if (session?.user) {
          navigate('/studio', { replace: true });
        } else {
          // Check for error parameters in URL
          const errorParam = searchParams.get('error');
          const errorDescription = searchParams.get('error_description');
          
          if (errorParam) {
            setError(`Authentication failed: ${errorDescription || errorParam}`);
            setLoading(false);
            return;
          }
          
          navigate('/auth', { replace: true });
        }
      } catch (err) {
        setError('An unexpected error occurred');
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

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