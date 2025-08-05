import { useState } from 'react';
import { AuthForm } from './AuthForm';
import { PasswordReset } from './PasswordReset';

type AuthMode = 'signin' | 'signup' | 'reset';

export const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>('signin');

  const handleAuthSuccess = () => {
    // Redirect to studio page
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-audafact-surface-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-4">
            <img 
              src="/favicon.svg" 
              alt="Audafact Logo" 
              className="w-12 h-12"
            />
          </div>
          <h1 className="text-center text-3xl font-extrabold audafact-heading">
            Welcome to Audafact
          </h1>
          <p className="mt-2 text-center text-sm audafact-text-secondary">
            Your music production companion
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-lg shadow-sm">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-l-lg border ${
              mode === 'signin'
                ? 'bg-audafact-accent-blue text-audafact-text-primary border-audafact-accent-blue'
                : 'bg-audafact-surface-2 text-audafact-text-secondary border-audafact-divider hover:bg-audafact-surface-1-enhanced hover:text-audafact-text-primary'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 px-4 text-sm font-medium border-t border-b border-audafact-divider ${
              mode === 'signup'
                ? 'bg-audafact-accent-blue text-audafact-text-primary border-audafact-accent-blue'
                : 'bg-audafact-surface-2 text-audafact-text-secondary border-audafact-divider hover:bg-audafact-surface-1-enhanced hover:text-audafact-text-primary'
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => setMode('reset')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-r-lg border ${
              mode === 'reset'
                ? 'bg-audafact-accent-blue text-audafact-text-primary border-audafact-accent-blue'
                : 'bg-audafact-surface-2 text-audafact-text-secondary border-audafact-divider hover:bg-audafact-surface-1-enhanced hover:text-audafact-text-primary'
            }`}
          >
            Reset
          </button>
        </div>

        {/* Auth Content */}
        <div className="mt-8">
          {mode === 'reset' ? (
            <PasswordReset />
          ) : (
            <AuthForm 
              mode={mode} 
              onSuccess={handleAuthSuccess}
            />
          )}
        </div>

        {/* Additional Links */}
        <div className="text-center">
          {mode === 'signin' && (
            <div className="text-sm">
              <span className="audafact-text-secondary">Don't have an account? </span>
              <button
                onClick={() => setMode('signup')}
                className="text-audafact-accent-cyan hover:text-audafact-accent-blue font-medium transition-colors duration-200"
              >
                Sign up
              </button>
            </div>
          )}
          {mode === 'signup' && (
            <div className="text-sm">
              <span className="audafact-text-secondary">Already have an account? </span>
              <button
                onClick={() => setMode('signin')}
                className="text-audafact-accent-cyan hover:text-audafact-accent-blue font-medium transition-colors duration-200"
              >
                Sign in
              </button>
            </div>
          )}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="mt-2 text-sm">
              <button
                onClick={() => setMode('reset')}
                className="text-audafact-accent-cyan hover:text-audafact-accent-blue font-medium transition-colors duration-200"
              >
                Forgot your password?
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 