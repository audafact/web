import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLaunchDemo = () => {
    navigate('/studio');
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="py-5">
        <div className="relative overflow-hidden audafact-card p-12 text-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
            {/* Vinyl record background element */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border-8 border-slate-600"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-4 border-slate-500"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-slate-400"></div>
            </div>
            
            {/* Animated groove lines */}
            <div className="absolute inset-0 opacity-10">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-slate-500"
                  style={{
                    width: `${200 + i * 8}px`,
                    height: `${200 + i * 8}px`,
                    animation: `vinyl-spin ${20 + i * 0.5}s linear infinite`,
                    animationDelay: `${i * 0.1}s`
                  }}
                ></div>
              ))}
            </div>

            {/* Main content */}
            <div className="relative z-10">
              {/* Icon/Logo area */}
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-audafact-accent-cyan to-audafact-accent-purple mb-4 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
              </div>

              <h1 className="text-4xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-6 tracking-tight">
                Discover. Chop. Create.
              </h1>
              
              <div className="max-w-2xl mx-auto">
                <p className="text-lg text-slate-300 mb-6 leading-relaxed">
                  Audafact empowers creators to dig, dissect, and deploy audio artifacts with precision tools for cueing, looping, and sampling. Whether you're building a beat, layering loops, or performing live edits, the possibilities are endless.
                </p>
                
                <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-slate-400">
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎵 Looping</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">✂️ Chopping</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎛️ Remixing</span>
                  <span className="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-600/50">🎧 Real-time</span>
                </div>

                <p className="text-slate-300 mb-8 font-medium">
                  Click below to launch the demo and experience Audafact firsthand.
                </p>
                
                {user ? (
                  <p className="text-slate-400 mb-8">
                    You can also access your full library and saved tracks in the studio.
                  </p>
                ) : (
                  <p className="text-slate-400 mb-8">
                    Want more control? <a href="/auth" className="text-audafact-accent-cyan hover:text-audafact-accent-purple transition-colors duration-200 font-medium">
                      Sign up
                    </a> to access a library of curated tracks and save your work.
                  </p>
                )}
              </div>

              <button
                onClick={handleLaunchDemo}
                className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Launch Demo
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </button>
            </div>
          </div>
        </section>

      {/* Features Section */}
      <section className="py-5">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Loop Feature */}
          <div className="relative overflow-hidden audafact-card p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:scale-105">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-slate-600"></div>
            </div>
            <div className="relative z-10">
              <div className="text-audafact-accent-cyan text-3xl mb-4">🔄</div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple bg-clip-text text-transparent mb-3">loop xtractor</h3>
              <p className="text-slate-300 leading-relaxed">
                Select and loop any segment of your tracks with precision. Perfect for creating beats and samples with surgical accuracy.
              </p>
            </div>
          </div>

          {/* Cue Feature */}
          <div className="relative overflow-hidden audafact-card p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:scale-105">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-slate-600"></div>
            </div>
            <div className="relative z-10">
              <div className="text-audafact-accent-cyan text-3xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple bg-clip-text text-transparent mb-3">xcuevator</h3>
              <p className="text-slate-300 leading-relaxed">
                Trigger samples instantly with keyboard shortcuts. Great for live performance and real-time experimentation.
              </p>
            </div>
          </div>

          {/* Visual Feature */}
          <div className="relative overflow-hidden audafact-card p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-xl hover:shadow-2xl transition-all duration-300 hover:transform hover:scale-105">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-slate-600"></div>
            </div>
            <div className="relative z-10">
              <div className="text-audafact-accent-cyan text-3xl mb-4">📊</div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple bg-clip-text text-transparent mb-3">waveform visualization</h3>
              <p className="text-slate-300 leading-relaxed">
                See your audio with crystal-clear waveform visualization. Dig deeper into your tracks with precision waveform analysis.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      {!user && (
        <section className="py-5">
          <div className="relative overflow-hidden audafact-card p-12 text-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
            {/* Vinyl record background element */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-6 border-slate-600"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-3 border-slate-500"></div>
            </div>
            
            <div className="relative z-10">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-4">
                Ready to Start?
              </h2>
              <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
                Sign up to save your work, access more features, and unlock the full potential of Audafact.
              </p>
              <button
                className="group relative inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-purple text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                onClick={() => navigate('/auth')}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Sign Up Now
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-purple to-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home; 