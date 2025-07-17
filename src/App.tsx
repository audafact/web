import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { SidePanelProvider } from './context/SidePanelContext';
import { router } from './routes';

function App() {
  return (
    <AuthProvider>
      <AudioProvider>
        <SidePanelProvider>
          <RouterProvider router={router} />
        </SidePanelProvider>
      </AudioProvider>
    </AuthProvider>
  );
}

export default App;
