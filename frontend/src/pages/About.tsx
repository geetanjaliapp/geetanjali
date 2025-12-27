import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Navbar } from "../components";
import { Footer } from "../components/Footer";
import { LogoIcon } from "../components/icons";
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

  // Scroll to hash fragment (e.g., #contact) when navigating from another page
  useEffect(() => {
    if (location.hash) {
      const element = document.querySelector(location.hash);
      if (element) {
        // Small delay to ensure DOM is ready
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

    // Client-side content validation (name, subject, and message)
    const textToValidate =
      `${formData.name} ${formData.subject || ""} ${formData.message}`.trim();
    const contentCheck = validateContent(textToValidate);
    if (!contentCheck.valid) {
      setSubmitStatus("error");
      // Use contact-form-specific error messages
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

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <div className="flex justify-center mb-4 sm:mb-6">
            <LogoIcon className="h-14 w-14 sm:h-16 sm:w-16 lg:h-20 lg:w-20" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[var(--text-primary)] mb-2">
            About Geetanjali
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-[var(--text-tertiary)] max-w-2xl mx-auto">
            Ancient wisdom for modern decisions. Navigate life's complex choices
            with timeless principles from the Bhagavad Geeta.
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-2 bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] text-[var(--interactive-primary-text)] font-semibold px-6 py-3 sm:px-8 sm:py-3.5 rounded-[var(--radius-card)] transition-[var(--transition-all)] shadow-[var(--shadow-dropdown)] hover:shadow-[var(--shadow-modal)] text-base sm:text-lg"
            >
              <span>Start a Consultation</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
            <Link
              to="/verses"
              className="inline-flex items-center gap-2 bg-[var(--surface-elevated)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] font-medium px-6 py-3 sm:px-8 sm:py-3.5 rounded-[var(--radius-card)] transition-[var(--transition-all)] border border-[var(--border-default)] hover:border-[var(--border-default)] text-base sm:text-lg"
            >
              <span>Explore Verses</span>
            </Link>
          </div>
        </div>

        {/* What is Geetanjali */}
        <section className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-[var(--text-primary)] mb-3 sm:mb-4">
            What is Geetanjali?
          </h2>
          <div className="prose prose-orange max-w-none text-[var(--text-secondary)]">
            <p className="mb-4">
              Geetanjali is a thoughtful companion for ethical decision-making.
              When you face difficult choices—whether in your career,
              relationships, or personal growth—Geetanjali helps you explore
              your situation through the lens of timeless wisdom.
            </p>
            <p className="mb-4">
              Simply describe your dilemma, and Geetanjali will surface relevant
              teachings from the Bhagavad Geeta, along with practical
              perspectives to consider. It's not about giving you "the
              answer"—it's about helping you think more clearly and act more
              intentionally.
            </p>
            <p>
              Think of it as a wise friend who's read a lot of philosophy and
              wants to help you see your situation from multiple angles.
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-[var(--text-primary)] mb-4 sm:mb-6">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-[var(--option-selected-bg)] rounded-[var(--radius-avatar)] flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-[var(--interactive-ghost-text)]">
                  1
                </span>
              </div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                Share Your Dilemma
              </h3>
              <p className="text-[var(--text-tertiary)] text-sm">
                Describe the decision you're facing, your role, and the people
                involved.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[var(--option-selected-bg)] rounded-[var(--radius-avatar)] flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-[var(--interactive-ghost-text)]">
                  2
                </span>
              </div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                Explore Perspectives
              </h3>
              <p className="text-[var(--text-tertiary)] text-sm">
                Receive multiple viewpoints, each grounded in verses from the
                Geeta.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[var(--option-selected-bg)] rounded-[var(--radius-avatar)] flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-[var(--interactive-ghost-text)]">
                  3
                </span>
              </div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                Decide Thoughtfully
              </h3>
              <p className="text-[var(--text-tertiary)] text-sm">
                Use the insights to make a decision that aligns with your
                values.
              </p>
            </div>
          </div>

          {/* CTA after How It Works */}
          <div className="text-center mt-6 pt-6 border-t border-[var(--border-subtle)]">
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-2 text-[var(--interactive-ghost-text)] hover:text-[var(--text-link-hover)] font-semibold"
            >
              Try it now — it's free
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
          </div>
        </section>

        {/* Why the Bhagavad Geeta */}
        <section className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-[var(--text-primary)] mb-3 sm:mb-4">
            Why the Bhagavad Geeta?
          </h2>
          <div className="prose prose-orange max-w-none text-[var(--text-secondary)]">
            <p className="mb-4">
              The Bhagavad Geeta is a 700-verse conversation about life's
              biggest questions: How do we act when the right path isn't clear?
              How do we balance duty with personal values? How do we find peace
              amid uncertainty?
            </p>
            <p className="mb-4">
              Set on a battlefield, it addresses the universal human experience
              of being caught between competing obligations. Its teachings on
              ethical action, emotional resilience, and purposeful living have
              guided leaders, thinkers, and everyday people for over 2,000
              years.
            </p>
            <p>
              The wisdom isn't tied to any particular faith—it's practical
              philosophy that anyone can apply to modern challenges.
            </p>
          </div>
        </section>

        {/* Our Approach */}
        <section
          id="our-approach"
          className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8"
        >
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-[var(--text-primary)] mb-3 sm:mb-4">
            Our Approach
          </h2>
          <div className="prose prose-orange max-w-none text-[var(--text-secondary)]">
            <p className="mb-4">
              Geetanjali's guidance draws primarily from practical Vedantic
              principles—a philosophical tradition that emphasizes
              self-knowledge, ethical action, and finding meaning amid life's
              complexities. This approach focuses on actionable wisdom rather
              than ritual or metaphysics.
            </p>
            <p className="mb-4">
              We present the Geeta's teachings in an accessible, non-sectarian
              way. While we strive for accuracy, interpretations naturally
              reflect this practical lens. Scholarly traditions differ in their
              readings—some emphasize devotion, others knowledge or action—and
              we encourage exploring multiple perspectives.
            </p>
            <p>
              Think of Geetanjali as one thoughtful voice among many. For deeper
              study, we recommend consulting traditional commentaries and
              qualified teachers who can offer richer, more nuanced guidance.
            </p>
          </div>
        </section>

        {/* Privacy Note */}
        <section className="bg-[var(--surface-card)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-4 sm:p-6 mb-4 sm:mb-6 lg:mb-8 border border-[var(--border-warm)]">
          <div className="flex items-start gap-4">
            <div className="text-2xl">🔒</div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">
                Your Privacy
              </h3>
              <p className="text-[var(--text-tertiary)] text-sm">
                Your consultations are stored to help you revisit insights
                anytime. We don't sell or share your data. Your journey of
                reflection stays yours.
              </p>
            </div>
          </div>
        </section>

        {/* Open Source & Support */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6 lg:mb-8">
          <div className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg
                className="w-8 h-8 text-[var(--text-primary)]"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">
                Open Source
              </h3>
            </div>
            <p className="text-[var(--text-tertiary)] text-sm mb-4">
              Geetanjali is open source. Explore the code, suggest improvements,
              or contribute to the project.
            </p>
            <a
              href="https://github.com/geetanjaliapp/geetanjali"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[var(--interactive-ghost-text)] hover:text-[var(--text-link-hover)] font-medium"
            >
              View on GitHub
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>

          <div className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl sm:text-3xl" aria-hidden="true">
                ☕
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                Support the Project
              </h3>
            </div>
            <p className="text-[var(--text-tertiary)] text-sm mb-4">
              Geetanjali is free to use. If you find it valuable, consider
              supporting its development to help cover hosting and API costs.
            </p>
            <a
              href="https://ko-fi.com/vnykmshr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[var(--badge-warm-bg)] text-[var(--badge-warm-text)] hover:bg-[var(--badge-warm-hover)] px-4 py-2 rounded-[var(--radius-button)] font-medium transition-[var(--transition-color)] border border-[var(--border-warm)]"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              Buy me a coffee
            </a>
          </div>
        </section>

        {/* Contact Form */}
        <section
          id="contact"
          className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-dropdown)] p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8"
        >
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-[var(--text-primary)] mb-2">
            Get in Touch
          </h2>
          <p className="text-[var(--text-tertiary)] mb-6">
            Have feedback, questions, or ideas? We'd love to hear from you.
          </p>

          {submitStatus === "success" ? (
            <div className="bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-[var(--radius-button)] p-6 text-center">
              <div className="text-4xl mb-3">✓</div>
              <h3 className="text-lg font-semibold text-[var(--status-success-text)] mb-2">
                Message Sent!
              </h3>
              <p className="text-[var(--status-success-text)]">
                Thank you for reaching out. We'll get back to you soon.
              </p>
              <button
                onClick={() => setSubmitStatus("idle")}
                className="mt-4 text-[var(--status-success-text)] hover:text-[var(--status-success-text)] font-medium focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] rounded-[var(--radius-skeleton)]"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-base sm:text-sm"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-base sm:text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label
                    htmlFor="message_type"
                    className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
                  >
                    What's this about?
                  </label>
                  <select
                    id="message_type"
                    value={formData.message_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        message_type: e.target.value as ContactType,
                      })
                    }
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-base sm:text-sm"
                  >
                    <option value="feedback">General Feedback</option>
                    <option value="question">Question</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="bug_report">Bug Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
                  >
                    Subject{" "}
                    <span className="text-[var(--text-muted)]">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-base sm:text-sm"
                    placeholder="Brief subject"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent resize-none text-base sm:text-sm"
                  placeholder="Share your thoughts..."
                />
              </div>

              {submitStatus === "error" && (
                <div className="bg-[var(--status-error-bg)] border border-[var(--status-error-border)] rounded-[var(--radius-button)] p-4 text-[var(--status-error-text)] text-sm">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] disabled:bg-[var(--interactive-primary-disabled-bg)] disabled:text-[var(--interactive-primary-disabled-text)] text-[var(--interactive-primary-text)] font-semibold px-6 py-3 sm:px-8 sm:py-3 rounded-[var(--radius-button)] transition-[var(--transition-color)] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] text-base"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </section>

        {/* Final CTA Section */}
        <section className="bg-linear-to-br from-[var(--gradient-warm-from)] to-[var(--gradient-warm-to)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] p-6 sm:p-8 mb-6 sm:mb-8 text-center border border-[var(--border-warm)]">
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-[var(--text-primary)] mb-2">
            Ready to Explore?
          </h2>
          <p className="text-[var(--text-tertiary)] mb-6 max-w-lg mx-auto">
            Whether you're facing a difficult decision or simply curious about
            ancient wisdom, we're here to help.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-2 bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] text-[var(--interactive-primary-text)] font-semibold px-6 py-3 sm:px-8 sm:py-3.5 rounded-[var(--radius-card)] transition-[var(--transition-all)] shadow-[var(--shadow-dropdown)] hover:shadow-[var(--shadow-modal)] text-base sm:text-lg"
            >
              <span>Ask a Question</span>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
            <Link
              to="/verses"
              className="inline-flex items-center gap-2 text-[var(--interactive-ghost-text)] hover:text-[var(--text-link-hover)] font-medium"
            >
              <span>Browse All Verses</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </section>

        {/* Credits */}
        <section className="text-center text-[var(--text-muted)] text-sm">
          <p className="mb-2">
            Dedicated to making ancient wisdom accessible to modern seekers.
          </p>
          <p>
            Verse translations sourced from public domain texts. See our{" "}
            <a
              href="https://github.com/geetanjaliapp/geetanjali"
              className="text-[var(--interactive-ghost-text)] hover:text-[var(--text-link-hover)]"
            >
              GitHub repository
            </a>{" "}
            for full attribution.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
