import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { versesApi } from '../lib/api';
import { formatSanskritLines, isSpeakerIntro } from '../lib/sanskritFormatter';
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
              {/* Om Symbol */}
              <div className="text-4xl text-amber-400/50 mb-4 font-light">ॐ</div>

              {/* Sanskrit - Full Verse with proper formatting */}
              {verse.sanskrit_devanagari && (
                <div className="mb-6 text-center">
                  <div className="text-2xl md:text-3xl font-serif text-amber-900 leading-relaxed tracking-wide mb-4">
                    {formatSanskritLines(verse.sanskrit_devanagari).map((line, idx) => (
                      <p key={idx} className={`${isSpeakerIntro(line) ? 'text-xl text-amber-700/60 mb-3' : 'mb-2'}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                  <div className="text-amber-600/70 text-sm font-serif">
                    ॥ {verse.chapter}.{verse.verse} ॥
                  </div>
                </div>
              )}

              {/* English paraphrase */}
              {verse.paraphrase_en && (
                <p className="text-base text-gray-800 leading-relaxed italic border-t border-amber-200/50 pt-4">
                  "{verse.paraphrase_en}"
                </p>
              )}
            </Link>
          ) : (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-amber-200/50 mb-8">
              <p className="text-base text-gray-700 italic">
                Being lost is where wisdom begins.
              </p>
            </div>
          )}

          {/* Philosophical Message */}
          <p className="text-base text-gray-700 leading-relaxed mb-8 max-w-xl mx-auto">
            Uncertainty is the first step toward clarity.
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
