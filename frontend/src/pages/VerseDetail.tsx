import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { versesApi } from '../lib/api';
import { formatSanskritLines, isSpeakerIntro } from '../lib/sanskritFormatter';
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


export default function VerseDetail() {
  const { canonicalId } = useParams<{ canonicalId: string }>();
  const [verse, setVerse] = useState<Verse | null>(null);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllTranslations, setShowAllTranslations] = useState(true);

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

  // Separate Hindi and English translations
  const hindiTranslations = translations.filter(
    t => t.language === 'hindi' || t.translator === 'Swami Tejomayananda'
  );
  const englishTranslations = translations.filter(
    t => t.language === 'en' || t.language === 'english' || (t.language && !t.language.includes('hindi'))
  );
  const primaryHindi = hindiTranslations[0];
  const primaryEnglish =englishTranslations.find(t => t.translator === 'Swami Gambirananda') || englishTranslations[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      <Navbar />
      <div className="flex-1 py-8">
        <div className="max-w-5xl mx-auto px-4">
          {/* Back Link */}
          <div className="mb-6">
            <Link to="/verses" className="text-red-600 hover:text-red-700 font-medium text-sm">
              ← Back to Verses
            </Link>
          </div>

          {/* Main Spotlight Section */}
          <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-3xl shadow-2xl p-12 mb-8 border border-amber-200/50">
            {/* Sanskrit Spotlight */}
            {verse.sanskrit_devanagari && (
              <div className="mb-8 text-center pt-4">
                <div className="text-4xl text-amber-400/50 mb-6 font-light">ॐ</div>
                <div className="text-3xl md:text-4xl font-serif text-amber-900/70 leading-relaxed tracking-wide mb-6">
                  {formatSanskritLines(verse.sanskrit_devanagari).map((line, idx) => (
                    <p key={idx} className={`${isSpeakerIntro(line) ? 'text-2xl text-amber-700/60 mb-4' : 'mb-2'}`}>
                      {line}
                    </p>
                  ))}
                </div>
                <div className="text-amber-600/70 text-lg font-serif">॥ {verse.chapter}.{verse.verse} ॥</div>
              </div>
            )}

            {/* Leadership Insight - Prominent */}
            {verse.paraphrase_en && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-amber-100/50 mb-8">
                <p className="text-xs font-semibold text-red-700/70 uppercase tracking-widest mb-4">
                  Leadership Insight
                </p>
                <p className="text-lg md:text-xl text-gray-800 leading-relaxed italic">
                  "{verse.paraphrase_en}"
                </p>
              </div>
            )}

            {/* Consulting Principles - Prominent */}
            {verse.consulting_principles && verse.consulting_principles.length > 0 && (
              <div className="mb-8">
                <p className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest mb-4">
                  Consulting Principles
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {verse.consulting_principles.map((principleId) => {
                    const principle = PRINCIPLE_TAXONOMY[principleId];
                    return (
                      <div
                        key={principleId}
                        className="bg-white/70 backdrop-blur-sm rounded-lg p-5 border border-orange-100/50 hover:border-orange-200 hover:bg-white/90 transition-all shadow-sm"
                      >
                        <h3 className="font-semibold text-orange-800 text-base mb-2">
                          {principle?.label || principleId}
                        </h3>
                        {principle?.description && (
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {principle.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />

            {/* Translations - Side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Hindi Translation */}
              {primaryHindi && (
                <div>
                  <p className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest mb-4">
                    हिंदी अनुवाद
                  </p>
                  <p className="text-lg text-gray-800 leading-relaxed italic">
                    "{primaryHindi.text}"
                  </p>
                  {primaryHindi.translator && (
                    <p className="text-sm text-gray-600 mt-4">
                      — {primaryHindi.translator}
                    </p>
                  )}
                </div>
              )}

              {/* English Translation */}
              {primaryEnglish && (
                <div>
                  <p className="text-xs font-semibold text-amber-700/70 uppercase tracking-widest mb-4">
                    English Translation
                  </p>
                  <p className="text-lg text-gray-800 leading-relaxed italic">
                    "{primaryEnglish.text}"
                  </p>
                  {primaryEnglish.translator && (
                    <p className="text-sm text-gray-600 mt-4">
                      — {primaryEnglish.translator}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Translations Section - Toggle Switch */}
          {translations.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Translations</h2>
                <button
                  onClick={() => setShowAllTranslations(!showAllTranslations)}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    showAllTranslations ? 'bg-amber-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      showAllTranslations ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {showAllTranslations && (
                <div className="space-y-8 animate-in fade-in duration-200">
                  {translations.map((translation, index) => (
                    <div key={translation.id}>
                      <div className="border-l-4 border-amber-300 pl-6 py-3">
                        <p className="text-lg text-gray-800 leading-relaxed mb-3">
                          "{translation.text}"
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                          {translation.translator && (
                            <span className="font-medium">— {translation.translator}</span>
                          )}
                          {translation.school && (
                            <span>{translation.school}</span>
                          )}
                        </div>
                      </div>
                      {index < translations.length - 1 && (
                        <div className="mt-6 border-b border-gray-100" />
                      )}
                    </div>
                  ))}
                </div>
              )}
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
