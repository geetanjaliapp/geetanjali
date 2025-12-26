import { Link } from "react-router-dom";

type Variant = "verse" | "case" | "shared";

interface ContentNotFoundProps {
  variant: Variant;
  isAuthenticated?: boolean;
}

const CONTENT = {
  verse: {
    icon: (
      <svg
        className="w-8 h-8 text-[var(--badge-warm-text)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
    title: "Verse Not Found",
    message: "The Bhagavad Geeta contains 701 verses across 18 chapters.",
    primaryCta: { label: "Browse All Verses", to: "/verses" },
    secondaryCta: { label: "Start with Chapter 1", to: "/verses?chapter=1" },
  },
  case: {
    icon: (
      <svg
        className="w-8 h-8 text-[var(--text-tertiary)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    title: "Consultation Not Found",
    message: "This consultation doesn't exist or you don't have access.",
    primaryCta: { label: "View Cases", to: "/consultations" },
    secondaryCta: { label: "Start New Consultation", to: "/cases/new" },
    authHint: true,
  },
  shared: {
    icon: (
      <svg
        className="w-8 h-8 text-[var(--text-accent)]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
    ),
    title: "Shared Consultation Unavailable",
    message: "The owner may have made it private or removed it.",
    subtext:
      "Consultations can be shared and unshared anytime by their creators.",
    primaryCta: { label: "Start Your Own Consultation", to: "/cases/new" },
    secondaryCta: { label: "Go Home", to: "/" },
  },
} as const;

export function ContentNotFound({
  variant,
  isAuthenticated = false,
}: ContentNotFoundProps) {
  const content = CONTENT[variant];

  // For case variant, swap CTAs based on auth status
  const primaryCta =
    variant === "case" && !isAuthenticated
      ? content.secondaryCta
      : content.primaryCta;

  const secondaryCta =
    variant === "case" && !isAuthenticated
      ? { label: "Go Home", to: "/" }
      : content.secondaryCta;

  return (
    <div className="text-center max-w-md mx-auto px-4">
      {/* Icon */}
      <div className="w-16 h-16 mx-auto mb-6 rounded-[var(--radius-avatar)] bg-[var(--surface-warm)] flex items-center justify-center">
        {content.icon}
      </div>

      {/* Title */}
      <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-3">
        {content.title}
      </h1>

      {/* Message */}
      <p className="text-[var(--text-secondary)] mb-2">{content.message}</p>

      {/* Subtext (for shared variant) */}
      {"subtext" in content && content.subtext && (
        <p className="text-sm text-[var(--text-tertiary)] mb-6">
          {content.subtext}
        </p>
      )}

      {!("subtext" in content) && <div className="mb-6" />}

      {/* Primary CTA */}
      <Link
        to={primaryCta.to}
        className="inline-block px-5 sm:px-6 py-2.5 sm:py-3 bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] rounded-[var(--radius-button)] hover:opacity-90 transition-[var(--transition-color)] font-medium text-sm sm:text-base"
      >
        {primaryCta.label}
      </Link>

      {/* Secondary CTA */}
      <div className="mt-4">
        <Link
          to={secondaryCta.to}
          className="text-sm text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] font-medium"
        >
          {secondaryCta.label}
        </Link>
      </div>

      {/* Auth hint for case variant */}
      {variant === "case" && !isAuthenticated && "authHint" in content && (
        <p className="mt-6 text-xs text-[var(--text-tertiary)]">
          Have an account?{" "}
          <Link
            to="/login"
            className="text-[var(--text-accent)] hover:text-[var(--text-accent-hover)]"
          >
            Log in
          </Link>{" "}
          to access your consultations.
        </p>
      )}
    </div>
  );
}
