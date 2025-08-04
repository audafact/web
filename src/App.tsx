import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { SidePanelProvider } from './context/SidePanelContext';
import { RecordingProvider } from './context/RecordingContext';
import { DemoProvider } from './context/DemoContext';
import { router } from './routes';

function App() {
  return (
    <AuthProvider>
      <DemoProvider>
        <AudioProvider>
          <SidePanelProvider>
            <RecordingProvider>
            <RouterProvider router={router} />
            </RecordingProvider>
          </SidePanelProvider>
        </AudioProvider>
      </DemoProvider>
    </AuthProvider>
  );
}

export default App;
