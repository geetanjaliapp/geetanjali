import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { versesApi } from '../lib/api';
import type { Verse, Translation } from '../types';
import { Navbar } from '../components/Navbar';
import { errorMessages } from '../lib/errorMessages';

// Translator priority order (1 = highest)
const TRANSLATOR_PRIORITY: Record<string, number> = {
  'Swami Gambirananda': 1,
  'Swami Adidevananda': 2,
  'Swami Sivananda': 3,
  'Dr. S. Sankaranarayan': 4,
  'Shri Purohit Swami': 5,
};

// Principle taxonomy with labels and descriptions
const PRINCIPLE_TAXONOMY: Record<string, { label: string; description: string }> = {
  duty_focus: {
    label: 'Duty-focused action',
    description: 'Act based on dharma and responsibility, not on desired outcomes.',
  },
  detachment: {
    label: 'Non-attachment to outcomes',
    description: 'Emphasize process over results. Perform actions without attachment.',
  },
  self_control: {
    label: 'Leader temperament',
    description: 'Cultivate self-discipline, mental clarity, and personal integrity.',
  },
  informed_choice: {
    label: 'Autonomous decision-making',
    description: 'Make decisions with full knowledge and freedom.',
  },
  role_fit: {
    label: 'Fit tasks to nature',
    description: 'Match responsibilities to natural capabilities and strengths.',
  },
  compassion: {
    label: 'Compassionate equilibrium',
    description: 'Minimize harm and balance stakeholder needs with empathy.',
  },
  self_responsibility: {
    label: 'Self-effort and example',
    description: 'Lead through personal action and take responsibility for growth.',
  },
  ethical_character: {
    label: 'Character traits',
    description: 'Filter actions through virtuous qualities like truthfulness and courage.',
  },
  consistent_duty: {
    label: 'Consistent performance',
    description: 'Perform duties regularly. Avoid impulsive or erratic behavior.',
  },
};

// Sort translations by priority
function sortTranslations(translations: Translation[]): Translation[] {
  return [...translations].sort((a, b) => {
    const priorityA = a.translator ? (TRANSLATOR_PRIORITY[a.translator] || 99) : 99;
    const priorityB = b.translator ? (TRANSLATOR_PRIORITY[b.translator] || 99) : 99;
    return priorityA - priorityB;
  });
}

/**
 * Format Sanskrit text to display with proper line breaks
 * - Separates speaker intros (श्री भगवानुवाच, धृतराष्ट्र उवाच, etc.) on their own line
 * - Splits verse content on single danda (।) and adds proper spacing
 * - Uses alternating danda pattern: single (।), double (॥), single (।), double (॥)
 */
function formatSanskritLines(text: string): string[] {
  if (!text) return [];

  // Remove the verse number at the end (e.g., ।।2.52।। or ॥2.52॥)
  const withoutVerseNum = text.replace(/[।॥]+\d+\.\d+[।॥]+\s*$/, '');

  // Split by newlines to detect speaker intro lines
  const lines = withoutVerseNum.split('\n').map(l => l.trim()).filter(l => l);

  const result: string[] = [];

  let verseLineIndex = 0;

  // Process each line
  for (const line of lines) {
    // Check if this line contains speaker intro (contains वाच - said/spoke)
    if (line.includes('वाच')) {
      // This is a speaker intro line, add it as-is
      result.push(line);
    } else {
      // This is verse content, split on danda
      const parts = line.split(/।(?=[^।])/);

      // Alternate between single (।) and double (॥) danda for each verse line
      // Odd verse lines (1st, 3rd, etc.) get single danda
      // Even verse lines (2nd, 4th, etc.) get double danda
      const isEvenLine = (verseLineIndex + 1) % 2 === 0;
      const endDanda = isEvenLine ? ' ॥' : ' ।';

      if (parts.length >= 2) {
        // Multiple clauses in this line
        for (let i = 0; i < parts.length - 1; i++) {
          result.push(parts[i].trim() + ' ।');
        }
        result.push(parts[parts.length - 1].replace(/।+\s*$/, '').trim() + endDanda);
      } else {
        // Single clause
        result.push(line.replace(/।+\s*$/, '').trim() + endDanda);
      }

      verseLineIndex++;
    }
  }

  return result.length > 0 ? result : [text.trim()];
}


