import React from 'react';

export const Privacy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold audafact-heading mb-4">
          Audafact Privacy Policy
        </h1>
        <p className="text-lg audafact-text-secondary">
          Effective September 14, 2025
        </p>
      </div>

      {/* Content */}
      <div className="audafact-card p-8 sm:p-12">
        <div className="prose prose-invert max-w-none">
          <p className="text-lg audafact-text-secondary mb-8 leading-relaxed">
            Audafact values your privacy. This Privacy Policy explains how we collect, use, and protect your information when you sign up for our waitlist or interact with our website.
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold audafact-heading mb-4">
              1. Information We Collect
            </h2>
            <p className="audafact-text-secondary mb-4">
              When you join the Audafact waitlist, we collect:
            </p>
            <ul className="list-disc list-inside audafact-text-secondary space-y-2 mb-4">
              <li>Your name (if provided)</li>
              <li>Your email address</li>
              <li>Optional information you choose to share (e.g., DJ/Producer role)</li>
            </ul>
            <p className="audafact-text-secondary">
              We do not collect payment details or sensitive personal information at this stage.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold audafact-heading mb-4">
              2. How We Use Your Information
            </h2>
            <p className="audafact-text-secondary mb-4">
              We use your information only to:
            </p>
            <ul className="list-disc list-inside audafact-text-secondary space-y-2 mb-4">
              <li>Send you early access updates and product news about Audafact</li>
              <li>Provide important information about new features or releases</li>
              <li>Improve our communications and understand our audience better</li>
            </ul>
            <p className="audafact-text-secondary font-medium">
              We will never sell or rent your personal information to third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold audafact-heading mb-4">
              3. Storing and Protecting Your Data
            </h2>
            <p className="audafact-text-secondary">
              Your information is securely stored in HubSpot, our customer relationship management system. We take reasonable technical and organizational measures to protect your data against loss, misuse, or unauthorized access.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold audafact-heading mb-4">
              4. Your Choices
            </h2>
            <div className="space-y-4">
              <div>
                <p className="audafact-text-secondary mb-2">
                  <span className="font-medium">Unsubscribe:</span> You can opt out of our emails at any time by clicking the "unsubscribe" link included in every message.
                </p>
              </div>
              <div>
                <p className="audafact-text-secondary">
                  <span className="font-medium">Access/Deletion:</span> You may request access to, or deletion of, your personal information by contacting us at <a href="mailto:hello@audafact.com" className="text-audafact-accent-cyan hover:underline">hello@audafact.com</a>.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold audafact-heading mb-4">
              5. Changes to This Policy
            </h2>
            <p className="audafact-text-secondary">
              We may update this Privacy Policy from time to time. If we make significant changes, we'll notify you by email or post a notice on our site.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold audafact-heading mb-4">
              6. Contact Us
            </h2>
            <p className="audafact-text-secondary mb-4">
              If you have questions about this Privacy Policy or how we handle your data, please contact:
            </p>
            <div className="bg-audafact-surface-2 p-6 rounded-lg border border-audafact-divider">
              <p className="audafact-heading font-semibold mb-2">Audafact</p>
              <p className="audafact-text-secondary">
                Email: <a href="mailto:hello@audafact.com" className="text-audafact-accent-cyan hover:underline">hello@audafact.com</a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
