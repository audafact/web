import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { useEffect, useMemo, memo, useState } from 'react';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isMobile } = useResponsiveDesign();
  const [isScrolling, setIsScrolling] = useState(false);

  // Check if user just verified their email
  useEffect(() => {
    if (user) {
      const emailVerifiedAt = user.email_confirmed_at;
      const now = new Date();
      const verifiedAt = emailVerifiedAt ? new Date(emailVerifiedAt) : null;
      
      // If verified within the last 5 minutes, redirect to verification page
      if (verifiedAt && (now.getTime() - verifiedAt.getTime()) < 5 * 60 * 1000) {
        navigate('/auth/verify', { replace: true });
        return;
      }
    }
  }, [user, navigate]);

  // Scroll detection to pause animations during scroll
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      setIsScrolling(true);
      document.body.classList.add('scrolling');
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
        document.body.classList.remove('scrolling');
      }, 150); // Resume animations 150ms after scroll stops
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
      document.body.classList.remove('scrolling');
    };
  }, []);

  const handleLaunchDemo = () => {
    navigate('/studio');
  };

  // Memoize vinyl groove elements to prevent unnecessary re-renders
  const vinylGrooves = useMemo(() => {
    // Reduce number of grooves for better performance
    const grooveCount = isMobile ? 6 : 12;
    return [...Array(grooveCount)].map((_, i) => (
      <div
        key={i}
        className="vinyl-groove absolute top-1/2 left-1/2 rounded-full border border-slate-500"
        style={{
          width: `${(isMobile ? 140 : 200) + i * (isMobile ? 8 : 12)}px`,
          height: `${(isMobile ? 140 : 200) + i * (isMobile ? 8 : 12)}px`,
          animation: isScrolling 
            ? 'none' 
            : `vinyl-spin ${(isMobile ? 16 : 24) + i * 0.8}s linear infinite`,
          animationDelay: `${i * 0.15}s`
        }}
      />
    ));
  }, [isMobile, isScrolling]);

  // Memoize feature cards to prevent unnecessary re-renders
  const featureCards = useMemo(() => [
    {
      icon: '🔄',
      title: 'loop xtractor',
      description: 'Select and loop any segment of your tracks with precision. Perfect for creating beats and samples with surgical accuracy.'
    },
    {
      icon: '🎯',
      title: 'xcuevator',
      description: 'Trigger samples instantly with keyboard shortcuts. Great for live performance and real-time experimentation.'
    },
    {
      icon: '📊',
      title: 'waveform visualization',
      description: 'See your audio with crystal-clear waveform visualization. Dig deeper into your tracks with precision waveform analysis.'
    },
    {
      icon: '🎼',
      title: 'curated library',
      description: 'Access our handpicked collection of custom AI-generated tracks, purpose-built for effortless looping, precise slicing, and creative flipping into sample-based music.'
    }
  ], []);

  // Memoized FeatureCard component
  const FeatureCard = memo(({ icon, title, description }: { icon: string; title: string; description: string }) => (
    <div className="relative overflow-hidden audafact-card p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 sm:hover:transform sm:hover:scale-105">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-slate-600"></div>
      </div>
      <div className="relative z-10">
        <div className="text-audafact-accent-cyan text-2xl sm:text-3xl mb-3 sm:mb-4">{icon}</div>
        <h3 className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple bg-clip-text text-transparent mb-2 sm:mb-3">{title}</h3>
        <p className="text-slate-300 leading-relaxed">{description}</p>
      </div>
    </div>
  ));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      {/* Hero Section */}
      <section className="py-5">
        <div className="relative overflow-hidden audafact-card p-8 sm:p-12 text-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
            {/* Vinyl record background element */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-56 sm:w-72 md:w-96 h-56 sm:h-72 md:h-96 rounded-full border-8 border-slate-600"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 sm:w-56 md:w-64 h-40 sm:h-56 md:h-64 rounded-full border-4 border-slate-500"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 sm:w-28 md:w-32 h-20 sm:h-28 md:h-32 rounded-full bg-slate-400"></div>
            </div>
            
            {/* Animated groove lines */}
            <div className="vinyl-animation absolute inset-0 opacity-10">
              {vinylGrooves}
            </div>

            {/* Main content */}
            <div className="relative z-10">
              {/* Icon/Logo area */}
              <div className="mb-6 sm:mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-audafact-accent-cyan to-audafact-accent-purple mb-4 shadow-lg">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-2 sm:mb-3 tracking-tight leading-tight">
                Discover. Chop. Create.
              </h1>
              
              <h2 className="text-base sm:text-lg font-medium text-slate-400 mb-4 sm:mb-6 tracking-wide">
                Dig, dissect, and deploy audio artifacts with precision tools for cueing, looping, and sampling.
              </h2>
              
              <div className="max-w-2xl mx-auto">
                <p className="text-base sm:text-lg text-slate-300 mb-6 leading-relaxed">
                  {isMobile
                    ? 'Real-time sampling for looping, chopping, and remixing. Explore a curated AI track library built for flipping.'
                    : 'Audafact is a real-time music sampling app built for looping tracks, chopping samples, and crafting remixes on the fly. Access our curated library of custom AI-generated tracks, specifically crafted for looping, slicing, and flipping into sample-based music. Whether you\'re building a beat, layering loops, or performing live edits, the possibilities are endless.'}
                </p>
                
                <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-8 text-xs sm:text-sm text-slate-400">
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎵 Looping</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">✂️ Chopping</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎛️ Remixing</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎧 Real-time</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎼 Curated Library</span>
                </div>

                <p className="text-slate-300 mb-8 font-medium">
                  {user
                    ? (isMobile ? 'Start creating.' : 'Jump into the studio and start creating with your library and saved tracks.')
                    : (isMobile ? 'Launch the demo.' : 'Click below to launch the demo and experience Audafact firsthand.')}
                </p>
                
                {user ? (
                  <p className="text-slate-400 mb-8">
                    {isMobile
                      ? 'Access your library and saved tracks in the studio.'
                      : 'You can also access your full library and saved tracks in the studio.'}
                  </p>
                ) : (
                  <p className="text-slate-400 mb-8">
                    {isMobile ? (
                      <>
                        Want more control? <a href="/auth" className="text-audafact-accent-cyan hover:text-audafact-accent-purple transition-colors duration-200 font-medium">Sign up</a> to access the curated AI track library and save your work.
                      </>
                    ) : (
                      <>
                        Want more control? <a href="/auth" className="text-audafact-accent-cyan hover:text-audafact-accent-purple transition-colors duration-200 font-medium">Sign up</a> to access our curated library of custom AI-generated tracks designed for looping, slicing, and flipping, plus save your work.
                      </>
                    )}
                  </p>
                )}
              </div>

              <button
                onClick={handleLaunchDemo}
                className="group relative inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-8 py-4 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl sm:transform sm:hover:scale-105 transition-all duration-200"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  {'Start Creating'}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </button>
            </div>
          </div>
        </section>

      {/* Features Section */}
      <section className="py-5">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {featureCards.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </section>

      {/* Call to Action */}
      {!user && (
        <section className="py-5">
          <div className="relative overflow-hidden audafact-card p-8 sm:p-12 text-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
            {/* Vinyl record background element */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-44 sm:w-56 md:w-64 h-44 sm:h-56 md:h-64 rounded-full border-6 border-slate-600"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-36 sm:w-44 md:w-48 h-36 sm:h-44 md:h-48 rounded-full border-3 border-slate-500"></div>
            </div>
            
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-3 sm:mb-4">
                Ready to Start?
              </h2>
              <p className="text-slate-300 mb-6 sm:mb-8 max-w-2xl mx-auto">
                {isMobile
                  ? 'Sign up to save, access the AI library, and unlock premium features.'
                  : 'Sign up to save your work, access our curated AI music library, and unlock the full potential of Audafact with premium features and exclusive tracks.'}
              </p>
              <button
                className="group relative inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-8 py-3 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl sm:transform sm:hover:scale-105 transition-all duration-200"
                onClick={() => navigate('/auth')}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Sign Up Now
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home; 