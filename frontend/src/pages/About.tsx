/**
 * About Page
 * - 701 + 9 verses (auspicious numbers)
 * - Semantic HTML structure
 * - Mobile-first responsive design
 * - Theme parity with design system
 */
import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Navbar } from "../components";
import { Footer } from "../components/Footer";
import {
  LogoIcon,
  BookOpenIcon,
  VolumeIcon,
  CompassIcon,
  CloudDownloadIcon,
  SparklesIcon,
  HeartIcon,
} from "../components/icons";
import { api } from "../lib/api";
import { validateContent } from "../lib/contentFilter";
import { errorMessages } from "../lib/errorMessages";
import { useSEO } from "../hooks";

type ContactType =
  | "feedback"
  | "question"
  | "bug_report"
  | "feature_request"
  | "other";

interface ContactForm {
  name: string;
  email: string;
  message_type: ContactType;
  subject: string;
  message: string;
}

export default function About() {
  const location = useLocation();

  useSEO({
    title: "About",
    description:
      "Learn about Geetanjali - ancient wisdom from the Bhagavad Geeta for modern ethical decisions. Free, open source, and privacy-focused.",
    canonical: "/about",
  });

  useEffect(() => {
    if (location.hash) {
      const element = document.querySelector(location.hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  }, [location.hash]);

  const [formData, setFormData] = useState<ContactForm>({
    name: "",
    email: "",
    message_type: "feedback",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    const textToValidate =
      `${formData.name} ${formData.subject || ""} ${formData.message}`.trim();
    const contentCheck = validateContent(textToValidate);
    if (!contentCheck.valid) {
      setSubmitStatus("error");
      const reason = contentCheck.reason?.includes("dilemma")
        ? "Please enter a clear message. We couldn't understand your input."
        : contentCheck.reason || "Please check your input and try again.";
      setErrorMessage(reason);
      setIsSubmitting(false);
      return;
    }

    try {
      await api.post("/contact", formData);
      setSubmitStatus("success");
      setFormData({
        name: "",
        email: "",
        message_type: "feedback",
        subject: "",
        message: "",
      });
    } catch (err) {
      setSubmitStatus("error");
      setErrorMessage(errorMessages.contact(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Hero */}
        <header className="text-center mb-8 sm:mb-12">
          <LogoIcon className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 mx-auto mb-3 sm:mb-4" />
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[var(--text-primary)] mb-2 sm:mb-3">
            Geetanjali
          </h1>
          <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-md mx-auto mb-2">
            Ancient wisdom for modern decisions
          </p>
          <p className="text-sm italic text-[var(--text-muted)] max-w-sm mx-auto px-4">
            "You have the right to work, but never to the fruit of work." — BG 2.47
          </p>

          <nav className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6" aria-label="Primary actions">
            <Link
              to="/cases/new"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] text-[var(--interactive-primary-text)] font-semibold px-6 py-3 rounded-[var(--radius-button)] transition-[var(--transition-all)] shadow-[var(--shadow-card)]"
            >
              Start a Consultation
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              to="/verses"
              className="inline-flex items-center gap-1 text-[var(--text-link)] hover:text-[var(--text-link-hover)] font-medium transition-[var(--transition-color)]"
            >
              Explore All 701 Verses
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </nav>
        </header>

        {/* Stats */}
        <section aria-labelledby="stats-heading" className="mb-10 sm:mb-12">
          <h2 id="stats-heading" className="sr-only">Key Statistics</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4" role="list">
            {[
              { value: "701 + 9", label: "Verses + Dhyanam", icon: BookOpenIcon },
              { value: "18", label: "Chapters", icon: CompassIcon },
              { value: "AI", label: "Audio", icon: VolumeIcon },
              { value: "Free", label: "Forever", icon: HeartIcon },
            ].map((stat) => (
              <li
                key={stat.label}
                className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] p-4 text-center shadow-[var(--shadow-card)]"
              >
                <stat.icon className="w-5 h-5 mx-auto mb-2 text-[var(--text-link)]" aria-hidden="true" />
                <div className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                  {stat.value}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{stat.label}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* How It Works */}
        <section aria-labelledby="how-it-works-heading" className="mb-10 sm:mb-12">
          <h2
            id="how-it-works-heading"
            className="text-xs sm:text-sm font-medium text-[var(--text-muted)] uppercase tracking-widest text-center mb-6 sm:mb-8"
          >
            How It Works
          </h2>

          <div className="relative">
            {/* Connection line - desktop only */}
            <div
              className="hidden sm:block absolute top-14 h-0.5 bg-[var(--border-accent)]"
              style={{ left: '20%', right: '20%' }}
              aria-hidden="true"
            />

            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4">
              {[
                {
                  emoji: "💭",
                  num: 1,
                  title: "Share Your Dilemma",
                  desc: "Describe the decision you're facing—career, relationships, ethics, or growth.",
                },
                {
                  emoji: "📖",
                  num: 2,
                  title: "Explore Perspectives",
                  desc: "Receive thoughtful viewpoints grounded in verses from the Bhagavad Geeta.",
                },
                {
                  emoji: "✨",
                  num: 3,
                  title: "Decide Thoughtfully",
                  desc: "Act with clarity, aligned with your values and deeper understanding.",
                },
              ].map((step) => (
                <li key={step.num} className="text-center relative">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-3 sm:mb-4 bg-[var(--surface-elevated)] rounded-full flex items-center justify-center shadow-[var(--shadow-card)] border border-[var(--border-subtle)] relative">
                    <span className="text-3xl sm:text-4xl" aria-hidden="true">{step.emoji}</span>
                    <span className="absolute -top-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shadow-[var(--shadow-card)]">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] mb-1">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-tertiary)] max-w-[240px] mx-auto">
                    {step.desc}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="text-center mt-6 sm:mt-8">
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-2 text-[var(--text-link)] hover:text-[var(--text-link-hover)] font-semibold text-sm sm:text-base transition-[var(--transition-color)]"
            >
              Try it now — it's free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features-heading" className="mb-10 sm:mb-12">
          <h2
            id="features-heading"
            className="text-xs sm:text-sm font-medium text-[var(--text-muted)] uppercase tracking-widest text-center mb-4 sm:mb-6"
          >
            Features
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4" role="list">
            {[
              {
                icon: SparklesIcon,
                title: "AI-Powered Guidance",
                desc: "Thoughtful perspectives on your dilemmas, grounded in timeless philosophy.",
              },
              {
                icon: VolumeIcon,
                title: "Sanskrit Audio",
                desc: "AI-generated recitations of all 701 verses with natural pronunciation.",
              },
              {
                icon: BookOpenIcon,
                title: "Study Modes",
                desc: "Reading mode, study mode, and verse-by-verse exploration with translations.",
              },
              {
                icon: CloudDownloadIcon,
                title: "Works Offline",
                desc: "Install as an app. Access verses and cached audio without internet.",
              },
            ].map((feature) => (
              <li
                key={feature.title}
                className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] p-4 sm:p-5 shadow-[var(--shadow-card)] flex gap-3 sm:gap-4"
              >
                <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-link)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] mb-0.5 sm:mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-tertiary)]">{feature.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Philosophy */}
        <section
          aria-labelledby="philosophy-heading"
          className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-card)] p-4 sm:p-6 lg:p-8 mb-8 sm:mb-10"
        >
          <h2 id="philosophy-heading" className="sr-only">Our Philosophy</h2>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 text-sm text-[var(--text-secondary)]">
            <article>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2 text-sm sm:text-base">
                <BookOpenIcon className="w-4 h-4 text-[var(--text-link)]" aria-hidden="true" />
                Why the Bhagavad Geeta?
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed">
                A 701-verse conversation about life's biggest questions: How do we act when the
                right path isn't clear? How do we balance duty with personal values? Its teachings
                have guided people for over 2,000 years—practical philosophy anyone can apply.
              </p>
            </article>
            <article>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2 text-sm sm:text-base">
                <CompassIcon className="w-4 h-4 text-[var(--text-link)]" aria-hidden="true" />
                Our Approach
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed">
                We present teachings accessibly and non-sectarianly, focusing on practical
                Vedantic principles—self-knowledge, ethical action, and finding meaning amid
                complexity. Think of Geetanjali as one thoughtful voice among many.
              </p>
            </article>
          </div>
        </section>

        {/* Trust */}
        <section aria-labelledby="trust-heading" className="mb-6 sm:mb-8">
          <h2 id="trust-heading" className="sr-only">Our Commitments</h2>
          <ul className="grid grid-cols-3 gap-2 sm:gap-4" role="list">
            {[
              { icon: "🔓", title: "Open Source", desc: "Fully transparent" },
              { icon: "🔒", title: "Private", desc: "Your data stays yours" },
              { icon: "💝", title: "Free Forever", desc: "No paywalls" },
            ].map((item) => (
              <li
                key={item.title}
                className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-3 sm:p-4 text-center"
              >
                <span className="text-xl sm:text-2xl mb-1 sm:mb-2 block" aria-hidden="true">{item.icon}</span>
                <div className="font-semibold text-[var(--text-primary)] text-xs sm:text-sm">{item.title}</div>
                <div className="text-[10px] sm:text-xs text-[var(--text-muted)]">{item.desc}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* Links */}
        <section aria-labelledby="links-heading" className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8 sm:mb-10">
          <h2 id="links-heading" className="sr-only">External Links</h2>
          <a
            href="https://github.com/geetanjaliapp/geetanjali"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-[var(--shadow-dropdown)] transition-shadow"
          >
            <svg className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--text-primary)]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-semibold text-[var(--text-primary)] text-sm sm:text-base">View on GitHub</div>
              <div className="text-xs sm:text-sm text-[var(--text-muted)]">Explore code, contribute</div>
            </div>
          </a>

          <a
            href="https://ko-fi.com/vnykmshr"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-[var(--shadow-dropdown)] transition-shadow"
          >
            <span className="text-3xl sm:text-4xl" aria-hidden="true">☕</span>
            <div>
              <div className="font-semibold text-[var(--text-primary)] text-sm sm:text-base">Support the Project</div>
              <div className="text-xs sm:text-sm text-[var(--text-muted)]">Help cover hosting costs</div>
            </div>
          </a>
        </section>

        {/* Contact Form */}
        <section
          id="contact"
          aria-labelledby="contact-heading"
          className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-card)] p-4 sm:p-6 lg:p-8 mb-6"
        >
          <h2 id="contact-heading" className="text-lg sm:text-xl font-bold font-heading text-[var(--text-primary)] mb-1">
            Get in Touch
          </h2>
          <p className="text-[var(--text-tertiary)] text-xs sm:text-sm mb-4 sm:mb-5">
            Feedback, questions, or ideas? We'd love to hear from you.
          </p>

          {submitStatus === "success" ? (
            <div className="bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-[var(--radius-button)] p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl mb-2" aria-hidden="true">✓</div>
              <h3 className="font-semibold text-[var(--status-success-text)] mb-1 text-sm sm:text-base">Message Sent!</h3>
              <p className="text-[var(--status-success-text)] text-xs sm:text-sm">We'll get back to you soon.</p>
              <button
                onClick={() => setSubmitStatus("idle")}
                className="mt-3 text-xs sm:text-sm text-[var(--status-success-text)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label htmlFor="contact-name" className="sr-only">Your name</label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-sm"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="sr-only">Your email</label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label htmlFor="contact-type" className="sr-only">Message type</label>
                  <select
                    id="contact-type"
                    value={formData.message_type}
                    onChange={(e) => setFormData({ ...formData, message_type: e.target.value as ContactType })}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-sm"
                  >
                    <option value="feedback">General Feedback</option>
                    <option value="question">Question</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="bug_report">Bug Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="contact-subject" className="sr-only">Subject (optional)</label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-sm"
                    placeholder="Subject (optional)"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-message" className="sr-only">Your message</label>
                <textarea
                  id="contact-message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent resize-none text-sm"
                  placeholder="Your message..."
                />
              </div>

              {submitStatus === "error" && (
                <div className="bg-[var(--status-error-bg)] border border-[var(--status-error-border)] rounded-[var(--radius-button)] p-3 text-[var(--status-error-text)] text-xs sm:text-sm" role="alert">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] disabled:bg-[var(--interactive-primary-disabled-bg)] disabled:text-[var(--interactive-primary-disabled-text)] text-[var(--interactive-primary-text)] font-semibold px-6 py-2.5 sm:py-3 rounded-[var(--radius-button)] transition-[var(--transition-color)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </section>

        {/* Credits */}
        <footer className="text-center text-[var(--text-muted)] text-[10px] sm:text-xs">
          <p>
            Verse translations from public domain texts.{" "}
            <a
              href="https://github.com/geetanjaliapp/geetanjali"
              className="text-[var(--text-link)] hover:text-[var(--text-link-hover)] hover:underline"
            >
              Full attribution on GitHub
            </a>
          </p>
        </footer>
      </main>

      <Footer />
    </div>
  );
}
