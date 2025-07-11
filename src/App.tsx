import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { router } from './routes';

function App() {
  return (
    <AuthProvider>
      <AudioProvider>
        <RouterProvider router={router} />
      </AudioProvider>
    </AuthProvider>
  );
}

export default App;
