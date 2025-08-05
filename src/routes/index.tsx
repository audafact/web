import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from '../components/Layout';
import { AuthPage } from '../auth/AuthPage';
import { AuthCallback } from '../auth/AuthCallback';
import { ProtectedRoute } from '../auth/ProtectedRoute';

// Lazy load views for better performance
const Home = lazy(() => import('../views/Home'));
const Studio = lazy(() => import('../views/Studio'));
const Pricing = lazy(() => import('../views/Pricing').then(module => ({ default: module.Pricing })));
const CheckoutResult = lazy(() => import('../views/CheckoutResult').then(module => ({ default: module.CheckoutResult })));
const Profile = lazy(() => import('../views/Profile').then(module => ({ default: module.Profile })));

// Loading component for lazy routes
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-audafact-accent-cyan"></div>
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Home />
          </Suspense>
        ),
      },
      {
        path: 'studio',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Studio />
          </Suspense>
        ),
      },
      {
        path: 'pricing',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <ProtectedRoute>
              <Pricing />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: 'checkout-result',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <CheckoutResult />
          </Suspense>
        ),
      },
      {
        path: 'profile',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Profile />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '/auth',
    element: <AuthPage />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallback />,
  },
]); 