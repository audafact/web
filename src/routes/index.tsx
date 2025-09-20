import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from '../components/Layout';
import { AuthPage } from '../auth/AuthPage';
import { AuthCallback } from '../auth/AuthCallback';
import { AuthVerification } from '../auth/AuthVerification';
import { CheckEmailPage } from '../auth/CheckEmailPage';
import { ProtectedRoute } from '../auth/ProtectedRoute';

// Lazy load views for better performance
const Home = lazy(() => import('../views/Home'));
const Studio = lazy(() => import('../views/Studio'));
const Pricing = lazy(() => import('../views/Pricing').then(module => ({ default: module.Pricing })));
const CheckoutResult = lazy(() => import('../views/CheckoutResult').then(module => ({ default: module.CheckoutResult })));
const Profile = lazy(() => import('../views/Profile').then(module => ({ default: module.Profile })));
const Privacy = lazy(() => import('../views/Privacy').then(module => ({ default: module.Privacy })));
const NotFound = lazy(() => import('../views/NotFound'));

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
      // {
      //   path: 'studio',
      //   element: (
      //     <Suspense fallback={<LoadingSpinner />}>
      //       <Studio />
      //     </Suspense>
      //   ),
      // },
      // {
      //   path: 'pricing',
      //   element: (
      //     <Suspense fallback={<LoadingSpinner />}>
      //       <Pricing />
      //     </Suspense>
      //   ),
      // },
      // {
      //   path: 'checkout-result',
      //   element: (
      //     <Suspense fallback={<LoadingSpinner />}>
      //       <CheckoutResult />
      //     </Suspense>
      //   ),
      // },
      // {
      //   path: 'profile',
      //   element: (
      //     <Suspense fallback={<LoadingSpinner />}>
      //       <Profile />
      //     </Suspense>
      //   ),
      // },
      {
        path: 'privacy',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Privacy />
          </Suspense>
        ),
      },
      // Blocked routes - redirect to 404
      {
        path: 'studio',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <NotFound />
          </Suspense>
        ),
      },
      {
        path: 'pricing',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <NotFound />
          </Suspense>
        ),
      },
      {
        path: 'checkout-result',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <NotFound />
          </Suspense>
        ),
      },
      {
        path: 'profile',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <NotFound />
          </Suspense>
        ),
      },
      // Catch-all 404 route
      {
        path: '*',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <NotFound />
          </Suspense>
        ),
      },
    ],
  },
  // {
  //   path: '/auth',
  //   element: <AuthPage />,
  // },
  // {
  //   path: '/auth/callback',
  //   element: <AuthCallback />,
  // },
  // {
  //   path: '/auth/verify',
  //   element: <AuthVerification />,
  // },
  // {
  //   path: '/auth/check-email',
  //   element: <CheckEmailPage />,
  // },
  // Blocked auth routes - redirect to 404
  {
    path: '/auth',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <NotFound />
      </Suspense>
    ),
  },
  {
    path: '/auth/callback',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <NotFound />
      </Suspense>
    ),
  },
  {
    path: '/auth/verify',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <NotFound />
      </Suspense>
    ),
  },
  {
    path: '/auth/check-email',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <NotFound />
      </Suspense>
    ),
  },
  // Global catch-all for any other routes
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <NotFound />
      </Suspense>
    ),
  },
]); 