import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import { useEffect, useMemo, memo, useState } from 'react';
import { getHubSpotCookie, getCurrentTimestamp, getUTMParameters } from '../utils/hubspotUtils';

// Declare HubSpot and GTM globals
declare global {
  interface Window {
    hbspt: {
      forms: {
        create: (config: {
          portalId: string;
          formId: string;
          region: string;
          target: string;
        }) => void;
      };
    };
    dataLayer: any[];
  }
}

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isMobile } = useResponsiveDesign();
  const [isScrolling, setIsScrolling] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    agreeUpdates: false,
    agreeStorage: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ firstName: '', email: '', agreeUpdates: false, agreeStorage: false });
    setSubmitStatus('idle');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Helper function to create UTM parameter fields for HubSpot
  const createUTMFields = (utmParams: Record<string, string>) => {
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
    const fields: Array<{ name: string; value: string }> = [];
    
    utmKeys.forEach(key => {
      if (utmParams[key]) {
        // Add both custom and HubSpot built-in versions
        fields.push(
          { name: key, value: utmParams[key] },
          { name: `hs_${key}`, value: utmParams[key] }
        );
      }
    });
    
    return fields;
  };

  // Helper function to push events to dataLayer
  const pushToDataLayer = (eventData: Record<string, any>) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventData);
  };

  // Helper function to generate unique event ID
  const generateEventId = () => {
    return (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Guard against double submissions
    if (isSubmitting || submitStatus === 'success') {
      return;
    }
    
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Get HubSpot tracking cookie and UTM parameters
      const hutk = getHubSpotCookie();
      const utmParams = getUTMParameters();

      const requestBody = {
        submittedAt: getCurrentTimestamp(),
        fields: [
          { name: 'firstname', value: formData.firstName },
          { name: 'email', value: formData.email },
          { name: 'consent_to_comms', value: formData.agreeUpdates.toString() },
          { name: 'consent_to_process', value: formData.agreeStorage.toString() },
          // Audafact Attribution properties
          { name: 'referrer_url', value: document.referrer || '' },
          { name: 'signup_page', value: window.location.href },
          // UTM parameters - deduplicated logic
          ...createUTMFields(utmParams)
        ],
        context: {
          ...(hutk && { hutk }),
          pageUri: window.location.href,
          pageName: 'Audafact Waitlist'
        }
      };
      
      // Submit to HubSpot API
      const response = await fetch('https://api.hsforms.com/submissions/v3/integration/submit/243862805/bd0ad51a-65d5-4a66-a983-f1919c76069b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const eventId = generateEventId();

        // Push success events to dataLayer
        pushToDataLayer({
          event: "waitlist_signup",
          method: "hubspot_forms_api",
          form_id: "bd0ad51a-65d5-4a66-a983-f1919c76069b",
          portal_id: "243862805",
          status: "success",
          event_id: eventId
        });

        pushToDataLayer({
          event: "form_submit",
          form_name: "waitlist",
          status: "success"
        });

        setSubmitStatus('success');
        setTimeout(() => {
          handleCloseModal();
        }, 2000);
      } else {
        console.error('Form submission error:', response.status);
        
        pushToDataLayer({
          event: "form_submit",
          form_name: "waitlist",
          status: "error",
          error_code: response.status
        });
        
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      
      pushToDataLayer({
        event: "form_submit",
        form_name: "waitlist",
        status: "error",
        error_type: "network_error"
      });
      
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
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
      description: 'Select and loop any segment with precision. Perfect for creating beats and samples with surgical accuracy — no clearance needed.'
    },
    {
      icon: '🎯',
      title: 'xcuevator',
      description: 'Trigger samples instantly with keyboard shortcuts. Great for live performance and real-time experimentation with AI-generated sounds.'
    },
    {
      icon: '📊',
      title: 'waveform visualization',
      description: 'See your audio with crystal-clear waveform visualization. Dig deeper into your tracks with precision analysis — learn as you create.'
    },
    {
      icon: '🎼',
      title: 'curated library',
      description: 'Access our handpicked collection of AI-generated, royalty-free tracks. Practice sampling safely while building your skills and creative confidence.'
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
                Dig. Uncover. Refine. Create.
              </h1>
              
              
              <h2 className="text-base sm:text-lg font-medium text-slate-400 mb-4 sm:mb-6 tracking-wide">
                Discover sonic treasures, hone your craft, and share your creations freely with AI-generated, royalty-free tracks — no clearance, no stress.
              </h2>
              
              <div className="max-w-2xl mx-auto">
                <p className="text-base sm:text-lg text-slate-300 mb-6 leading-relaxed">
                  {isMobile
                    ? 'Master sampling workflows quickly with intuitive tools designed for beginners. Practice with AI-generated tracks, share freely without copyright issues, and join a community focused on putting control in the hands of the creators.'
                    : 'Master sampling workflows quickly with intuitive tools designed for beginners. Practice with AI-generated tracks, share your creations freely without copyright issues, and join a growing community of creators who value the freedom to create and share on their own terms.'}
                </p>
                
                <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-8 text-xs sm:text-sm text-slate-400">
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎵 Looping</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">✂️ Chopping</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎛️ Remixing</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎧 Real-time</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🛡️ Copyright-free</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎓 Learn safely</span>
                </div>

                <p className="text-slate-300 mb-8 font-medium">
                  {user
                    ? (isMobile ? 'Start creating.' : 'Jump into the studio and start creating with your library and saved tracks.')
                    : (isMobile ? 'Try the demo.' : 'Click below to try the demo and experience the freedom of sampling without the uncertainty.')}
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
                        Want early access? <a href="/auth" className="text-audafact-accent-cyan hover:text-audafact-accent-purple transition-colors duration-200 font-medium">Join the waitlist</a> to be among the first to access the AI library and share your creations without legal uncertainty.
                      </>
                    ) : (
                      <>
                        Want early access? <a href="/auth" className="text-audafact-accent-cyan hover:text-audafact-accent-purple transition-colors duration-200 font-medium">Join the waitlist</a> to be among the first to access our curated library of AI-generated, royalty-free tracks and share your sampled creations without worrying about copyright issues.
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* <button
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
              </button> */}

              <button
                onClick={handleOpenModal}
                className="group relative inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-8 py-4 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl sm:transform sm:hover:scale-105 transition-all duration-200"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Get early access
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
                Join the Waitlist
              </h2>
              <p className="text-slate-300 mb-6 sm:mb-8 max-w-2xl mx-auto">
                {isMobile
                  ? 'Be among the first to access Audafact when we launch. Get early access to the AI library and share your creations without legal uncertainty.'
                  : 'Be among the first to access Audafact when we launch. Get early access to our curated AI music library and share your sampled creations freely without worrying about copyright issues. Perfect for creators who want full control over their work.'}
              </p>
              <button
                className="group relative inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-8 py-3 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl sm:transform sm:hover:scale-105 transition-all duration-200"
                onClick={handleOpenModal}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Join Waitlist
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </button>
              {/* <button
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
              </button> */}
            </div>
          </div>
        </section>
      )}

      {/* HubSpot Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="relative bg-slate-900 rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors duration-200 z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4 text-center">Get Early Access</h3>
              
              {submitStatus === 'success' ? (
                <div className="text-center py-8">
                  <div className="text-green-400 text-6xl mb-4">✓</div>
                  <p className="text-white text-lg">Thanks! You're on the early access list.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="firstName" className="block text-white text-sm font-medium mb-2">
                      First name *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan"
                      placeholder="Enter your first name"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-white text-sm font-medium mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan"
                      placeholder="Enter your email address"
                    />
                  </div>
                  
                  <div className="text-slate-300 text-sm">
                    <p className="mb-3">
                      Audafact is committed to protecting your privacy. We'll only use your information to provide early access updates and product news. You can unsubscribe anytime. For more details, see our{' '}
                      <a href="/privacy" className="text-audafact-accent-cyan hover:text-audafact-accent-purple transition-colors duration-200">
                        Privacy Policy
                      </a>.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-start space-x-3 text-slate-300 text-sm">
                      <input
                        type="checkbox"
                        name="agreeUpdates"
                        checked={formData.agreeUpdates}
                        onChange={handleInputChange}
                        className="mt-1 h-4 w-4 text-audafact-accent-cyan bg-slate-800 border-slate-600 rounded focus:ring-audafact-accent-cyan focus:ring-2"
                      />
                      <span>I agree to receive early access updates and emails from Audafact.</span>
                    </label>
                    
                    <div className="text-slate-300 text-sm">
                      <p className="mb-2">To add you to the waitlist, we need to store and process your information. Please confirm by checking the box above.</p>
                    </div>
                    
                    <label className="flex items-start space-x-3 text-slate-300 text-sm">
                      <input
                        type="checkbox"
                        name="agreeStorage"
                        checked={formData.agreeStorage}
                        onChange={handleInputChange}
                        required
                        className="mt-1 h-4 w-4 text-audafact-accent-cyan bg-slate-800 border-slate-600 rounded focus:ring-audafact-accent-cyan focus:ring-2"
                      />
                      <span>I consent to Audafact storing my information so I can join the waitlist. *</span>
                    </label>
                  </div>
                  
                  <div className="text-slate-300 text-sm">
                    <p>
                      You can unsubscribe from Audafact updates at any time. For details on how we handle your data, please review our{' '}
                      <a href="/privacy" className="text-audafact-accent-cyan hover:text-audafact-accent-purple transition-colors duration-200">
                        Privacy Policy
                      </a>.
                    </p>
                  </div>
                  
                  {submitStatus === 'error' && (
                    <div className="text-red-400 text-sm text-center">
                      Something went wrong. Please try again.
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.agreeStorage}
                    className="w-full group relative inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        'Submit'
                      )}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home; 