import { createBrowserRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import Home from '../views/Home';
import Studio from '../views/Studio';
import { Pricing } from '../views/Pricing';
import { CheckoutResult } from '../views/CheckoutResult';
import { Profile } from '../views/Profile';
import { AuthPage } from '../auth/AuthPage';
import { AuthCallback } from '../auth/AuthCallback';
import { ProtectedRoute } from '../auth/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'studio',
        element: <Studio />,
      },
      {
        path: 'pricing',
        element: <Pricing />,
      },
      {
        path: 'checkout-result',
        element: <CheckoutResult />,
      },
      {
        path: 'profile',
        element: <Profile />,
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