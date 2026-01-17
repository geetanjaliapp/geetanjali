/*
 * ════════════════════════════════════════════════════════════════════════════
 *
 *                                    ॐ
 *                                   ╱ ╲
 *                                  ╱   ╲
 *                                 ╱  ◈  ╲
 *                                ╱ ─ ─ ─ ╲
 *                                 गीतांजलि
 *
 *                         G E E T A N J A L I
 *                    Ancient Wisdom, Modern Interface
 *
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   To the curious soul reading this source:
 *
 *   तद्विद्धि प्रणिपातेन परिप्रश्नेन सेवया।
 *   उपदेक्ष्यन्ति ते ज्ञानं ज्ञानिनस्तत्त्वदर्शिनः॥
 *
 *   "Seek knowledge through humble inquiry and service.
 *    The wise who have seen the truth will teach you."
 *
 *                              — Bhagavad Geeta 4.34
 *
 *   You sought, you found. Welcome, fellow seeker.
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Navbar } from "../components";
import { Footer } from "../components/Footer";
import {
  LogoIcon,
  BookOpenIcon,
  CompassIcon,
} from "../components/icons";
import { api } from "../lib/api";
import { validateContent } from "../lib/contentFilter";
import { errorMessages } from "../lib/errorMessages";
import { useSEO } from "../hooks";
import aboutContent from "../content/about.json";

/*
 * ─── Types ───────────────────────────────────────────────────────────────────
 * "नामरूपे व्याकरोत्" — Names and forms were distinguished.
 * Types give shape to the formless, structure to intention.
 */

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

/*
 * ─── Component ───────────────────────────────────────────────────────────────
 * "योगः कर्मसु कौशलम्" — Yoga is skill in action. (BG 2.50)
 * May this component serve its purpose with grace.
 */

