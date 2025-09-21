import { Link } from 'react-router-dom';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';

const Terms = () => {
  const { isMobile } = useResponsiveDesign();

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <img 
                src="/favicon.svg" 
                alt="Audafact Logo" 
                className="w-7 h-7 mr-3"
              />
              <span className="text-white font-semibold text-lg">Audafact</span>
            </Link>
            
            {/* Back to Home */}
            <Link 
              to="/"
              className="text-slate-300 hover:text-audafact-accent-cyan transition-colors duration-200"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="relative overflow-hidden audafact-card p-8 sm:p-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-purple to-audafact-accent-cyan bg-clip-text text-transparent mb-8">
            Terms of Service
          </h1>
          
          <div className="text-slate-300 leading-relaxed space-y-6">
            <p className="text-sm text-slate-400">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using Audafact ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p>
                Audafact is a sampling workflow platform that provides:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>AI-generated, royalty-free music library</li>
                <li>Sampling and cue mapping tools</li>
                <li>Audio preview and manipulation features</li>
                <li>Export and sharing capabilities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">3. Beta Service</h2>
              <p>
                Audafact is currently in beta. The service is provided "as is" and may contain bugs, errors, or incomplete features. We reserve the right to modify or discontinue the service at any time during the beta period.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">4. User Accounts</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Use the service for any illegal or unauthorized purpose</li>
                <li>Attempt to gain unauthorized access to any part of the service</li>
                <li>Upload or distribute malicious code or harmful content</li>
                <li>Violate any applicable laws or regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">6. Intellectual Property</h2>
              <p>
                The Audafact service and its original content, features, and functionality are owned by Audafact and are protected by international copyright, trademark, and other intellectual property laws. Our AI-generated music library is provided royalty-free for sampling and creative use.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">7. Privacy Policy</h2>
              <p>
                Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the service, to understand our practices.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">8. Limitation of Liability</h2>
              <p>
                In no event shall Audafact, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">9. Termination</h2>
              <p>
                We may terminate or suspend your account and bar access to the service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">10. Changes to Terms</h2>
              <p>
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">11. Contact Information</h2>
              <p>
                If you have any questions about these Terms of Service, please contact us at{' '}
                <a href="mailto:legal@audafact.com" className="text-audafact-accent-cyan hover:text-audafact-accent-purple transition-colors duration-200">
                  legal@audafact.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="text-slate-500 text-sm">
            © 2024 Audafact. Built by producers for producers.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Terms;
