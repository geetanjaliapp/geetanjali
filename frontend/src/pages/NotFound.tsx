import { useState } from "react";
import { Link } from "react-router-dom";
import { formatSanskritLines, isSpeakerIntro } from "../lib/sanskritFormatter";
import { Navbar } from "../components";
import { useSEO } from "../hooks";

// Top 5 most famous Geeta verses - embedded statically to avoid API calls
// Source: Correlated from multiple sources (shlokam.org, templepurohit.com, holy-bhagavad-gita.org)
const FAMOUS_VERSES = [
  {
    canonical_id: "BG_2_47",
    chapter: 2,
    verse: 47,
    sanskrit_devanagari:
      "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\n\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि।।2.47।।",
    paraphrase_en:
      "Focus on executing your responsibilities diligently without obsessing over outcomes. Commit fully to action while detaching from results, avoiding procrastination and passivity.",
  },
  {
    canonical_id: "BG_18_66",
    chapter: 18,
    verse: 66,
    sanskrit_devanagari:
      "सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज।अहं त्वा सर्वपापेभ्यो मोक्षयिष्यामि मा शुचः।।18.66।।",
    paraphrase_en:
      "Surrender rigid protocols; trust your core principles. Release perfectionism and guilt. Decisive leaders embrace simplicity over complexity to achieve meaningful results.",
  },
  {
    canonical_id: "BG_4_7",
    chapter: 4,
    verse: 7,
    sanskrit_devanagari:
      "यदा यदा हि धर्मस्य ग्लानिर्भवति भारत।\n\nअभ्युत्थानमधर्मस्य तदाऽऽत्मानं सृजाम्यहम्।।4.7।।",
    paraphrase_en:
      "When righteousness declines and unrighteousness rises, leaders must take decisive action to restore ethical order and moral values in their organizations and society.",
  },
  {
    canonical_id: "BG_2_22",
    chapter: 2,
    verse: 22,
    sanskrit_devanagari:
      "वासांसि जीर्णानि यथा विहाय\n\nनवानि गृह्णाति नरोऽपराणि।\n\nतथा शरीराणि विहाय जीर्णा\n\nन्यन्यानि संयाति नवानि देही।।2.22।।",
    paraphrase_en:
      "Leaders must release outdated strategies and embrace new approaches to remain effective, understanding that organizational evolution requires letting go of what no longer serves progress.",
  },
  {
    canonical_id: "BG_2_48",
    chapter: 2,
    verse: 48,
    sanskrit_devanagari:
      "योगस्थः कुरु कर्माणि सङ्गं त्यक्त्वा धनञ्जय।\n\nसिद्ध्यसिद्ध्योः समो भूत्वा समत्वं योग उच्यते।।2.48।।",
    paraphrase_en:
      "Perform your duties with detachment from outcomes, maintaining mental balance through success and failure. This equanimity is the essence of effective leadership and decision-making.",
  },
];

export default function NotFound() {
  useSEO({
    title: "Page Not Found",
    description: "The page you are looking for does not exist.",
    noIndex: true, // 404 pages shouldn't be indexed
  });

  // Select a random verse once on mount (useState initializer runs only once)
  const [verse] = useState(
    () => FAMOUS_VERSES[Math.floor(Math.random() * FAMOUS_VERSES.length)],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <Navbar />
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "calc(100vh - 64px)" }}
      >
        <div className="text-center max-w-2xl px-4">
          {/* Logo */}
          <img
            src="/logo.svg"
            alt="Geetanjali"
            loading="lazy"
            className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 mx-auto mb-4 sm:mb-6 lg:mb-8"
          />

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 sm:mb-6 lg:mb-8">
            The Path You Seek is Elsewhere
          </h1>

          {/* Verse Card - Clickable */}
          <Link
            to={`/verses/${verse.canonical_id}`}
            className="bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 border border-amber-200/50 mb-4 sm:mb-6 lg:mb-8 hover:bg-white/90 hover:border-amber-300/70 transition-all shadow-lg hover:shadow-xl block cursor-pointer"
          >
            {/* Om Symbol */}
            <div className="text-3xl sm:text-4xl text-amber-400/50 mb-3 sm:mb-4 font-light">
              ॐ
            </div>

            {/* Sanskrit - Full Verse with proper formatting */}
            <div className="mb-4 sm:mb-6 text-center">
              <div className="text-lg sm:text-2xl md:text-3xl font-serif text-amber-900 leading-relaxed tracking-wide mb-3 sm:mb-4">
                {formatSanskritLines(verse.sanskrit_devanagari).map(
                  (line, idx) => (
                    <p
                      key={idx}
                      className={`${isSpeakerIntro(line) ? "text-base sm:text-xl text-amber-700/60 mb-2 sm:mb-3" : "mb-1 sm:mb-2"}`}
                    >
                      {line}
                    </p>
                  ),
                )}
              </div>
              <div className="text-amber-600/70 text-xs sm:text-sm font-serif">
                ॥ {verse.chapter}.{verse.verse} ॥
              </div>
            </div>

            {/* English paraphrase */}
            <p className="text-sm sm:text-base text-gray-800 leading-relaxed italic border-t border-amber-200/50 pt-3 sm:pt-4">
              "{verse.paraphrase_en}"
            </p>
          </Link>

          {/* Philosophical Message */}
          <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-4 sm:mb-6 lg:mb-8 max-w-xl mx-auto">
            Uncertainty is the first step toward clarity.
          </p>

          {/* CTA Button */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-orange-600 text-white px-5 sm:px-6 lg:px-8 py-2.5 sm:py-3 rounded-lg hover:bg-orange-700 transition-colors font-semibold text-sm sm:text-base lg:text-lg"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
