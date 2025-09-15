import React from 'react';
import { Shield, Eye, Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react';

export const Privacy: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      {/* Header with enhanced styling */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-audafact-accent-cyan/10 rounded-full mb-6">
          <Shield className="w-8 h-8 text-audafact-accent-cyan" />
        </div>
        <h1 className="text-5xl font-bold audafact-heading mb-6 bg-gradient-to-r from-audafact-accent-cyan via-audafact-accent-blue to-audafact-accent-cyan bg-clip-text text-transparent">
          Privacy Policy
        </h1>
        <p className="text-xl audafact-text-secondary max-w-2xl mx-auto leading-relaxed">
          Your privacy matters to us. This policy explains how we collect, use, and protect your information.
        </p>
        <div className="mt-6 inline-flex items-center px-4 py-2 bg-audafact-surface-2 rounded-full border border-audafact-divider">
          <AlertCircle className="w-4 h-4 text-audafact-accent-cyan mr-2" />
          <span className="text-sm audafact-text-secondary">Effective September 14, 2025</span>
        </div>
      </div>

      {/* Content with enhanced styling */}
      <div className="audafact-card p-8 sm:p-12 lg:p-16">
        <div className="prose prose-invert max-w-none">
          <div className="bg-gradient-to-r from-audafact-surface-2 to-audafact-surface-1 p-6 rounded-lg border border-audafact-divider mb-12">
            <p className="text-lg audafact-text-secondary leading-relaxed mb-0">
              <strong className="text-audafact-text-primary">Audafact values your privacy.</strong> This Privacy Policy explains how we collect, use, and protect your information when you sign up for our waitlist or interact with our website.
            </p>
          </div>

          <section className="mb-12">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-audafact-accent-blue/10 rounded-lg flex items-center justify-center mr-4">
                <Eye className="w-5 h-5 text-audafact-accent-blue" />
              </div>
              <h2 className="text-2xl font-semibold audafact-heading">
                1. Information We Collect
              </h2>
            </div>
            <div className="bg-audafact-surface-2 p-6 rounded-lg border border-audafact-divider">
              <p className="text-audafact-text-primary mb-6 text-lg">
                When you join the Audafact waitlist, we collect:
              </p>
              <div className="space-y-4 mb-6">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-audafact-accent-green mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-audafact-text-primary">Your name (if provided)</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-audafact-accent-green mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-audafact-text-primary">Your email address</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-audafact-accent-green mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-audafact-text-primary">Optional information you choose to share (e.g., DJ/Producer role)</span>
                </div>
              </div>
              <div className="bg-audafact-surface-1 p-4 rounded-lg border-l-4 border-audafact-accent-cyan">
                <p className="audafact-text-secondary font-medium">
                  We do not collect payment details or sensitive personal information at this stage.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-audafact-accent-purple/10 rounded-lg flex items-center justify-center mr-4">
                <Mail className="w-5 h-5 text-audafact-accent-purple" />
              </div>
              <h2 className="text-2xl font-semibold audafact-heading">
                2. How We Use Your Information
              </h2>
            </div>
            <div className="bg-audafact-surface-2 p-6 rounded-lg border border-audafact-divider">
              <p className="text-audafact-text-primary mb-6 text-lg">
                We use your information only to:
              </p>
              <div className="space-y-4 mb-6">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-audafact-accent-green mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-audafact-text-primary">Send you early access updates and product news about Audafact</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-audafact-accent-green mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-audafact-text-primary">Provide important information about new features or releases</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-audafact-accent-green mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-audafact-text-primary">Improve our communications and understand our audience better</span>
                </div>
              </div>
              <div className="bg-gradient-to-r from-audafact-accent-green/10 to-audafact-accent-cyan/10 p-4 rounded-lg border border-audafact-accent-green/20">
                <p className="audafact-text-primary font-semibold text-center">
                  We will never sell or rent your personal information to third parties.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-audafact-accent-cyan/10 rounded-lg flex items-center justify-center mr-4">
                <Lock className="w-5 h-5 text-audafact-accent-cyan" />
              </div>
              <h2 className="text-2xl font-semibold audafact-heading">
                3. Storing and Protecting Your Data
              </h2>
            </div>
            <div className="bg-audafact-surface-2 p-6 rounded-lg border border-audafact-divider">
              <p className="text-audafact-text-primary text-lg leading-relaxed">
                Your information is securely stored in <span className="text-audafact-accent-cyan font-medium">HubSpot</span>, our customer relationship management system. We take reasonable technical and organizational measures to protect your data against loss, misuse, or unauthorized access.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-audafact-accent-blue/10 rounded-lg flex items-center justify-center mr-4">
                <CheckCircle className="w-5 h-5 text-audafact-accent-blue" />
              </div>
              <h2 className="text-2xl font-semibold audafact-heading">
                4. Your Choices
              </h2>
            </div>
            <div className="bg-audafact-surface-2 p-6 rounded-lg border border-audafact-divider">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-audafact-surface-1 p-4 rounded-lg border border-audafact-divider">
                  <h3 className="font-semibold text-audafact-text-primary mb-2 flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-audafact-accent-cyan" />
                    Unsubscribe
                  </h3>
                  <p className="text-audafact-text-primary text-sm">
                    You can opt out of our emails at any time by clicking the "unsubscribe" link included in every message.
                  </p>
                </div>
                <div className="bg-audafact-surface-1 p-4 rounded-lg border border-audafact-divider">
                  <h3 className="font-semibold text-audafact-text-primary mb-2 flex items-center">
                    <Eye className="w-4 h-4 mr-2 text-audafact-accent-cyan" />
                    Access/Deletion
                  </h3>
                  <p className="text-audafact-text-primary text-sm">
                    You may request access to, or deletion of, your personal information by contacting us at{' '}
                    <a href="mailto:hello@audafact.com" className="text-audafact-accent-cyan hover:underline font-medium">
                      hello@audafact.com
                    </a>.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-audafact-accent-purple/10 rounded-lg flex items-center justify-center mr-4">
                <AlertCircle className="w-5 h-5 text-audafact-accent-purple" />
              </div>
              <h2 className="text-2xl font-semibold audafact-heading">
                5. Changes to This Policy
              </h2>
            </div>
            <div className="bg-audafact-surface-2 p-6 rounded-lg border border-audafact-divider">
              <p className="text-audafact-text-primary text-lg leading-relaxed">
                We may update this Privacy Policy from time to time. If we make significant changes, we'll notify you by email or post a notice on our site.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-audafact-accent-cyan/10 rounded-lg flex items-center justify-center mr-4">
                <Mail className="w-5 h-5 text-audafact-accent-cyan" />
              </div>
              <h2 className="text-2xl font-semibold audafact-heading">
                6. Contact Us
              </h2>
            </div>
            <div className="bg-gradient-to-br from-audafact-surface-2 to-audafact-surface-1 p-8 rounded-lg border border-audafact-divider">
              <p className="text-audafact-text-primary mb-6 text-lg text-center">
                If you have questions about this Privacy Policy or how we handle your data, please contact:
              </p>
              <div className="bg-audafact-surface-1 p-6 rounded-lg border border-audafact-divider text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-audafact-accent-cyan/10 rounded-full mb-4">
                  <Shield className="w-6 h-6 text-audafact-accent-cyan" />
                </div>
                <h3 className="audafact-heading font-bold text-xl mb-2">Audafact</h3>
                <p className="text-audafact-text-primary mb-4">
                  Email: <a href="mailto:hello@audafact.com" className="text-audafact-accent-cyan hover:underline font-semibold text-lg">hello@audafact.com</a>
                </p>
                <p className="text-sm text-audafact-text-primary">
                  We typically respond within 24 hours
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
