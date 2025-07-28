import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthPage } from './AuthPage';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export const ProtectedRoute = ({ children, requireAuth = true }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-audafact-bg-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-audafact-accent-cyan"></div>
      </div>
    );
  }

  // If authentication is required and user is not authenticated, show auth page
  if (requireAuth && !user) {
    return <AuthPage />;
  }

  // If user is authenticated and trying to access auth page, redirect to home
  if (!requireAuth && user) {
    window.location.href = '/';
    return null;
  }

  // Render the protected content
  return <>{children}</>;
}; 