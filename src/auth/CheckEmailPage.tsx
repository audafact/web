import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

export const CheckEmailPage = () => {
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get email from location state or URL params
  const email = location.state?.email || new URLSearchParams(location.search).get('email') || '';

  const handleResendEmail = async () => {
    if (!email) {
      setResendMessage('Email address not found. Please try signing up again.');
      return;
    }

    setResending(true);
    setResendMessage('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setResendMessage('Failed to resend email. Please try again.');
      } else {
        setResendMessage('Verification email sent! Please check your inbox.');
      }
    } catch (err) {
      setResendMessage('An error occurred. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleBackToSignIn = () => {
    navigate('/auth');
  };

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
          
          {/* Email Icon */}
          <div className="text-audafact-accent-cyan mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-extrabold audafact-heading mb-2">
            Check Your Email
          </h1>
          <p className="text-lg audafact-text-secondary mb-6">
            We've sent a verification link to
          </p>
          {email && (
            <p className="text-lg font-medium audafact-text-primary mb-6 bg-audafact-surface-2 px-4 py-2 rounded-lg">
              {email}
            </p>
          )}
          <p className="audafact-text-secondary mb-8">
            Click the link in the email to verify your account and complete your registration.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleResendEmail}
            disabled={resending || !email}
            className="w-full audafact-button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resending ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <button
            onClick={handleBackToSignIn}
            className="w-full audafact-button-primary"
          >
            Back to Sign In
          </button>
        </div>

        {/* Resend Message */}
        {resendMessage && (
          <div className={`p-3 rounded-lg text-sm ${
            resendMessage.includes('sent') 
              ? 'bg-audafact-accent-green/10 border border-audafact-accent-green text-audafact-accent-green'
              : 'bg-audafact-alert-red/10 border border-audafact-alert-red text-audafact-alert-red'
          }`}>
            {resendMessage}
          </div>
        )}

        {/* Help Text */}
        <div className="text-center">
          <p className="text-sm audafact-text-secondary">
            Didn't receive the email? Check your spam folder or try resending.
          </p>
        </div>
      </div>
    </div>
  );
};
