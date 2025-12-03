import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { api } from '../lib/api';

type ContactType = 'feedback' | 'question' | 'bug_report' | 'feature_request' | 'other';

interface ContactForm {
  name: string;
  email: string;
  message_type: ContactType;
  subject: string;
  message: string;
}

export default function About() {
  const [formData, setFormData] = useState<ContactForm>({
    name: '',
    email: '',
    message_type: 'feedback',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      await api.post('/contact', formData);
      setSubmitStatus('success');
      setFormData({
        name: '',
        email: '',
        message_type: 'feedback',
        subject: '',
        message: ''
      });
    } catch (err) {
      setSubmitStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="Geetanjali" className="h-20 w-20" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">About Geetanjali</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Ancient wisdom for modern decisions. Navigate life's complex choices with timeless principles from the Bhagavad Geeta.
          </p>
        </div>

        {/* What is Geetanjali */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What is Geetanjali?</h2>
          <div className="prose prose-orange max-w-none text-gray-600">
            <p className="mb-4">
              Geetanjali is a thoughtful companion for ethical decision-making. When you face difficult choices—whether in your career, relationships, or personal growth—Geetanjali helps you explore your situation through the lens of timeless wisdom.
            </p>
            <p className="mb-4">
              Simply describe your dilemma, and Geetanjali will surface relevant teachings from the Bhagavad Geeta, along with practical perspectives to consider. It's not about giving you "the answer"—it's about helping you think more clearly and act more intentionally.
            </p>
            <p>
              Think of it as a wise friend who's read a lot of philosophy and wants to help you see your situation from multiple angles.
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-orange-600">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Share Your Dilemma</h3>
              <p className="text-gray-600 text-sm">
                Describe the decision you're facing, your role, and the people involved.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-orange-600">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Explore Perspectives</h3>
              <p className="text-gray-600 text-sm">
                Receive multiple viewpoints, each grounded in verses from the Geeta.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-orange-600">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Decide Thoughtfully</h3>
              <p className="text-gray-600 text-sm">
                Use the insights to make a decision that aligns with your values.
              </p>
            </div>
          </div>
        </section>

        {/* Why the Bhagavad Geeta */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why the Bhagavad Geeta?</h2>
          <div className="prose prose-orange max-w-none text-gray-600">
            <p className="mb-4">
              The Bhagavad Geeta is a 700-verse conversation about life's biggest questions: How do we act when the right path isn't clear? How do we balance duty with personal values? How do we find peace amid uncertainty?
            </p>
            <p className="mb-4">
              Set on a battlefield, it addresses the universal human experience of being caught between competing obligations. Its teachings on ethical action, emotional resilience, and purposeful living have guided leaders, thinkers, and everyday people for over 2,000 years.
            </p>
            <p>
              The wisdom isn't tied to any particular faith—it's practical philosophy that anyone can apply to modern challenges.
            </p>
          </div>
        </section>

        {/* Privacy Note */}
        <section className="bg-orange-50 rounded-2xl p-6 mb-8 border border-orange-100">
          <div className="flex items-start gap-4">
            <div className="text-2xl">🔒</div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Your Privacy</h3>
              <p className="text-gray-600 text-sm">
                Your consultations are stored to help you revisit insights anytime. We don't sell or share your data. Your journey of reflection stays yours.
              </p>
            </div>
          </div>
        </section>

        {/* Open Source & Support */}
        <section className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-8 h-8 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900">Open Source</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Geetanjali is open source. Explore the code, suggest improvements, or contribute to the project.
            </p>
            <a
              href="https://github.com/geetanjaliapp/geetanjali"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
            >
              View on GitHub
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">💝</span>
              <h3 className="text-xl font-bold text-gray-900">Support the Project</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Geetanjali is free to use. If you find it valuable, consider supporting its development to help cover hosting and API costs.
            </p>
            <a
              href="https://ko-fi.com/vnykmshr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-pink-50 text-pink-600 hover:bg-pink-100 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              Buy me a coffee
            </a>
          </div>
        </section>

        {/* Contact Form */}
        <section className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Get in Touch</h2>
          <p className="text-gray-600 mb-6">
            Have feedback, questions, or ideas? We'd love to hear from you.
          </p>

          {submitStatus === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">✓</div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">Message Sent!</h3>
              <p className="text-green-700">Thank you for reaching out. We'll get back to you soon.</p>
              <button
                onClick={() => setSubmitStatus('idle')}
                className="mt-4 text-green-600 hover:text-green-700 font-medium"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="message_type" className="block text-sm font-medium text-gray-700 mb-1">
                    What's this about?
                  </label>
                  <select
                    id="message_type"
                    value={formData.message_type}
                    onChange={(e) => setFormData({ ...formData, message_type: e.target.value as ContactType })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="feedback">General Feedback</option>
                    <option value="question">Question</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="bug_report">Bug Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Brief subject"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  placeholder="Share your thoughts..."
                />
              </div>

              {submitStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full md:w-auto bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </section>

        {/* Credits */}
        <section className="text-center text-gray-500 text-sm">
          <p className="mb-2">
            Built with care by a team passionate about making ancient wisdom accessible.
          </p>
          <p>
            Verse translations sourced from public domain texts.
            See our{' '}
            <a href="https://github.com/geetanjaliapp/geetanjali" className="text-orange-600 hover:text-orange-700">
              GitHub repository
            </a>{' '}
            for full attribution.
          </p>
        </section>
      </main>
    </div>
  );
}
