import { Navigate, createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import Layout from '../components/Layout';
import { TapTempoProvider } from '../context/TapTempoContext';
import { AuthPage } from '../auth/AuthPage';
import { AuthCallback } from '../auth/AuthCallback';
import { AuthVerification } from '../auth/AuthVerification';
import { CheckEmailPage } from '../auth/CheckEmailPage';
import {
  getAppEntryUrl,
  getHostExperience,
  SAME_HOST_STUDIO_PATH,
} from '../routing/hostRouting';

// Lazy load views for better performance
const Home = lazy(() => import('../views/Home'));
const Studio = lazy(() => import('../views/Studio'));
const StudioDemo = lazy(() => import('../views/StudioDemo'));
const Pricing = lazy(() => import('../views/Pricing').then(module => ({ default: module.Pricing })));
const CheckoutResult = lazy(() => import('../views/CheckoutResult').then(module => ({ default: module.CheckoutResult })));
const Profile = lazy(() => import('../views/Profile').then(module => ({ default: module.Profile })));
const Privacy = lazy(() => import('../views/Privacy').then(module => ({ default: module.Privacy })));
const Terms = lazy(() => import('../views/Terms'));
const Contact = lazy(() => import('../views/Contact'));
const AnalyticsPage = lazy(() => import('../views/AnalyticsPage'));
const NotFound = lazy(() => import('../views/NotFound'));

// Loading component for lazy routes
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-audafact-accent-cyan"></div>
  </div>
);

const RootRouteResolver = () => {
  const experience = getHostExperience();

  if (experience === 'app') {
    return (
      <TapTempoProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Studio />
        </Suspense>
      </TapTempoProvider>
    );
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Home />
    </Suspense>
  );
};

const normalizePathname = (pathname: string) => {
  const t = pathname.replace(/\/$/, '');
  return t === '' ? '/' : t;
};

/** /studio: app host uses root studio; marketing cross-origin redirects to app origin; same-host marketing renders Studio here. */
const StudioEntryRoute = () => {
  const experience = getHostExperience();

  if (experience === 'app') {
    return <Navigate to="/" replace />;
  }

  const entryUrl = getAppEntryUrl();
  let entry: URL;
  try {
    entry = new URL(entryUrl);
  } catch {
    return <LoadingSpinner />;
  }

  const cur = window.location;
  const sameOrigin = entry.origin === cur.origin;
  const sameEntry =
    sameOrigin &&
    normalizePathname(entry.pathname) === normalizePathname(cur.pathname);

  if (sameEntry) {
    return (
      <TapTempoProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Studio />
        </Suspense>
      </TapTempoProvider>
    );
  }

  return <RedirectToStudioEntry entryUrl={entryUrl} />;
};

const RedirectToStudioEntry = ({ entryUrl }: { entryUrl: string }) => {
  useEffect(() => {
    window.location.replace(entryUrl);
  }, [entryUrl]);
  return <LoadingSpinner />;
};

export const appRoutes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <RootRouteResolver />,
      },
      {
        path: 'studio',
        element: <StudioEntryRoute />,
      },
      {
        path: 'pricing',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Pricing />
          </Suspense>
        ),
      },
      {
        path: 'stash',
        element: <Navigate to={SAME_HOST_STUDIO_PATH} replace />,
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
        path: 'account',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Profile />
          </Suspense>
        ),
      },
      {
        path: 'profile',
        element: <Navigate to="/account" replace />,
      },
      {
        path: 'privacy',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Privacy />
          </Suspense>
        ),
      },
      {
        path: 'terms',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Terms />
          </Suspense>
        ),
      },
      {
        path: 'contact',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <Contact />
          </Suspense>
        ),
      },
      {
        path: 'demo',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <StudioDemo />
          </Suspense>
        ),
      },
      {
        path: 'admin/analytics',
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <AnalyticsPage />
          </Suspense>
        ),
      },
      // Blocked routes - redirect to 404
      // {
      //   path: 'studio',
      //   element: (
      //     <Suspense fallback={<LoadingSpinner />}>
      //       <NotFound />
      //     </Suspense>
      //   ),
      // },
      // {
      //   path: 'pricing',
      //   element: (
      //     <Suspense fallback={<LoadingSpinner />}>
      //       <NotFound />
      //     </Suspense>
      //   ),
      // },
      // {
      //   path: 'checkout-result',
      //   element: (
      //     <Suspense fallback={<LoadingSpinner />}>
      //       <NotFound />
      //     </Suspense>
      //   ),
      // },
      // {
      //   path: 'profile',
      //   element: (
      //     <Suspense fallback={<LoadingSpinner />}>
      //       <NotFound />
      //     </Suspense>
      //   ),
      // },
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
  {
    path: '/auth',
    element: <AuthPage />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallback />,
  },
  {
    path: '/auth/verify',
    element: <AuthVerification />,
  },
  {
    path: '/auth/check-email',
    element: <CheckEmailPage />,
  },
  // Blocked auth routes - redirect to 404
  // {
  //   path: '/auth',
  //   element: (
  //     <Suspense fallback={<LoadingSpinner />}>
  //       <NotFound />
  //     </Suspense>
  //   ),
  // },
  // {
  //   path: '/auth/callback',
  //   element: (
  //     <Suspense fallback={<LoadingSpinner />}>
  //       <NotFound />
  //     </Suspense>
  //   ),
  // },
  // {
  //   path: '/auth/verify',
  //   element: (
  //     <Suspense fallback={<LoadingSpinner />}>
  //       <NotFound />
  //     </Suspense>
  //   ),
  // },
  // {
  //   path: '/auth/check-email',
  //   element: (
  //     <Suspense fallback={<LoadingSpinner />}>
  //       <NotFound />
  //     </Suspense>
  //   ),
  // },
  // Global catch-all for any other routes
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingSpinner />}>
        <NotFound />
      </Suspense>
    ),
  },
];

export const router = createBrowserRouter(appRoutes);