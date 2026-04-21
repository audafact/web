// import { useNavigate } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { getUTMParameters } from '../utils/hubspotUtils';
import { hashEmailForMeta, generateEventId } from '../utils/cryptoUtils';
import { getFacebookTrackingParams } from '../utils/facebookUtils';
import { onSignupSuccess, sendTikTokCompleteRegistration } from '../utils/tiktokUtils';
import { getAppEntryUrl } from '../routing/hostRouting';

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
  // const { user } = useAuth();
  // const navigate = useNavigate();
  const [, setIsScrolling] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    role: '',
    daw: '',
    genres: [] as string[],
    experience: '',
    referralSource: '',
    agreeUpdates: false,
    agreeStorage: false,
    earlyAccess: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  // Check if user just verified their email
  // useEffect(() => {
  //   if (user) {
  //     const emailVerifiedAt = user.email_confirmed_at;
  //     const now = new Date();
  //     const verifiedAt = emailVerifiedAt ? new Date(emailVerifiedAt) : null;
      
  //     // If verified within the last 5 minutes, redirect to verification page
  //     if (verifiedAt && (now.getTime() - verifiedAt.getTime()) < 5 * 60 * 1000) {
  //       navigate('/auth/verify', { replace: true });
  //       return;
  //     }
  //   }
  // }, [user, navigate]);

  // Scroll detection to pause animations during scroll and track scroll depth
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    let scroll50Tracked = false;
    let scroll90Tracked = false;
    
    const handleScroll = () => {
      setIsScrolling(true);
      document.body.classList.add('scrolling');
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
        document.body.classList.remove('scrolling');
      }, 150); // Resume animations 150ms after scroll stops
      
      // Track scroll depth
      const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      
      if (scrollPercent >= 50 && !scroll50Tracked) {
        scroll50Tracked = true;
        pushToDataLayer({
          event: "scroll_50",
          scroll_percent: Math.round(scrollPercent)
        });
      }
      
      if (scrollPercent >= 90 && !scroll90Tracked) {
        scroll90Tracked = true;
        pushToDataLayer({
          event: "scroll_90",
          scroll_percent: Math.round(scrollPercent)
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
      document.body.classList.remove('scrolling');
    };
  }, []);

  // Track page view on mount
  useEffect(() => {
    pushToDataLayer({
      event: "page_view",
      page_title: "Audafact Beta Access Landing",
      page_location: window.location.href
    });
  }, []);

  // Initialize Turnstile widget when modal opens
  useEffect(() => {
    if (isModalOpen && turnstileRef.current) {
      // Get Turnstile site key from environment variables
      const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
      
      if (turnstileSiteKey) {
        // Clear any existing widget
        turnstileRef.current.innerHTML = '';
        
        // Initialize Turnstile widget
        const widgetId = window.turnstile?.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token: string) => {
            setCaptchaToken(token);
          },
          'error-callback': () => {
            setCaptchaToken(null);
          },
          'expired-callback': () => {
            setCaptchaToken(null);
          },
          'timeout-callback': () => {
            setCaptchaToken(null);
          }
        });

        return () => {
          if (widgetId && window.turnstile) {
            window.turnstile.remove(widgetId);
          }
        };
      }
    }
  }, [isModalOpen]);

  const handleStartCreating = (location: string) => {
    pushToDataLayer({
      event: "click_cta_primary",
      cta_type: "start_creating_studio",
      cta_text: "Start creating",
      location,
    });
    window.location.href = getAppEntryUrl();
  };

  const openBetaAccessModal = (location: string) => {
    pushToDataLayer({
      event: "click_cta_secondary",
      cta_type: "beta_access_modal",
      cta_text: "Join beta",
      location,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ 
      firstName: '', 
      email: '', 
      role: '',
      daw: '',
      genres: [],
      experience: '',
      referralSource: '',
      agreeUpdates: false, 
      agreeStorage: false,
      earlyAccess: false
    });
    setSubmitStatus('idle');
    setCaptchaToken(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleGenreChange = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  // const handleDemoPlay = (trackType: string) => {
  //   pushToDataLayer({
  //     event: "demo_play",
  //     track_type: trackType,
  //     location: "product_demo_strip"
  //   });
  //   // TODO: Implement actual audio playback
  //   console.log(`Playing ${trackType} demo`);
  // };

  // Note: UTM parameters are now handled by the Supabase Edge Function

  // Helper function to push events to dataLayer
  const pushToDataLayer = (eventData: Record<string, any>) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventData);
  };

  // Note: generateEventId is now imported from cryptoUtils

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Guard against double submissions
    if (isSubmitting || submitStatus === 'success') {
      return;
    }

    // Check if Turnstile token is present
    if (!captchaToken) {
      alert('Please complete the security verification.');
      return;
    }
    
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Get UTM parameters (consent is handled by the Supabase Edge Function)
      const utmParams = getUTMParameters();

      // Prepare data for Supabase Edge Function with Turnstile validation
      const requestBody = {
        firstName: formData.firstName,
        email: formData.email,
        role: formData.role,
        daw: formData.daw,
        genres: formData.genres,
        experience: formData.experience,
        referralSource: formData.referralSource,
        agreeUpdates: formData.agreeUpdates,
        agreeStorage: formData.agreeStorage,
        earlyAccess: formData.earlyAccess,
        turnstileToken: captchaToken,
        referrerUrl: document.referrer || '',
        signupPage: window.location.href,
        utmParams: utmParams
      };

      // Get Supabase URL and anon key for the Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Submit to Supabase Edge Function (which validates Turnstile and submits to HubSpot)
      const response = await fetch(`${supabaseUrl}/functions/v1/waitlist-submission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        const eventId = generateEventId();

        // Push success events to dataLayer
        pushToDataLayer({
          event: "waitlist_signup",
          method: "supabase_edge_function",
          turnstile_verified: result.turnstileVerified,
          hubspot_submitted: result.hubspotSubmitted,
          status: "success",
          event_id: eventId
        });

        pushToDataLayer({
          event: "form_submit",
          form_name: "waitlist",
          status: "success"
        });

        // Send Meta CAPI Lead event for deduplication with Pixel
        try {
          const hashedEmail = await hashEmailForMeta(formData.email);
          const facebookParams = getFacebookTrackingParams();
          
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          
          const capiResponse = await fetch(`${supabaseUrl}/functions/v1/meta-lead`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              event_id: eventId, // Same event ID as Pixel for deduplication
              em: hashedEmail,
              fbp: facebookParams.fbp,
              fbc: facebookParams.fbc,
              sourceUrl: window.location.href
            })
          });

          if (capiResponse.ok) {
            const capiResult = await capiResponse.json();
            console.log('Meta CAPI Lead event sent successfully:', capiResult);
            
            // Track CAPI success in dataLayer
            pushToDataLayer({
              event: "meta_capi_success",
              event_id: eventId,
              has_fbp: !!facebookParams.fbp,
              has_fbc: !!facebookParams.fbc
            });

            // TikTok tracking - CompleteRegistration event for waitlist signup
            try {
              // Push to dataLayer for GTM TikTok tag
              onSignupSuccess(formData.email, eventId);
              
              // Send to TikTok Events API via Supabase Edge Function
              await sendTikTokCompleteRegistration(eventId, formData.email);
              console.log('TikTok CompleteRegistration event sent successfully for waitlist signup');
            } catch (tiktokError) {
              console.error('Failed to send TikTok CompleteRegistration event for waitlist:', tiktokError);
              // Don't throw - TikTok tracking failure shouldn't break waitlist flow
            }
          } else {
            const capiError = await capiResponse.text();
            console.warn('Meta CAPI Lead event failed:', capiError);
            
            // Track CAPI failure in dataLayer (non-blocking)
            pushToDataLayer({
              event: "meta_capi_error",
              event_id: eventId,
              error: capiError
            });
          }
        } catch (capiError) {
          console.warn('Meta CAPI request failed:', capiError);
          
          // Track CAPI failure in dataLayer (non-blocking)
          pushToDataLayer({
            event: "meta_capi_error",
            event_id: eventId,
            error: capiError instanceof Error ? capiError.message : 'Unknown error'
          });
        }

        setSubmitStatus('success');
        setTimeout(() => {
          handleCloseModal();
        }, 2000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Beta access form submission error:', errorData);
        
        pushToDataLayer({
          event: "form_submit",
          form_name: "waitlist",
          status: "error",
          error_code: response.status,
          error_message: errorData.error || "Unknown error"
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


  return (
    <div className="min-h-screen">
      {/* Sticky Header */}
      {/* 
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img 
                src="/favicon.svg" 
                alt="Audafact Logo" 
                className="w-7 h-7 mr-3"
              />
              <span className="text-white font-semibold text-lg">Audafact</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => openBetaAccessModal('sticky_header')}
                className="group relative inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-audafact-accent-cyan text-white font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <span className="relative z-10">Join beta</span>
                <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </button>
            </div>
          </div>
        </div>
      </header>
      */}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        {/* Hero Section */}
        <section className="py-12 sm:py-16">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Copy Block */}
            <div className="space-y-6">
              {/* Beta Badge */}
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-audafact-accent-cyan/20 to-audafact-accent-cyan/20 border border-audafact-accent-cyan/30">
                <span className="text-xs font-medium text-audafact-accent-cyan">Beta • Limited access</span>
              </div>
              
              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-cyan bg-clip-text text-transparent tracking-tight leading-tight">
                Make your first sample-based beat in seconds.
              </h1>
              
              {/* Subhead */}
              <p className="text-lg sm:text-xl text-slate-300 leading-relaxed">
                Try it instantly in your browser. No download required.
              </p>
              
              {/* Micro reassurance */}
              <div className="space-y-2">
                <div className="flex items-center text-slate-300">
                  <svg className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>No install. No plugins.</span>
                </div>
                <div className="flex items-center text-slate-300">
                  <svg className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Works on desktop + phone.</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => handleStartCreating('hero')}
                  className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-audafact-accent-cyan text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <span className="relative z-10">Start making something</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                </button>
                
                <button
                  type="button"
                  onClick={() => openBetaAccessModal('hero')}
                  className="inline-flex items-center justify-center px-6 py-4 border border-slate-600 text-slate-300 font-medium rounded-lg hover:border-audafact-accent-cyan hover:text-audafact-accent-cyan transition-all duration-200"
                >
                  Try it now
                </button>
              </div>
            </div>
            
            {/* Right: Product Visual */}
            <div className="relative">
              <div className="relative overflow-hidden audafact-card p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
                {/* Hero Demo Video */}
                <div className="relative">
                  <video 
                    preload="metadata"
                    className="w-full h-auto rounded-lg shadow-lg"
                    autoPlay 
                    muted 
                    loop
                    playsInline
                    poster="/audafact-hero-demo-poster.jpg"
                  >
                    <source src="/audafact-hero-demo.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Friction + outcome sections */}
        <section className="py-12 sm:py-16">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="relative overflow-hidden audafact-card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4">Start instantly</h2>
              <ul className="space-y-2 text-slate-300">
                <li>• No install</li>
                <li>• No plugins</li>
                <li>• Works on desktop + phone</li>
              </ul>
            </div>
            <div className="relative overflow-hidden audafact-card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4">What you can make</h2>
              <ul className="space-y-2 text-slate-300">
                <li>• Turn any sound into a loop</li>
                <li>• Sketch ideas instantly</li>
                <li>• Export your flip</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 relative overflow-hidden audafact-card p-4 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
            <div className="text-center mb-3">
              <p className="text-sm text-slate-300">See the flow: load, chop, trigger, loop.</p>
            </div>
            <video
              preload="metadata"
              className="w-full h-auto rounded-lg shadow-lg"
              autoPlay
              muted
              loop
              playsInline
              poster="/landing-mini-sampler-vid-cropped-poster.jpg"
            >
              <source src="/landing-mini-sampler-vid-cropped.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          <div className="mt-8 relative overflow-hidden audafact-card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-xl text-center">
            <p className="text-slate-300 italic">
              "I was making something in under a minute. That&apos;s the whole point."
            </p>
          </div>
        </section>

      {/* Call to Action */}
      <section className="py-5">
        <div className="relative overflow-hidden audafact-card p-8 sm:p-12 text-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
          {/* Vinyl record background element */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-44 sm:w-56 md:w-64 h-44 sm:h-56 md:h-64 rounded-full border-6 border-slate-600"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-36 sm:w-44 md:w-48 h-36 sm:h-44 md:h-48 rounded-full border-3 border-slate-500"></div>
          </div>
          
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-cyan bg-clip-text text-transparent mb-3 sm:mb-4">
              Ready to flip something?
            </h2>
            <p className="text-slate-300 mb-6 sm:mb-8 max-w-2xl mx-auto">
              Open the studio and start immediately. Feel the workflow first, then decide if you want to save and export.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center">
              <button
                type="button"
                className="group relative inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-8 py-3 bg-gradient-to-r from-audafact-accent-cyan text-white font-semibold rounded-lg shadow-lg hover:shadow-xl sm:transform sm:hover:scale-105 transition-all duration-200"
                onClick={() => handleStartCreating('final_cta')}
              >
                <span className="relative z-10">Try it now</span>
                <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-8 py-3 border border-slate-600 text-slate-300 font-medium rounded-lg hover:border-audafact-accent-cyan hover:text-audafact-accent-cyan transition-all duration-200"
                onClick={() => openBetaAccessModal('final_cta')}
              >
                Join beta
              </button>
            </div>
            {/* <button
              className="group relative inline-flex items-center justify-center w-full sm:w-auto px-6 sm:px-8 py-3 bg-gradient-to-r from-audafact-accent-cyan text-white font-semibold rounded-lg shadow-lg hover:shadow-xl sm:transform sm:hover:scale-105 transition-all duration-200"
              onClick={() => navigate('/auth')}
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                Sign Up Now
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            </button> */}
          </div>
        </div>
      </section>

      {/* HubSpot Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="relative bg-slate-900 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors duration-200 z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4 text-center">Join beta access</h3>
              
              {submitStatus === 'success' ? (
                <div className="text-center py-8">
                  <div className="text-green-400 text-6xl mb-4">✓</div>
                  <p className="text-white text-lg">Thanks! You&apos;re signed up for beta access updates.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Required fields */}
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
                  
                  {/* Optional fields */}
                  <div>
                    <label htmlFor="role" className="block text-white text-sm font-medium mb-2">
                      Role
                    </label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan"
                    >
                      <option value="">Select your role</option>
                      <option value="Producer">Producer</option>
                      <option value="DJ">DJ</option>
                      <option value="Both">Both</option>
                      <option value="Both">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="daw" className="block text-white text-sm font-medium mb-2">
                      Primary DAW
                    </label>
                    <select
                      id="daw"
                      name="daw"
                      value={formData.daw}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan"
                    >
                      <option value="">Select your DAW</option>
                      <option value="Ableton Live">Ableton Live</option>
                      <option value="FL Studio">FL Studio</option>
                      <option value="Logic Pro">Logic Pro</option>
                      <option value="Pro Tools">Pro Tools</option>
                      <option value="Cubase">Cubase</option>
                      <option value="Reason">Reason</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Genres (select all that apply)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Hip Hop', 'Electronic', 'R&B', 'Jazz', 'Rock', 'Pop', 'Trap', 'House'].map((genre) => (
                        <label key={genre} className="flex items-center space-x-2 text-slate-300 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.genres.includes(genre)}
                            onChange={() => handleGenreChange(genre)}
                            className="h-4 w-4 text-audafact-accent-cyan bg-slate-800 border-slate-600 rounded focus:ring-audafact-accent-cyan focus:ring-2"
                          />
                          <span>{genre}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Experience Level
                    </label>
                    <div className="space-y-2">
                      {['Beginner', 'Intermediate', 'Advanced', 'Professional'].map((level) => (
                        <label key={level} className="flex items-center space-x-2 text-slate-300 text-sm">
                          <input
                            type="radio"
                            name="experience"
                            value={level}
                            checked={formData.experience === level}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-audafact-accent-cyan bg-slate-800 border-slate-600 focus:ring-audafact-accent-cyan focus:ring-2"
                          />
                          <span>{level}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="referralSource" className="block text-white text-sm font-medium mb-2">
                      How did you hear about us?
                    </label>
                    <select
                      id="referralSource"
                      name="referralSource"
                      value={formData.referralSource}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan"
                    >
                      <option value="">Select referral source</option>
                      <option value="Social Media">Social Media</option>
                      <option value="Friend">Friend</option>
                      <option value="Search Engine">Search Engine</option>
                      <option value="Music Forum">Music Forum</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  
                  {/* Early access toggle */}
                  <div className="border-t border-slate-700 pt-4">
                    <label className="flex items-start space-x-3 text-slate-300 text-sm">
                      <input
                        type="checkbox"
                        name="earlyAccess"
                        checked={formData.earlyAccess}
                        onChange={handleInputChange}
                        className="mt-1 h-4 w-4 text-audafact-accent-cyan bg-slate-800 border-slate-600 rounded focus:ring-audafact-accent-cyan focus:ring-2"
                      />
                      <span>I want early feature access and to give feedback</span>
                    </label>
                  </div>
                  
                  <div className="text-slate-300 text-sm">
                    <p className="mb-3">
                      Audafact is committed to protecting your privacy. We'll only use your information to provide early access updates and product news. You can unsubscribe anytime. For more details, see our{' '}
                      <a href="/privacy" className="text-audafact-accent-cyan hover:text-audafact-accent-cyan transition-colors duration-200">
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
                    
                    <label className="flex items-start space-x-3 text-slate-300 text-sm">
                      <input
                        type="checkbox"
                        name="agreeStorage"
                        checked={formData.agreeStorage}
                        onChange={handleInputChange}
                        required
                        className="mt-1 h-4 w-4 text-audafact-accent-cyan bg-slate-800 border-slate-600 rounded focus:ring-audafact-accent-cyan focus:ring-2"
                      />
                      <span>I consent to Audafact storing my information for beta access and related updates. *</span>
                    </label>
                  </div>
                  
                  <div className="text-slate-300 text-sm">
                    <p>
                      You can unsubscribe from Audafact updates at any time. For details on how we handle your data, please review our{' '}
                      <a href="/privacy" className="text-audafact-accent-cyan hover:text-audafact-accent-cyan transition-colors duration-200">
                        Privacy Policy
                      </a>.
                    </p>
                  </div>
                  
                  {/* Turnstile widget */}
                  <div className="flex justify-center">
                    <div ref={turnstileRef}></div>
                  </div>
                  
                  {submitStatus === 'error' && (
                    <div className="text-red-400 text-sm text-center">
                      Something went wrong. Please try again.
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.agreeStorage || !captchaToken}
                    className="w-full group relative inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-audafact-accent-cyan text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
                    <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Footer */}
        <footer className="py-12 border-t border-slate-700/50">
          <div className="text-center space-y-6">
            <div className="flex justify-center space-x-8">
              <a href="/privacy" className="text-slate-400 hover:text-audafact-accent-cyan transition-colors duration-200">
                Privacy
              </a>
              <a href="/terms" className="text-slate-400 hover:text-audafact-accent-cyan transition-colors duration-200">
                Terms
              </a>
              <a href="/contact" className="text-slate-400 hover:text-audafact-accent-cyan transition-colors duration-200">
                Contact
              </a>
            </div>
            
            <div>
              <button
                type="button"
                onClick={() => openBetaAccessModal('footer')}
                className="inline-flex items-center justify-center px-6 py-3 border border-slate-600 text-slate-300 font-medium rounded-lg hover:border-audafact-accent-cyan hover:text-audafact-accent-cyan transition-all duration-200"
              >
                Join beta
              </button>
            </div>
            
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Built for creators who want to move fast.
            </p>
            
            <div className="text-slate-500 text-sm">
              © 2024 Audafact. Built by producers for producers.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home; 