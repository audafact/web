import React, { useState, useEffect } from 'react';
import { 
  getConsentState, 
  saveConsentState, 
  getConsentPreferences, 
  applyConsentPreferences,
  ConsentPreferences 
} from '../utils/consentUtils';

interface CookieConsentBannerProps {
  onConsentChange?: (preferences: ConsentPreferences) => void;
}

const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onConsentChange }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true, // Always true
    analytics: false,
    marketing: false,
    preferences: false,
  });

  useEffect(() => {
    // Check if user has already consented
    const consentState = getConsentState();
    if (!consentState) {
      setIsVisible(true);
    } else {
      setPreferences(consentState.preferences);
    }
  }, []);

  const handleAcceptAll = () => {
    const allConsent: ConsentPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    };
    
    saveConsentState(allConsent);
    applyConsentPreferences(allConsent);
    setIsVisible(false);
    onConsentChange?.(allConsent);
  };

  const handleRejectAll = () => {
    const minimalConsent: ConsentPreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    };
    
    saveConsentState(minimalConsent);
    applyConsentPreferences(minimalConsent);
    setIsVisible(false);
    onConsentChange?.(minimalConsent);
  };

  const handleSavePreferences = () => {
    saveConsentState(preferences);
    applyConsentPreferences(preferences);
    setIsVisible(false);
    onConsentChange?.(preferences);
  };

  const handlePreferenceChange = (category: keyof ConsentPreferences, value: boolean) => {
    if (category === 'necessary') return; // Can't change necessary cookies
    
    setPreferences(prev => ({
      ...prev,
      [category]: value,
    }));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Content */}
          <div className="flex-1">
            <h3 className="text-white font-semibold mb-2">Cookie Preferences</h3>
            <p className="text-slate-300 text-sm">
              We use cookies to enhance your experience and analyze site traffic. 
              {!showDetails && (
                <button
                  onClick={() => setShowDetails(true)}
                  className="text-audafact-accent-cyan hover:text-audafact-accent-purple underline ml-1"
                >
                  Customize
                </button>
              )}
            </p>
            
            {/* Detailed preferences (when expanded) */}
            {showDetails && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-white text-sm font-medium">Analytics</h4>
                    <p className="text-slate-400 text-xs">Google Analytics, HubSpot tracking</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => handlePreferenceChange('analytics', e.target.checked)}
                    className="w-4 h-4 text-audafact-accent-cyan bg-slate-800 border-slate-600 rounded focus:ring-audafact-accent-cyan"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-white text-sm font-medium">Marketing</h4>
                    <p className="text-slate-400 text-xs">Facebook Pixel, TikTok tracking</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={(e) => handlePreferenceChange('marketing', e.target.checked)}
                    className="w-4 h-4 text-audafact-accent-cyan bg-slate-800 border-slate-600 rounded focus:ring-audafact-accent-cyan"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-white text-sm font-medium">Preferences</h4>
                    <p className="text-slate-400 text-xs">Remember your settings</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.preferences}
                    onChange={(e) => handlePreferenceChange('preferences', e.target.checked)}
                    className="w-4 h-4 text-audafact-accent-cyan bg-slate-800 border-slate-600 rounded focus:ring-audafact-accent-cyan"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {showDetails ? (
              <>
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 bg-audafact-accent-cyan text-white text-sm font-medium rounded-lg hover:bg-audafact-accent-purple transition-colors"
                >
                  Save Preferences
                </button>
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 border border-slate-600 text-slate-300 text-sm font-medium rounded-lg hover:border-audafact-accent-cyan hover:text-audafact-accent-cyan transition-colors"
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-2 bg-audafact-accent-cyan text-black text-sm font-medium rounded-lg hover:bg-audafact-accent-purple transition-colors"
                >
                  Accept All
                </button>
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-2 border border-slate-600 text-slate-300 text-sm font-medium rounded-lg hover:border-audafact-accent-cyan hover:text-audafact-accent-cyan transition-colors"
                >
                  Reject All
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
