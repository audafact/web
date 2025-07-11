import { createBrowserRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import Home from '../views/Home';
import Studio from '../views/Studio';
// import Login from '../views/Login';

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
        // path: 'login',
        // element: <Login />,
      },
    ],
  },
]); 