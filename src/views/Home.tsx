import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="text-center py-20">
        <h1 className="text-5xl font-bold audafact-heading mb-6">
          Discover. Chop. Create.
        </h1>
        <p className="text-xl audafact-text-secondary mb-8 max-w-2xl mx-auto">
          Audafact empowers creators to dig, dissect, and deploy audio artifacts with precision tools for cueing, looping, and sampling.
        </p>
        <Link
          to="/studio"
          className="audafact-button-primary px-8 py-3 text-lg font-medium"
        >
          Start Creating
        </Link>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Loop Feature */}
          <div className="p-6 audafact-card-enhanced audafact-card-hover">
            <div className="text-audafact-accent-cyan text-2xl mb-4">🔄</div>
            <h3 className="text-xl font-semibold audafact-heading mb-2">loop xtractor</h3>
            <p className="audafact-text-secondary">
              Select and loop any segment of your tracks with precision. Perfect for creating beats and samples.
            </p>
          </div>

          {/* Cue Feature */}
          <div className="p-6 audafact-card-enhanced audafact-card-hover">
            <div className="text-audafact-accent-cyan text-2xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold audafact-heading mb-2">xcuevator</h3>
            <p className="audafact-text-secondary">
              Trigger samples instantly with keyboard shortcuts. Great for live performance and experimentation.
            </p>
          </div>

          {/* Visual Feature */}
          <div className="p-6 audafact-card-enhanced audafact-card-hover">
            <div className="text-audafact-accent-cyan text-2xl mb-4">📊</div>
            <h3 className="text-xl font-semibold audafact-heading mb-2">waveform visualization</h3>
            <p className="audafact-text-secondary">
              See your audio with crystal-clear waveform visualization. Dig deeper into your tracks with precision waveform analysis.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      {!user && (
        <section className="text-center py-16 audafact-card-enhanced">
          <h2 className="text-3xl font-bold audafact-heading mb-4">
            Ready to Start?
          </h2>
          <p className="audafact-text-secondary mb-8">
            Sign up to save your work and access more features.
          </p>
          {/* TODO: Implement login functionality */}
          <button
            className="audafact-button-primary px-8 py-3 text-lg font-medium"
            onClick={() => navigate('/auth')}
          >
            Sign Up Now
          </button>
        </section>
      )}
    </div>
  );
};

export default Home; 