export default function VerseDetail() {
  const { canonicalId } = useParams<{ canonicalId: string }>();
  const [verse, setVerse] = useState<Verse | null>(null);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canonicalId) return;

    const loadVerseDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load verse and translations in parallel
        const [verseData, translationsData] = await Promise.all([
          versesApi.get(canonicalId),
          versesApi.getTranslations(canonicalId).catch(() => []),
        ]);

        setVerse(verseData);
        setTranslations(sortTranslations(translationsData));
      } catch (err) {
        setError(errorMessages.verseLoad(err));
      } finally {
        setLoading(false);
      }
    };

    loadVerseDetails();
  }, [canonicalId]);

  // Format canonical ID for display (BG_2_47 -> 2.47)
  const formatVerseId = (id: string) => id.replace('BG_', '').replace(/_/g, '.');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600">Loading verse...</div>
        </div>
      </div>
    );
  }

  if (error || !verse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 mb-4">{error || 'Verse not found'}</p>
            <Link to="/verses" className="text-red-600 hover:text-red-700">
              ← Back to Verses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      <Navbar />
      <div className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Back Link */}
          <div className="mb-6">
            <Link to="/verses" className="text-red-600 hover:text-red-700 font-medium">
              ← Back to Verses
            </Link>
          </div>

          {/* Verse Header */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="flex items-baseline gap-4 mb-6">
              <h1 className="text-3xl font-bold text-gray-900">
                {formatVerseId(verse.canonical_id)}
              </h1>
              <span className="text-lg text-orange-600 font-medium">
                Chapter {verse.chapter}, Verse {verse.verse}
              </span>
            </div>

            {/* Sanskrit Devanagari */}
            {verse.sanskrit_devanagari && (
              <div className="mb-6 bg-gradient-to-b from-orange-50 to-amber-50 rounded-xl p-8 border-2 border-amber-200/50 shadow-inner">
                {/* Decorative Om */}
                <div className="text-center text-amber-400/50 text-3xl font-light mb-4">ॐ</div>
                <div className="text-2xl text-amber-800/60 font-serif leading-relaxed text-center tracking-wide">
                  {formatSanskritLines(verse.sanskrit_devanagari).map((line, idx) => {
                    // Check if this is a speaker intro line (contains वाच)
                    const isSpeakerIntro = line.includes('वाच');

                    return (
                      <p key={idx} className={`${isSpeakerIntro ? 'text-lg text-amber-600/60 mb-3' : 'mb-1'}`}>
                        {line}
                      </p>
                    );
                  })}
                </div>
                {/* Decorative Verse Reference - closure */}
                <div className="text-center text-amber-600/70 text-sm font-medium mt-4">
                  ॥ {verse.chapter}.{verse.verse} ॥
                </div>
              </div>
            )}

            {/* Sanskrit IAST (Romanized) */}
            {verse.sanskrit_iast && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Romanized (IAST)
                </h2>
                <p className="text-lg text-gray-700 italic leading-relaxed">
                  {verse.sanskrit_iast}
                </p>
              </div>
            )}

            {/* Primary Translation */}
            {verse.translation_en && (
              <div className="mb-6 bg-orange-50 rounded-xl p-6 border border-orange-100">
                <h2 className="text-sm font-semibold text-orange-700 uppercase tracking-wide mb-2">
                  Translation
                </h2>
                <p className="text-lg text-gray-800 leading-relaxed">
                  {verse.translation_en}
                </p>
                {verse.source && (
                  <p className="text-sm text-gray-500 mt-3">
                    <a
                      href={verse.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-600 hover:text-orange-700 hover:underline"
                    >
                      View source
                    </a>
                  </p>
                )}
              </div>
            )}

            {/* Paraphrase / Leadership Summary */}
            {verse.paraphrase_en && (
              <div className="mb-6 bg-red-50 rounded-xl p-6 border border-red-100">
                <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-2">
                  Leadership Insight
                </h2>
                <p className="text-lg text-gray-800 leading-relaxed italic">
                  "{verse.paraphrase_en}"
                </p>
              </div>
            )}

            {/* Consulting Principles - Enhanced Cards */}
            {verse.consulting_principles && verse.consulting_principles.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Consulting Principles
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {verse.consulting_principles.map((principleId, idx) => {
                    const principle = PRINCIPLE_TAXONOMY[principleId];
                    return (
                      <div
                        key={idx}
                        className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200 hover:border-orange-300 hover:shadow-md transition-all"
                      >
                        <h3 className="font-semibold text-orange-800 mb-2">
                          {principle?.label || principleId}
                        </h3>
                        {principle?.description && (
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {principle.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Translations Section */}
          {translations.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Translations ({translations.length})
              </h2>
              <div className="space-y-8">
                {translations.map((translation, index) => (
                  <div
                    key={translation.id}
                    className="border-l-4 border-orange-400 pl-6 py-3"
                  >
                    {/* Translation text - more prominent */}
                    <p className="text-lg text-gray-800 leading-relaxed mb-4">
                      {translation.text}
                    </p>
                    {/* Translator info */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      {translation.translator && (
                        <span className="font-medium text-gray-700">
                          — {translation.translator}
                        </span>
                      )}
                      {translation.school && (
                        <span className="text-gray-500">
                          {translation.school}
                        </span>
                      )}
                      {translation.source && (
                        <a
                          href={translation.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:text-orange-700 hover:underline"
                        >
                          Source
                        </a>
                      )}
                    </div>
                    {/* Subtle divider between translations (except last) */}
                    {index < translations.length - 1 && (
                      <div className="mt-6 border-b border-gray-100" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation to adjacent verses */}
          <div className="mt-8 flex justify-between items-center">
            {verse.verse > 1 ? (
              <Link
                to={`/verses/BG_${verse.chapter}_${verse.verse - 1}`}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                ← Previous Verse
              </Link>
            ) : verse.chapter > 1 ? (
              <Link
                to={`/verses?chapter=${verse.chapter - 1}`}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                ← Previous Chapter
              </Link>
            ) : (
              <div />
            )}
            <Link
              to={`/verses/BG_${verse.chapter}_${verse.verse + 1}`}
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Next Verse →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
