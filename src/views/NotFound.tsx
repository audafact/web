import { Link } from 'react-router-dom';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';

const NotFound = () => {
  const { isMobile } = useResponsiveDesign();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* 404 Icon */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-audafact-accent-cyan to-audafact-accent-purple mb-6 shadow-2xl">
            <svg className="w-12 h-12 sm:w-16 sm:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.709M15 6.291A7.962 7.962 0 0012 5c-2.34 0-4.29 1.009-5.824 2.709" />
            </svg>
          </div>
        </div>

        {/* 404 Text */}
        <h1 className="text-6xl sm:text-8xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-4">
          404
        </h1>
        
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
          Page Not Found
        </h2>
        
        <p className="text-lg sm:text-xl text-slate-300 mb-8 leading-relaxed">
          {isMobile 
            ? "Sorry, this page doesn't exist or is temporarily unavailable."
            : "Sorry, the page you're looking for doesn't exist or is temporarily unavailable while we prepare for launch."
          }
        </p>

        {/* Coming Soon Notice */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Coming Soon</h3>
          </div>
          <p className="text-slate-300 text-sm">
            We're currently in early access mode and focusing on building the core experience. 
            Full access to all features will be available soon!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="group relative inline-flex items-center justify-center px-6 sm:px-8 py-3 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl sm:transform sm:hover:scale-105 transition-all duration-200"
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              Go Home
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="group relative inline-flex items-center justify-center px-6 sm:px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl sm:transform sm:hover:scale-105 transition-all duration-200 border border-slate-600"
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go Back
            </span>
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">
            Need help? Contact us at{' '}
            <a 
              href="mailto:support@audafact.com" 
              className="text-audafact-accent-cyan hover:text-audafact-accent-purple transition-colors duration-200"
            >
              support@audafact.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
