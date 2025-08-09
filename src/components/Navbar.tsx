import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSidePanel } from '../context/SidePanelContext';
import { useState } from 'react';
import { PerformanceDashboard } from './PerformanceDashboard';

const Navbar = () => {
  const { user, loading, signOut } = useAuth();
  const { isOpen: isSidePanelOpen, toggleSidePanel } = useSidePanel();
  const location = useLocation();
  const isStudioPage = location.pathname === '/studio';
  const [showPerformanceDashboard, setShowPerformanceDashboard] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 bg-audafact-surface-1 border-b border-audafact-divider shadow-card z-50">
      <div className="w-full px-4 md:px-8">
        <div className="flex items-center h-14 md:h-16 relative">
          {/* Left side: Hamburger menu and Logo/Brand */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Hamburger Menu Button - Show on studio page for all users */}
            {isStudioPage && (
              <button
                onClick={toggleSidePanel}
                className="p-2 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded-lg transition-colors duration-200"
                aria-label={isSidePanelOpen ? 'Close sidebar' : 'Open sidebar'}
                data-testid="side-panel-toggle"
              >
                {isSidePanelOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            )}
            

            
            <Link to="/" className="flex items-center gap-2">
              {/* Favicon */}
              <img 
                src="/favicon.svg" 
                alt="Audafact Logo" 
                className="w-7 h-7 md:w-8 md:h-8"
              />
              <span className="text-lg md:text-xl font-poppins font-bold">Audafact</span>
            </Link>
          </div>

          {/* Navigation Links - Absolutely Centered (show on lg+ to avoid overlap on tablet portrait) */}
          <div className="hidden lg:flex space-x-8 absolute left-1/2 transform -translate-x-1/2">
            {!user && (
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
            )}
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
            <Link 
              to="/pricing" 
              className={`font-medium transition-colors duration-200 ${
                location.pathname === '/pricing' 
                  ? 'text-audafact-accent-cyan' 
                  : 'text-audafact-text-secondary hover:text-audafact-text-primary'
              }`}
            >
              Pricing
            </Link>
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-2 md:space-x-4 ml-auto">
            {/* Performance Dashboard Button - Only show in development */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => setShowPerformanceDashboard(true)}
                className="p-2 text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 rounded-lg transition-colors duration-200"
                aria-label="Performance Dashboard"
                title="Performance Dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            )}
            
            {!loading && (
              user ? (
                <div className="flex items-center space-x-2 md:space-x-4">
                  <Link
                    to="/profile"
                    className="hidden sm:inline text-audafact-text-secondary hover:text-audafact-text-primary transition-colors duration-200 text-sm"
                  >
                    Profile
                  </Link>
                  <span className="hidden md:inline text-audafact-text-secondary text-sm">
                    {user.email}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-audafact-text-secondary hover:text-audafact-text-primary transition-colors duration-200"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="audafact-button-primary px-3 py-1.5 md:px-4 md:py-2"
                >
                  Sign In
                </Link>
              )
            )}

            {/* Mobile menu toggle (shown on < lg) */}
            <button
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-lg lg:hidden text-audafact-text-secondary hover:text-audafact-accent-cyan hover:bg-audafact-surface-2 transition-colors duration-200"
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      <div
        id="mobile-nav"
        className={`${isMobileMenuOpen ? 'block' : 'hidden'} lg:hidden border-t border-audafact-divider bg-audafact-surface-1`}
      >
        <div className="px-4 py-3 space-y-2">
          {!user && (
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-2 py-2 rounded-lg transition-colors duration-200 ${
                location.pathname === '/'
                  ? 'text-audafact-accent-cyan bg-audafact-surface-2'
                  : 'text-audafact-text-secondary hover:text-audafact-text-primary hover:bg-audafact-surface-2'
              }`}
            >
              Home
            </Link>
          )}
          <Link
            to="/studio"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block px-2 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/studio'
                ? 'text-audafact-accent-cyan bg-audafact-surface-2'
                : 'text-audafact-text-secondary hover:text-audafact-text-primary hover:bg-audafact-surface-2'
            }`}
          >
            Studio
          </Link>
          <Link
            to="/pricing"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`block px-2 py-2 rounded-lg transition-colors duration-200 ${
              location.pathname === '/pricing'
                ? 'text-audafact-accent-cyan bg-audafact-surface-2'
                : 'text-audafact-text-secondary hover:text-audafact-text-primary hover:bg-audafact-surface-2'
            }`}
          >
            Pricing
          </Link>

          {/* Account section */}
          {!loading && (
            user ? (
              <div className="pt-2 mt-2 border-t border-audafact-divider">
                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-2 py-2 rounded-lg text-audafact-text-secondary hover:text-audafact-text-primary hover:bg-audafact-surface-2 transition-colors duration-200"
                >
                  Profile
                </Link>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); signOut(); }}
                  className="w-full text-left px-2 py-2 rounded-lg text-audafact-text-secondary hover:text-audafact-text-primary hover:bg-audafact-surface-2 transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="pt-2 mt-2 border-t border-audafact-divider">
                <Link
                  to="/auth"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-2 py-2 rounded-lg bg-audafact-accent-blue text-audafact-text-primary text-center font-medium hover:bg-opacity-90 transition-colors duration-200"
                >
                  Sign In
                </Link>
              </div>
            )
          )}
        </div>
      </div>
      
      {/* Performance Dashboard Modal */}
      <PerformanceDashboard 
        isOpen={showPerformanceDashboard}
        onClose={() => setShowPerformanceDashboard(false)}
      />
    </nav>
  );
};

export default Navbar; 