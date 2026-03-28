import { Link } from "react-router-dom";
import { Navbar } from "../components";
import { Footer } from "../components/Footer";
import { useSEO } from "../hooks";
import termsContent from "../content/terms.json";

/** Render text with **bold** markdown markers as <strong> elements. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <p>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="text-[var(--text-primary)]">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

export default function Terms() {
  useSEO({
    title: "Terms of Use",
    description:
      "Terms governing use of Geetanjali, AI-generated guidance, and your responsibilities.",
  });

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-page)] text-[var(--text-primary)]">
      <Navbar />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[var(--text-primary)] mb-2">
            {termsContent.title}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Last updated: {termsContent.lastUpdated}
          </p>
        </header>

        <div className="space-y-8 sm:space-y-10">
          {termsContent.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg sm:text-xl font-semibold font-heading text-[var(--text-primary)] mb-3">
                {section.heading}
              </h2>
              <div className="space-y-3 text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                {section.content.map((paragraph, i) => (
                  <RichText key={i} text={paragraph} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-[var(--border-warm)] text-sm text-[var(--text-muted)]">
          <p>
            See also:{" "}
            <Link
              to="/privacy"
              className="text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] underline"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
