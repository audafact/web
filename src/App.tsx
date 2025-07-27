import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { SidePanelProvider } from './context/SidePanelContext';
import { RecordingProvider } from './context/RecordingContext';
import { router } from './routes';

function App() {
  return (
    <AuthProvider>
      <AudioProvider>
        <SidePanelProvider>
          <RecordingProvider>
          <RouterProvider router={router} />
          </RecordingProvider>
        </SidePanelProvider>
      </AudioProvider>
    </AuthProvider>
  );
}

export default App;
