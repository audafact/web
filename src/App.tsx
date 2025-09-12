import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { SidePanelProvider } from './context/SidePanelContext';
import { RecordingProvider } from './context/RecordingContext';
import { GuestProvider } from './context/GuestContext';
import { LibraryProvider } from './context/LibraryContext';
import { GlobalModalManager } from './components/GlobalModalManager';
import SuccessMessageManager from './components/SuccessMessageManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TurnstileDebug } from './components/TurnstileDebug';
import { router } from './routes';
import React from 'react';
// Add this import to your App.tsx or main component
import { debugJWT, testJWTToken } from './debug-jwt';
import { testR2MigrationInBrowser, getCurrentJWT, testJWTWithWorker } from './test-r2-migration-browser';

// Add this to make it available globally for debugging
(window as any).debugJWT = debugJWT;
(window as any).testJWTToken = testJWTToken;
(window as any).testR2MigrationInBrowser = testR2MigrationInBrowser;
(window as any).getCurrentJWT = getCurrentJWT;
(window as any).testJWTWithWorker = testJWTWithWorker;

// Import analytics test utilities
import './utils/testAnalytics';
import './utils/debugAnalytics';
import './utils/debugAnalyticsWorker';

function App() { 
  // Lazy load analytics service after app is mounted
  React.useEffect(() => {
    const loadAnalytics = async () => {
      const { EnhancedAnalyticsService } = await import('./services/enhancedAnalyticsService');
      EnhancedAnalyticsService.getInstance();
    };
    
    // Load analytics after a short delay to prioritize app rendering
    const timer = setTimeout(loadAnalytics, 1000);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <ErrorBoundary>
      <AuthProvider>
        <GuestProvider>
          <LibraryProvider>
            <AudioProvider>
              <SidePanelProvider>
                <RecordingProvider>
                  <RouterProvider router={router} />
                  <GlobalModalManager />
                  <SuccessMessageManager />
                  <TurnstileDebug />
                </RecordingProvider>
              </SidePanelProvider>
            </AudioProvider>
          </LibraryProvider>
        </GuestProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
