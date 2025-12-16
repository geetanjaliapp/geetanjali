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
    <div className={`text-center ${className}`}>
      <blockquote className="text-gray-600 italic text-sm sm:text-base">
        "{verse.text}"
      </blockquote>
      <Link
        to={verseLink}
        className="text-xs text-orange-600 hover:text-orange-700 hover:underline mt-1 inline-block"
      >
        — {verse.ref}
      </Link>
    </div>
  );
}

export default InspirationVerse;
