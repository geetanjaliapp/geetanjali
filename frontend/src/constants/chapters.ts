/**
 * Bhagavad Geeta Chapter Constants
 *
 * Static mapping of chapter metadata including names (Sanskrit and English),
 * and verse counts. This data is immutable - the Bhagavad Geeta has exactly
 * 18 chapters with fixed verse counts.
 *
 * Used by VerseDetail, Reading Mode, and related verse navigation components.
 */

export const CHAPTERS = {
  1: {
    name: "Arjuna Vishada Yoga",
    shortName: "Arjuna's Grief",
    verses: 47,
  },
  2: {
    name: "Sankhya Yoga",
    shortName: "Sankhya Yoga",
    verses: 72,
  },
  3: {
    name: "Karma Yoga",
    shortName: "Karma Yoga",
    verses: 43,
  },
  4: {
    name: "Jnana Karma Sanyasa Yoga",
    shortName: "Knowledge & Action",
    verses: 42,
  },
  5: {
    name: "Karma Sanyasa Yoga",
    shortName: "Renunciation",
    verses: 29,
  },
  6: {
    name: "Dhyana Yoga",
    shortName: "Meditation",
    verses: 47,
  },
  7: {
    name: "Jnana Vijnana Yoga",
    shortName: "Knowledge & Wisdom",
    verses: 30,
  },
  8: {
    name: "Aksara Brahma Yoga",
    shortName: "Imperishable Brahman",
    verses: 28,
  },
  9: {
    name: "Raja Vidya Raja Guhya Yoga",
    shortName: "Royal Knowledge",
    verses: 34,
  },
  10: {
    name: "Vibhuti Yoga",
    shortName: "Divine Glories",
    verses: 42,
  },
  11: {
    name: "Visvarupa Darsana Yoga",
    shortName: "Universal Form",
    verses: 55,
  },
  12: {
    name: "Bhakti Yoga",
    shortName: "Devotion",
    verses: 20,
  },
  13: {
    name: "Ksetra Ksetrajna Vibhaga Yoga",
    shortName: "Field & Knower",
    verses: 35,
  },
  14: {
    name: "Gunatraya Vibhaga Yoga",
    shortName: "Three Gunas",
    verses: 27,
  },
  15: {
    name: "Purusottama Yoga",
    shortName: "Supreme Person",
    verses: 20,
  },
  16: {
    name: "Daivasura Sampad Vibhaga Yoga",
    shortName: "Divine & Demonic",
    verses: 24,
  },
  17: {
    name: "Sraddhatraya Vibhaga Yoga",
    shortName: "Three Faiths",
    verses: 28,
  },
  18: {
    name: "Moksa Sanyasa Yoga",
    shortName: "Liberation",
    verses: 78,
  },
} as const;

export type ChapterNumber = keyof typeof CHAPTERS;

/**
 * Get chapter info by chapter number
 * Returns undefined if chapter is invalid
 */
export function getChapterInfo(chapter: number) {
  return CHAPTERS[chapter as ChapterNumber];
}

/**
 * Get chapter name (full Sanskrit name)
 */
export function getChapterName(chapter: number): string {
  const info = getChapterInfo(chapter);
  return info?.name ?? `Chapter ${chapter}`;
}

/**
 * Get chapter short name (English translation)
 */
export function getChapterShortName(chapter: number): string {
  const info = getChapterInfo(chapter);
  return info?.shortName ?? `Chapter ${chapter}`;
}

/**
 * Get total verse count for a chapter
 */
export function getChapterVerseCount(chapter: number): number {
  const info = getChapterInfo(chapter);
  return info?.verses ?? 0;
}

/**
 * Calculate verse progress within a chapter
 * Returns position, total, and percentage
 */
export function getVerseProgress(chapter: number, verse: number) {
  const info = getChapterInfo(chapter);
  if (!info) {
    return { position: verse, total: 0, percentage: 0 };
  }
  return {
    position: verse,
    total: info.verses,
    percentage: Math.round((verse / info.verses) * 100),
  };
}

/**
 * Check if a verse exists in a chapter
 */
export function isValidVerse(chapter: number, verse: number): boolean {
  const info = getChapterInfo(chapter);
  if (!info) return false;
  return verse >= 1 && verse <= info.verses;
}

/**
 * Get the total number of chapters (always 18)
 */
export const TOTAL_CHAPTERS = 18;

/**
 * Get the total number of verses in the Bhagavad Geeta (701)
 */
export const TOTAL_VERSES = Object.values(CHAPTERS).reduce(
  (sum, ch) => sum + ch.verses,
  0,
);
