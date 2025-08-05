import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { SidePanelProvider } from './context/SidePanelContext';
import { RecordingProvider } from './context/RecordingContext';
import { DemoProvider } from './context/DemoContext';
import { GlobalModalManager } from './components/GlobalModalManager';
import SuccessMessageManager from './components/SuccessMessageManager';
import { router } from './routes';

function App() {
  return (
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
  );
}

export default App;
