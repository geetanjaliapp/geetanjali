import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { versesApi } from "../lib/api";
import type { Verse } from "../types";
import { FeaturedVerse } from "../components/FeaturedVerse";
import { Footer } from "../components/Footer";
import { Navbar, NewsletterCard } from "../components";
import { useSEO } from "../hooks";

// Kept identical to backend/templates/seo/daily.html, which crawlers are served at this URL.
// No verse number in it: search engines cache snippets for days.
const TITLE = "Bhagavad Gita Verse of the Day – Daily Quote";
const DESCRIPTION =
  "A new verse from the Bhagavad Gita every day: Sanskrit, transliteration and a plain-English meaning. Read today's verse, or get it daily by email or RSS.";

/**
 * Today's verse, for people arriving from "verse/quote of the day" searches.
 *
 * Shows no date: the verse rolls over at midnight UTC, which is not the reader's midnight,
 * so any local date printed here would be wrong for part of every day.
 */
export default function DailyVerse() {
  useSEO({ title: TITLE, description: DESCRIPTION, canonical: "/daily" });
  const [verse, setVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    versesApi
      .getDaily()
      .then((data) => {
        if (!cancelled) setVerse(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-[var(--gradient-page-from)] to-[var(--gradient-page-to)] flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <header className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-[var(--text-primary)]">
            Verse of the Day
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)]">
            One verse from the Bhagavad Gita, new each day.
          </p>
        </header>

        <FeaturedVerse verse={verse} loading={loading} error={error} />

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Facing a decision this speaks to?{" "}
          <Link
            to="/cases/new"
            className="text-[var(--text-link)] hover:underline"
          >
            Ask for guidance
          </Link>
        </p>

        <div className="mt-8 sm:mt-10">
          <NewsletterCard />
          <p className="mt-3 text-center text-xs text-[var(--text-tertiary)]">
            Or follow by{" "}
            <a href="/feed.xml" className="hover:underline">
              RSS
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
