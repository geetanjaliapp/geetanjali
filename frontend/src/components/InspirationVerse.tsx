import { useState } from "react";
import { Link } from "react-router-dom";
import { getVersePath } from "../lib/sanskritFormatter";

interface InspirationVerseProps {
  className?: string;
}

// 5 curated short wisdom verses for decision-making inspiration
const INSPIRATION_VERSES = [
  {
    ref: "BG 2.47",
    text: "You have the right to work, but never to the fruit of work.",
  },
  {
    ref: "BG 2.48",
    text: "Perform work in this world, Arjuna, as a man established within himself.",
  },
  {
    ref: "BG 3.35",
    text: "It is better to do one's own duty imperfectly than another's duty perfectly.",
  },
  {
    ref: "BG 6.5",
    text: "Elevate yourself through the power of your mind, and not degrade yourself.",
  },
  {
    ref: "BG 18.63",
    text: "Reflect on this fully, and then do as you wish.",
  },
];

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
