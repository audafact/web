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
    <nav className="sticky top-0 bg-audafact-surface-1 border-b border-audafact-divider shadow-card z-50">
      <div className="w-full px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side: Hamburger menu and Logo/Brand */}
          <div className="flex items-center gap-4">
            {/* Hamburger Menu Button */}
            <button
              onClick={toggleSidePanel}
              className="p-2 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded-lg transition-colors duration-200"
              aria-label="Toggle sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <Link to="/" className="flex items-center gap-2">
              {/* Favicon */}
              <img 
                src="/favicon.svg" 
                alt="Audafact Logo" 
                className="w-8 h-8"
              />
              <span className="text-xl font-poppins font-bold">Audafact</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex space-x-8">
            <Link 
              to="/" 
              className={`font-medium transition-colors duration-200 ${
                location.pathname === '/' 
                  ? 'text-audafact-accent-cyan' 
                  : 'text-audafact-text-secondary hover:text-audafact-text-primary'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/studio" 
              className={`font-medium transition-colors duration-200 ${
                location.pathname === '/studio' 
                  ? 'text-audafact-accent-cyan' 
                  : 'text-audafact-text-secondary hover:text-audafact-text-primary'
              }`}
            >
              Studio
            </Link>
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {!loading && (
              user ? (
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="text-audafact-text-secondary hover:text-audafact-text-primary transition-colors duration-200"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/login"
                  className="audafact-button-primary"
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