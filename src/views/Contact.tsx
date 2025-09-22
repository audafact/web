import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useResponsiveDesign } from '../hooks/useResponsiveDesign';
import emailjs from '@emailjs/browser';

const Contact = () => {
  const { isMobile } = useResponsiveDesign();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    inquiryType: 'general'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // EmailJS configuration using environment variables
      const result = await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          from_name: formData.name,
          from_email: formData.email,
          subject: formData.subject,
          message: formData.message,
          inquiry_type: formData.inquiryType,
          to_email: 'hello@audafact.com'
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );

      console.log('Email sent successfully:', result.text);
      setSubmitStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '', inquiryType: 'general' });
    } catch (error) {
      console.error('Failed to send email:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Contact Info */}
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-audafact-accent-cyan to-audafact-accent-cyan bg-clip-text text-transparent mb-4">
                Get in Touch
              </h1>
              <p className="text-slate-300 text-lg leading-relaxed">
                Have questions about Audafact? Want to provide feedback on the beta? 
                We'd love to hear from you.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-audafact-accent-cyan rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Email</h3>
                  <p className="text-slate-300">
                    <a href="mailto:hello@audafact.com" className="text-audafact-accent-cyan hover:text-audafact-accent-cyan transition-colors duration-200">
                      hello@audafact.com
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-audafact-accent-cyan rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Response Time</h3>
                  <p className="text-slate-300">
                    We typically respond within 24-48 hours during business days.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-audafact-accent-cyan rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Beta Feedback</h3>
                  <p className="text-slate-300">
                    Found a bug or have a feature request? Let us know and help shape the future of Audafact.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden audafact-card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-3">Join the Community</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Connect with other producers using Audafact. Share your flips, get feedback, 
                and stay updated on new features and releases.
              </p>
            </div>
            <div className="relative overflow-hidden audafact-card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-audafact-accent-cyan rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🎵</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Turn Your Music Into Sampling Revenue</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    <strong className="text-audafact-accent-cyan">Earn money when producers sample your tracks.</strong> We're building the first platform that pays independent artists when their music gets flipped by producers—with automatic licensing and revenue sharing built in. 
                    Use the contact form and select "Music Contribution" to be among the first artists on our platform.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="relative overflow-hidden audafact-card p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">Send us a message</h2>
            
            {submitStatus === 'success' ? (
              <div className="text-center py-8">
                <div className="text-green-400 text-6xl mb-4">✓</div>
                <p className="text-white text-lg">Thanks for reaching out!</p>
                <p className="text-slate-300 mt-2">We'll get back to you soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-white text-sm font-medium mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-white text-sm font-medium mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="inquiryType" className="block text-white text-sm font-medium mb-2">
                    Inquiry Type
                  </label>
                  <select
                    id="inquiryType"
                    name="inquiryType"
                    value={formData.inquiryType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan"
                  >
                    <option value="general">General Question</option>
                    <option value="beta">Beta Feedback</option>
                    <option value="bug">Bug Report</option>
                    <option value="feature">Feature Request</option>
                    <option value="music-contribution">Music Contribution</option>
                    <option value="business">Business Inquiry</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-white text-sm font-medium mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan"
                    placeholder="Brief subject line"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-white text-sm font-medium mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-audafact-accent-cyan focus:ring-1 focus:ring-audafact-accent-cyan resize-none"
                    placeholder="Tell us more about your inquiry..."
                  />
                </div>

                {submitStatus === 'error' && (
                  <div className="text-red-400 text-sm text-center">
                    Something went wrong. Please try again or email us directly.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full group relative inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-audafact-accent-cyan text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send Message
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-audafact-accent-cyan rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                </button>
              </form>
            )}
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

export default Contact;
