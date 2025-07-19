import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSidePanel } from '../context/SidePanelContext';
import { supabase } from '../services/supabase';

const Navbar = () => {
  const { user, loading } = useAuth();
  const { toggleSidePanel } = useSidePanel();
  const location = useLocation();
  const isStudioPage = location.pathname === '/studio';

  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Left side: Hamburger menu and Logo/Brand */}
          <div className="flex items-center gap-4">
            {/* Hamburger Menu Button */}
            <button
              onClick={toggleSidePanel}
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <Link to="/" className="flex items-center">
              <span className="text-xl font-bold text-indigo-600">TrackStitch</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex space-x-8">
            <Link to="/" className="text-gray-600 hover:text-indigo-600">
              Home
            </Link>
            <Link to="/studio" className="text-gray-600 hover:text-indigo-600">
              Studio
            </Link>
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {!loading && (
              user ? (
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="text-gray-600 hover:text-indigo-600"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/login"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                >
                  Sign In
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 