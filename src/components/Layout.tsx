import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => {
  return (
    <div className="min-h-screen bg-audafact-surface-1">
      <Navbar />
      <main className="container mx-auto px-4 py-0">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout; 