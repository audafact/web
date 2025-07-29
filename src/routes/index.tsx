import { createBrowserRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import Home from '../views/Home';
import Studio from '../views/Studio';
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