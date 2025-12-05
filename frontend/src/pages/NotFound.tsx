import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { versesApi } from '../lib/api';
import type { Verse } from '../types';
import { Navbar } from '../components/Navbar';

// Sample Sanskrit verses about finding the right path
const PATH_VERSES = ['BG_2_48', 'BG_18_63', 'BG_6_25'];

export default function NotFound() {
  const [verse, setVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Randomly select a verse
    const randomVerse = PATH_VERSES[Math.floor(Math.random() * PATH_VERSES.length)];

    versesApi
      .get(randomVerse)
      .then(setVerse)
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <Navbar />
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <div className="text-center max-w-2xl px-4">
          {/* Om Symbol */}
          <div className="text-5xl text-amber-400/50 mb-6 font-light">ॐ</div>

          {/* Logo */}
          <img src="/logo.svg" alt="Geetanjali" className="h-24 w-24 mx-auto mb-8" />

          {/* Heading */}
          <h1 className="text-4xl font-bold text-gray-900 mb-8">The Path You Seek is Elsewhere</h1>

          {/* Verse Card - Clickable */}
          {!loading && verse ? (
            <Link
              to={`/verses/${verse.canonical_id}`}
              className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-amber-200/50 mb-8 hover:bg-white/90 hover:border-amber-300/70 transition-all shadow-lg hover:shadow-xl block cursor-pointer"
            >
              {/* Sanskrit */}
              {verse.sanskrit_devanagari && (
                <div className="mb-6 text-center">
                  <div className="text-2xl md:text-3xl font-serif text-amber-900 leading-relaxed tracking-wide mb-2">
                    {verse.sanskrit_devanagari.split('\n')[0]}
                  </div>
                  <div className="text-amber-600/70 text-sm font-serif">
                    ॥ {verse.chapter}.{verse.verse} ॥
                  </div>
                </div>
              )}

              {/* English paraphrase */}
              {verse.paraphrase_en && (
                <p className="text-base md:text-lg text-gray-800 leading-relaxed italic mb-4">
                  "{verse.paraphrase_en}"
                </p>
              )}

              {/* CTA hint */}
              <p className="text-sm text-amber-700 font-medium">
                Click to read the full verse →
              </p>
            </Link>
          ) : (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-amber-200/50 mb-8">
              <p className="text-base text-gray-700 italic">
                Sometimes uncertainty is where wisdom begins. The Geeta teaches that being lost is the first step to being found.
              </p>
            </div>
          )}

          {/* Philosophical Message */}
          <p className="text-base md:text-lg text-gray-800 leading-relaxed mb-8 max-w-xl mx-auto">
            Just as Arjuna stood uncertain on the battlefield, you too can find clarity. The page you seek may not exist here, but the wisdom you need awaits elsewhere.
          </p>

          {/* CTA Button */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold text-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
