import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { SidePanelProvider } from './context/SidePanelContext';
import { RecordingProvider } from './context/RecordingContext';
import { DemoProvider } from './context/DemoContext';
import { GlobalModalManager } from './components/GlobalModalManager';
import SuccessMessageManager from './components/SuccessMessageManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EnhancedAnalyticsService } from './services/enhancedAnalyticsService';
import { router } from './routes';

function App() {
  // Initialize the enhanced analytics service
  const analytics = EnhancedAnalyticsService.getInstance();
  
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
