import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useDemo } from '../context/DemoContext';

export const EmailVerification = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loadRandomDemoTrack } = useDemo();

  useEffect(() => {
    const handleEmailVerification = async () => {
      try {
        // Check if we have verification data in the hash or search params
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');

        // If we have tokens from email verification
        if (accessToken && type === 'signup') {
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
            setIsVerified(true);
            setLoading(false);
            return;
          }
        }

        // If no hash with access token, check for session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        if (session?.user) {
          // Check if this is a new user (email_verified_at is recent)
          const user = session.user;
          const emailVerifiedAt = user.email_confirmed_at;
          const now = new Date();
          const verifiedAt = emailVerifiedAt ? new Date(emailVerifiedAt) : null;
          
          // If verified within the last 10 minutes, consider it a fresh verification
          if (verifiedAt && (now.getTime() - verifiedAt.getTime()) < 10 * 60 * 1000) {
            setIsVerified(true);
          } else {
            // User is already verified, redirect to studio
            navigate('/studio', { replace: true });
            return;
          }
        } else {
          // No session, redirect to auth
          navigate('/auth', { replace: true });
          return;
        }
        
        setLoading(false);
      } catch (err) {
        setError('An unexpected error occurred during email verification');
        setLoading(false);
      }
    };

    handleEmailVerification();
  }, [navigate, searchParams]);

  const handleStartDemo = () => {
    // Load a demo track and navigate to studio
    loadRandomDemoTrack();
    navigate('/studio?demo=true', { replace: true });
  };

  const handleStartCreating = () => {
    // Navigate directly to studio without demo
    navigate('/studio', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-audafact-surface-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-audafact-accent-cyan mx-auto mb-4"></div>
          <p className="audafact-text-secondary">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-audafact-surface-1 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-audafact-alert-red mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold audafact-heading mb-2">Verification Failed</h2>
          <p className="audafact-text-secondary mb-4">{error}</p>
          <button
            onClick={() => navigate('/auth')}
            className="audafact-button-primary"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="min-h-screen bg-audafact-surface-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/favicon.svg" 
                alt="Audafact Logo" 
                className="w-12 h-12"
              />
            </div>
            
            {/* Success Icon */}
            <div className="text-audafact-accent-cyan mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h1 className="text-3xl font-extrabold audafact-heading mb-2">
              Email Verified!
            </h1>
            <p className="text-lg audafact-text-secondary mb-6">
              Welcome to Audafact! Your account has been successfully created and verified.
            </p>
          </div>

          {/* Action Cards */}
          <div className="space-y-4">
            {/* Demo Option */}
            <div className="audafact-card-enhanced p-6 border-2 border-audafact-accent-cyan/20 hover:border-audafact-accent-cyan/40 transition-colors duration-200">
              <div className="text-center">
                <div className="text-audafact-accent-cyan mb-3">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold audafact-heading mb-2">
                  Try the Demo
                </h3>
                <p className="audafact-text-secondary mb-4 text-sm">
                  Experience Audafact with our demo tracks to see what you can create
                </p>
                <button
                  onClick={handleStartDemo}
                  className="w-full audafact-button-primary"
                >
                  Start Demo
                </button>
              </div>
            </div>

            {/* Direct Creation Option */}
            <div className="audafact-card p-6 hover:bg-audafact-surface-1-enhanced transition-colors duration-200">
              <div className="text-center">
                <div className="text-audafact-accent-blue mb-3">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold audafact-heading mb-2">
                  Start Creating
                </h3>
                <p className="audafact-text-secondary mb-4 text-sm">
                  Jump straight into the studio and start working with your own tracks
                </p>
                <button
                  onClick={handleStartCreating}
                  className="w-full audafact-button-secondary"
                >
                  Go to Studio
                </button>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="text-center">
            <p className="text-xs audafact-text-secondary">
              You can always access the demo from the studio menu
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

