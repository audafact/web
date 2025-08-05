import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserAccess } from '../hooks/useUserAccess';
import { CheckCircle, XCircle, ArrowRight, Home } from 'lucide-react';

export const CheckoutResult: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { accessTier, loading } = useUserAccess();
  const [countdown, setCountdown] = useState(5);

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    if (success && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (success && countdown === 0) {
      navigate('/');
    }
  }, [success, countdown, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-audafact-accent-green bg-opacity-20 p-3 rounded-full">
                <CheckCircle className="h-12 w-12 text-audafact-accent-green" />
              </div>
            </div>
            <h1 className="text-3xl font-bold audafact-heading mb-4">
              Welcome to Pro Creator!
            </h1>
            <p className="text-lg audafact-text-secondary mb-8">
              Your subscription has been activated successfully. You now have access to all premium features.
            </p>
            
            {accessTier === 'pro' && (
              <div className="bg-audafact-accent-green bg-opacity-10 border border-audafact-accent-green border-opacity-20 rounded-lg p-4 mb-8">
                <p className="text-audafact-accent-green font-medium">
                  ✓ Pro access confirmed
                </p>
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={() => navigate('/')}
                className="audafact-button-primary w-full flex items-center justify-center px-6 py-3 text-base font-medium"
              >
                <ArrowRight className="h-5 w-5 mr-2" />
                Go to Studio
              </button>
              
              <p className="text-sm audafact-text-secondary">
                Redirecting automatically in {countdown} seconds...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (canceled) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-audafact-accent-cyan bg-opacity-20 p-3 rounded-full">
                <XCircle className="h-12 w-12 text-audafact-accent-cyan" />
              </div>
            </div>
            <h1 className="text-3xl font-bold audafact-heading mb-4">
              Checkout Canceled
            </h1>
            <p className="text-lg audafact-text-secondary mb-8">
              No worries! You can try again anytime. Your account remains unchanged.
            </p>
            
            <div className="space-y-4">
              <button
                onClick={() => navigate('/pricing')}
                className="audafact-button-primary w-full flex items-center justify-center px-6 py-3 text-base font-medium"
              >
                Try Again
              </button>
              
              <button
                onClick={() => navigate('/')}
                className="audafact-button-secondary w-full flex items-center justify-center px-6 py-3 text-base font-medium"
              >
                <Home className="h-5 w-5 mr-2" />
                Back to Studio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default case - redirect to studio
  useEffect(() => {
    navigate('/');
  }, [navigate]);

  return null;
}; 