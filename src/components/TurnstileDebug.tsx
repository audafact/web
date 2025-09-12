import { useEffect, useState } from 'react';

export const TurnstileDebug = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    setDebugInfo({
      siteKey: siteKey || 'NOT SET',
      hasSiteKey: !!siteKey,
      environment: import.meta.env.MODE,
      hostname: window.location.hostname,
      turnstileAvailable: !!window.turnstile,
    });
  }, []);

  // Only show in development or if there's an issue
  if (import.meta.env.MODE === 'production' && debugInfo.hasSiteKey) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: '#f0f0f0',
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h4>Turnstile Debug</h4>
      <div>Site Key: {debugInfo.siteKey}</div>
      <div>Has Site Key: {debugInfo.hasSiteKey ? 'Yes' : 'No'}</div>
      <div>Environment: {debugInfo.environment}</div>
      <div>Hostname: {debugInfo.hostname}</div>
      <div>Turnstile Available: {debugInfo.turnstileAvailable ? 'Yes' : 'No'}</div>
    </div>
  );
};
