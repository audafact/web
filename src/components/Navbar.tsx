import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const Navbar = () => {
  const { user, loading } = useAuth();

  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <Link to="/" className="flex items-center">
            <span className="text-xl font-bold text-indigo-600">TrackStitch</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex space-x-8">
            <Link to="/" className="text-gray-600 hover:text-indigo-600">
              Home
            </Link>
            <Link to="/studio" className="text-gray-600 hover:text-indigo-600">
              Studio
            </Link>
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {!loading && (
              user ? (
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="text-gray-600 hover:text-indigo-600"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/login"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                >
                  Sign In
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 