import { Link } from 'react-router-dom';
import type { Verse, Translation } from '../types';

/**
 * Format Sanskrit text - removes verse number metadata
 */
function formatSanskrit(text: string): string {
  if (!text) return '';
  // Remove the verse number at the end (e.g., ।।2.52।। or ॥2.52॥)
  return text.replace(/[।॥]+\d+\.\d+[।॥]+\s*$/, '').replace(/\n\n+/g, '\n').trim();
}

/**
 * Clean translation text - removes verse numbers and extra formatting
 */
function cleanTranslation(text: string): string {
  if (!text) return '';
  // Remove leading/trailing verse numbers in any format
  let cleaned = text.replace(/^[।॥]+\d+\.\d+[।॥]+\s*/, '').replace(/\s*[।॥]+\d+\.\d+[।॥]+$/, '');
  // Remove opening quote if present
  cleaned = cleaned.replace(/^"/, '');
  return cleaned.trim();
}

interface FeaturedVerseProps {
  verse: Verse;
  translations?: Translation[];
  loading?: boolean;
}

export function FeaturedVerse({ verse, translations = [], loading = false }: FeaturedVerseProps) {

  // Get Hindi and English translations
  const hindiTranslations = translations.filter(t => t.language === 'hindi' || t.translator === 'Swami Tejomayananda');
  const englishTranslations = translations.filter(t => t.language === 'en' || t.language === 'english');

  const primaryHindi = hindiTranslations.length > 0 ? hindiTranslations[0].text : '';
  const primaryEnglish = verse.translation_en || englishTranslations.find(t => t.translator === 'Swami Gambirananda')?.text || englishTranslations[0]?.text || '';

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-2xl p-12 border border-amber-200/50 shadow-xl">
          <div className="text-center space-y-4">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-24 mx-auto" />
            <div className="h-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!verse) {
    return null;
  }

  const verseRef = `${verse.chapter}.${verse.verse}`;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Main Featured Verse Container */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-2xl p-12 border border-amber-200/50 shadow-xl hover:shadow-2xl transition-shadow">
        {/* Header - Verse Reference */}
        <div className="text-center mb-8">
          <div className="inline-block text-xs font-semibold text-amber-700 uppercase tracking-wider bg-amber-100/60 px-4 py-1 rounded-full mb-3">
            Verse of the Day
          </div>
          <p className="text-amber-600/70 font-serif text-lg">॥ {verseRef} ॥</p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* 1. Sanskrit Devanagari - Spotlight */}
          {verse.sanskrit_devanagari && (
            <div className="text-center">
              <div className="text-3xl text-amber-400/40 mb-4 font-light">ॐ</div>
              <p className="text-2xl md:text-3xl font-serif text-amber-900 leading-relaxed tracking-wide">
                {formatSanskrit(verse.sanskrit_devanagari)}
              </p>
            </div>
          )}

          {/* Visual Separator */}
          <div className="flex justify-center items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber-300/50" />
            <span className="text-amber-400/50 text-sm">।</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-amber-300/50" />
          </div>

          {/* 2. English Translation */}
          {primaryEnglish && (
            <div className="text-center">
              <p className="text-xs font-semibold text-amber-700/60 uppercase tracking-widest mb-3">
                English Translation
              </p>
              <p className="text-lg md:text-xl text-gray-800 leading-relaxed italic">
                "{cleanTranslation(primaryEnglish)}"
              </p>
            </div>
          )}

          {/* 3. Hindi Translation */}
          {primaryHindi && (
            <div className="text-center">
              <p className="text-xs font-semibold text-amber-700/60 uppercase tracking-widest mb-3">
                हिंदी अनुवाद
              </p>
              <p className="text-lg md:text-xl text-gray-800 leading-relaxed">
                "{cleanTranslation(primaryHindi)}"
              </p>
            </div>
          )}

          {/* Visual Separator */}
          <div className="flex justify-center">
            <span className="text-amber-400/50">॥</span>
          </div>

          {/* Paraphrase - Leadership Insight */}
          {verse.paraphrase_en && (
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-amber-100/50">
              <p className="text-xs font-semibold text-red-700/70 uppercase tracking-widest mb-3">
                Leadership Insight
              </p>
              <p className="text-lg text-gray-800 leading-relaxed italic">
                "{verse.paraphrase_en}"
              </p>
            </div>
          )}
        </div>

        {/* CTA - Read Full Verse */}
        <div className="text-center mt-8">
          <Link
            to={`/verses/${verse.canonical_id}`}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold px-8 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl"
          >
            Read Full Verse
            <span className="text-lg">→</span>
          </Link>
        </div>
      </div>

      {/* Additional Info */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-600">
          Explore more verses and their meanings
        </p>
      </div>
    </div>
  );
}

export default FeaturedVerse;
