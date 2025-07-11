import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="text-center py-20">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Create Music with Ease
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          TrackStitch makes music sampling accessible to everyone. Upload tracks, create loops, and trigger samples with just a few clicks.
        </p>
        <Link
          to="/studio"
          className="bg-indigo-600 text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-indigo-700"
        >
          Start Creating
        </Link>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Loop Feature */}
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="text-indigo-600 text-2xl mb-4">🔄</div>
            <h3 className="text-xl font-semibold mb-2">Loop Mode</h3>
            <p className="text-gray-600">
              Select and loop any segment of your tracks with precision. Perfect for creating beats and samples.
            </p>
          </div>

          {/* Cue Feature */}
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="text-indigo-600 text-2xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold mb-2">Cue Mode</h3>
            <p className="text-gray-600">
              Trigger samples instantly with keyboard shortcuts. Great for live performance and experimentation.
            </p>
          </div>

          {/* Visual Feature */}
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="text-indigo-600 text-2xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">Visual Feedback</h3>
            <p className="text-gray-600">
              See your music with clear waveform visualization. Makes editing and sampling intuitive.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      {!user && (
        <section className="text-center py-16 bg-gray-50 rounded-lg">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Start?
          </h2>
          <p className="text-gray-600 mb-8">
            Sign up to save your work and access more features.
          </p>
          {/* TODO: Implement login functionality */}
          <button
            className="bg-indigo-600 text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-indigo-700"
            onClick={() => alert('Login functionality coming soon!')}
          >
            Sign Up Now
          </button>
        </section>
      )}
    </div>
  );
};

export default Home; 