export default function About() {
  const location = useLocation();

  useSEO({
    title: aboutContent.seo.title,
    description: aboutContent.seo.description,
    canonical: "/about",
  });

  /*
   * Scroll to hash on navigation — like a river finding its course
   */
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

  /*
   * A greeting for those who look deeper — the curious souls with DevTools open
   */
  useEffect(() => {
    console.log(
      "%c🙏 नमस्ते, fellow seeker",
      "font-size: 16px; font-weight: bold; color: #8B5A2B;"
    );
    console.log(
      "%cYou looked at the source. We respect that.\n\n" +
        "तद्विद्धि प्रणिपातेन परिप्रश्नेन सेवया\n" +
        '"Seek knowledge through humble inquiry."\n' +
        "— Bhagavad Geeta 4.34\n\n" +
        "Contributions welcome: github.com/geetanjaliapp/geetanjali",
      "font-size: 12px; color: #666; line-height: 1.6;"
    );
  }, []);

  /*
   * ─── State ─────────────────────────────────────────────────────────────────
   * "परिणामे दुःखम्" — All states transform.
   * We hold form data lightly, knowing it will change.
   */
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

  /*
   * ─── Form Handler ──────────────────────────────────────────────────────────
   * "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन" — BG 2.47
   * We act with care; the outcome is not ours to command.
   */
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

  /*
   * ─── Render ────────────────────────────────────────────────────────────────
   * "सर्वभूतस्थमात्मानं सर्वभूतानि चात्मनि" — BG 6.29
   * Seeing oneself in all beings, and all beings in oneself.
   * This page exists to serve whoever arrives here.
   */
  return (
    <div
      className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col"
      data-page="about"
      data-wisdom="सत्यमेव जयते"
    >
      <Navbar />

      {/* ════════════════════════════════════════════════════════════════════
       *  Main Content
       *  "एकं सद्विप्रा बहुधा वदन्ति" — Truth is one; the wise call it by many names.
       * ════════════════════════════════════════════════════════════════════ */}
      <main
        className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12"
        data-verse="The wise see knowledge and action as one. (BG 5.4)"
      >
        {/* ─── Hero ─────────────────────────────────────────────────────────
         *  The stillness before the story begins.
         */}
        <header className="text-center mb-10 sm:mb-14">
          <LogoIcon className="h-14 w-14 sm:h-16 sm:w-16 mx-auto mb-4" />
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[var(--text-primary)] mb-3">
            {aboutContent.hero.title}
          </h1>
          <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
            {aboutContent.hero.subtitle}
          </p>
        </header>

        {/* ─── The Story ────────────────────────────────────────────────────
         *  "श्रवणं मननं निदिध्यासनम्"
         *  Hearing, reflecting, contemplating — the path to understanding.
         */}
        <section
          aria-labelledby="story-heading"
          className="mb-10 sm:mb-14"
          data-chapter="The Question"
        >
          <h2 id="story-heading" className="sr-only">What is Geetanjali</h2>

          {/* The verse that anchors everything */}
          <blockquote
            className="text-center mb-8 sm:mb-10"
            cite={aboutContent.quote.citation}
            data-sanskrit={aboutContent.quote.sanskrit}
          >
            <p className="text-base sm:text-lg italic text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
              "{aboutContent.quote.text}"
            </p>
            <cite className="block mt-3 text-sm text-[var(--text-muted)] not-italic">
              — {aboutContent.quote.citation}
            </cite>
          </blockquote>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-[var(--text-secondary)] space-y-4 sm:space-y-5 text-sm sm:text-base leading-relaxed">
            {aboutContent.story.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>

        {/* ─── Philosophy ───────────────────────────────────────────────────
         *  "ज्ञानं विज्ञानसहितम्" — Knowledge with realization. (BG 7.2)
         *  Theory meets practice here.
         */}
        <section
          id="our-approach"
          aria-labelledby="philosophy-heading"
          className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-card)] p-5 sm:p-8 mb-10 sm:mb-14"
          data-chapter="The Approach"
        >
          <h2
            id="philosophy-heading"
            className="text-lg sm:text-xl font-bold font-heading text-[var(--text-primary)] mb-5 sm:mb-6"
          >
            {aboutContent.philosophy.heading}
          </h2>

          <div className="grid gap-6 sm:gap-8 text-sm sm:text-base text-[var(--text-secondary)]">
            <article data-teaching="jnana-yoga">
              <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <BookOpenIcon className="w-4 h-4 text-[var(--text-link)]" aria-hidden="true" />
                {aboutContent.philosophy.items[0].title}
              </h3>
              <p className="leading-relaxed">
                {aboutContent.philosophy.items[0].description}
              </p>
            </article>

            <article data-teaching="karma-yoga">
              <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <CompassIcon className="w-4 h-4 text-[var(--text-link)]" aria-hidden="true" />
                {aboutContent.philosophy.items[1].title}
              </h3>
              <p className="leading-relaxed">
                {aboutContent.philosophy.items[1].description}
              </p>
            </article>

            <article data-teaching="bhakti-yoga">
              <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--text-link)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {aboutContent.philosophy.items[2].title}
              </h3>
              <p className="leading-relaxed">
                {aboutContent.philosophy.items[2].description}
              </p>
            </article>
          </div>
        </section>

        {/* ─── Commitments ──────────────────────────────────────────────────
         *  "सत्यं वद। धर्मं चर।" — Speak truth. Practice dharma.
         *  These are our vows, written in code.
         */}
        <section
          aria-labelledby="commitments-heading"
          className="mb-10 sm:mb-14"
          data-chapter="The Vows"
        >
          <h2
            id="commitments-heading"
            className="text-xs sm:text-sm font-medium text-[var(--text-muted)] uppercase tracking-widest text-center mb-5 sm:mb-6"
          >
            {aboutContent.commitments.heading}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {aboutContent.commitments.items.map((item) => (
              <article
                key={item.id}
                className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 text-center"
                data-vow={item.id}
              >
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Links ────────────────────────────────────────────────────────
         *  "दूरेण ह्यवरं कर्म बुद्धियोगात्" — BG 2.49
         *  Action guided by wisdom. Links to continue the journey.
         */}
        <section
          aria-labelledby="links-heading"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 sm:mb-14"
          data-chapter="The Paths"
        >
          <h2 id="links-heading" className="sr-only">Resources</h2>

          <a
            href={aboutContent.links.github.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 flex items-center gap-4 hover:shadow-[var(--shadow-dropdown)] transition-shadow"
            data-path="contribution"
          >
            <svg className="w-10 h-10 text-[var(--text-primary)] shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-semibold text-[var(--text-primary)]">{aboutContent.links.github.title}</div>
              <div className="text-sm text-[var(--text-muted)]">{aboutContent.links.github.description}</div>
            </div>
          </a>

          <a
            href={aboutContent.links.support.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5 flex items-center gap-4 hover:shadow-[var(--shadow-dropdown)] transition-shadow"
            data-path="support"
          >
            <span className="text-4xl shrink-0" aria-hidden="true">☕</span>
            <div>
              <div className="font-semibold text-[var(--text-primary)]">{aboutContent.links.support.title}</div>
              <div className="text-sm text-[var(--text-muted)]">{aboutContent.links.support.description}</div>
            </div>
          </a>
        </section>

        {/* ─── Explore ──────────────────────────────────────────────────────
         *  "नैनं छिन्दन्ति शस्त्राणि" — BG 2.23
         *  The knowledge within cannot be cut. Explore freely.
         */}
        <section
          aria-labelledby="explore-heading"
          className="mb-10 sm:mb-14"
          data-chapter="The Invitation"
        >
          <h2
            id="explore-heading"
            className="text-xs sm:text-sm font-medium text-[var(--text-muted)] uppercase tracking-widest text-center mb-5"
          >
            {aboutContent.explore.heading}
          </h2>

          <nav className="flex justify-center gap-1.5 sm:gap-4" aria-label="Explore Geetanjali">
            <Link
              to="/verses"
              className="inline-flex items-center gap-1.5 sm:gap-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] transition-colors whitespace-nowrap"
            >
              <BookOpenIcon className="hidden sm:inline w-4 h-4 shrink-0" aria-hidden="true" />
              701 Verses
            </Link>
            <Link
              to="/read"
              className="inline-flex items-center gap-1.5 sm:gap-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] transition-colors whitespace-nowrap"
            >
              <svg className="hidden sm:inline w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Read
            </Link>
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-1.5 sm:gap-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[var(--radius-button)] px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-accent)] transition-colors whitespace-nowrap"
            >
              <CompassIcon className="hidden sm:inline w-4 h-4 shrink-0" aria-hidden="true" />
              Seek Guidance
            </Link>
          </nav>
        </section>

        {/* ─── Contact ──────────────────────────────────────────────────────
         *  "प्रश्नः ज्ञानस्य द्वारम्" — A question is the doorway to knowledge.
         *  Every message is welcome. Every voice matters.
         */}
        <section
          id="contact"
          aria-labelledby="contact-heading"
          className="bg-[var(--surface-elevated)] rounded-[var(--radius-card)] sm:rounded-[var(--radius-modal)] shadow-[var(--shadow-card)] p-5 sm:p-8"
          data-chapter="The Conversation"
        >
          <h2 id="contact-heading" className="text-lg sm:text-xl font-bold font-heading text-[var(--text-primary)] mb-2">
            Get in Touch
          </h2>
          <p className="text-[var(--text-tertiary)] text-sm mb-5 sm:mb-6">
            Feedback, questions, bug reports, or ideas for improvement—all are welcome.
          </p>

          {submitStatus === "success" ? (
            <div className="bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-[var(--radius-button)] p-6 text-center">
              <div className="text-2xl mb-2" aria-hidden="true">✓</div>
              <h3 className="font-semibold text-[var(--status-success-text)] mb-1">Message Sent</h3>
              <p className="text-[var(--status-success-text)] text-sm">Thank you. We'll respond as soon as we can.</p>
              <button
                onClick={() => setSubmitStatus("idle")}
                className="mt-4 text-sm text-[var(--status-success-text)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" data-form="contact">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-sm"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-type" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Type
                  </label>
                  <select
                    id="contact-type"
                    value={formData.message_type}
                    onChange={(e) => setFormData({ ...formData, message_type: e.target.value as ContactType })}
                    className="w-full px-4 py-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-sm"
                  >
                    <option value="feedback">General Feedback</option>
                    <option value="question">Question</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="bug_report">Bug Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="contact-subject" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Subject <span className="text-[var(--text-muted)] font-normal">(optional)</span>
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent text-sm"
                    placeholder="Brief subject"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-[var(--radius-input)] focus:ring-2 focus:ring-[var(--border-focus)] focus:border-transparent resize-none text-sm"
                  placeholder="What's on your mind?"
                />
              </div>

              {submitStatus === "error" && (
                <div className="bg-[var(--status-error-bg)] border border-[var(--status-error-border)] rounded-[var(--radius-button)] p-3 text-[var(--status-error-text)] text-sm" role="alert">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] disabled:bg-[var(--interactive-primary-disabled-bg)] disabled:text-[var(--interactive-primary-disabled-text)] text-[var(--interactive-primary-text)] font-semibold px-6 py-2.5 rounded-[var(--radius-button)] transition-[var(--transition-color)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </section>

        {/* ─── Attribution ──────────────────────────────────────────────────
         *  "गुरुर्ब्रह्मा गुरुर्विष्णुः" — We honor our sources.
         */}
        <footer className="text-center text-[var(--text-muted)] text-xs mt-8 sm:mt-10">
          <p>{aboutContent.attribution.text}</p>
          <p className="mt-1">
            <a
              href={aboutContent.attribution.linkHref}
              className="text-[var(--text-link)] hover:text-[var(--text-link-hover)] hover:underline"
            >
              {aboutContent.attribution.linkText}
            </a>
          </p>
        </footer>
      </main>

      <Footer />
    </div>
  );
}

/*
 * ════════════════════════════════════════════════════════════════════════════
 *
 *                            C O L O P H O N
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                                                                         │
 * │   Built with:     React 19 · TypeScript · Vite · Tailwind CSS          │
 * │   Typography:     Sanskrit 2003 · Inter                                 │
 * │   Source:         github.com/geetanjaliapp/geetanjali                   │
 * │   License:        MIT (Copyleft ↄ)                                      │
 * │                                                                         │
 * │   ─────────────────────────────────────────────────────────────────     │
 * │                                                                         │
 * │   "अहिंसा परमो धर्मः"                                                     │
 * │    Non-violence is the highest virtue.                                  │
 * │                                                                         │
 * │   This code was written with care, tested with patience,               │
 * │   and released with the hope that it may serve.                        │
 * │                                                                         │
 * │   Contributions welcome. Kindness required.                            │
 * │                                                                         │
 * │   ─────────────────────────────────────────────────────────────────     │
 * │                                                                         │
 * │   🙏 धन्यवाद for reading this far.                                       │
 * │      May your code compile and your tests pass.                        │
 * │                                                                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ════════════════════════════════════════════════════════════════════════════
 */
