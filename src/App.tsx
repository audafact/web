import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { SidePanelProvider } from './context/SidePanelContext';
import { RecordingProvider } from './context/RecordingContext';
import { DemoProvider } from './context/DemoContext';
import { GlobalModalManager } from './components/GlobalModalManager';
import SuccessMessageManager from './components/SuccessMessageManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { router } from './routes';
import React from 'react';

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
        <DemoProvider>
          <AudioProvider>
            <SidePanelProvider>
              <RecordingProvider>
                <RouterProvider router={router} />
                <GlobalModalManager />
                <SuccessMessageManager />
              </RecordingProvider>
            </SidePanelProvider>
          </AudioProvider>
        </DemoProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
