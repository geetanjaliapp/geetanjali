import { useState } from "react";
import { Link } from "react-router-dom";
import { getVersePath } from "../lib/sanskritFormatter";
import { INSPIRATION_VERSES } from "../constants/curatedVerses";

interface InspirationVerseProps {
  className?: string;
}

/**
 * Inspiration Verse component
 * Displays a randomly selected short verse to inspire users before they describe their dilemma.
 * Shows the full verse text without truncation.
 */
export function InspirationVerse({ className = "" }: InspirationVerseProps) {
  // Select one random verse on mount (stable for component lifetime)
  const [verse] = useState(
    () =>
      INSPIRATION_VERSES[Math.floor(Math.random() * INSPIRATION_VERSES.length)],
  );

  const verseLink = getVersePath(verse.ref);

  return (
    <div className={`text-center max-w-2xl mx-auto ${className}`}>
      <p className="text-[var(--text-secondary)] text-sm sm:text-base leading-relaxed">
        <span className="italic">"{verse.text}"</span>
        <span className="mx-1">—</span>
        <Link
          to={verseLink}
          className="text-[var(--text-accent)] hover:text-[var(--text-accent-hover)] hover:underline whitespace-nowrap"
        >
          {verse.ref}
        </Link>
      </p>
    </div>
  );
}

export default InspirationVerse;
