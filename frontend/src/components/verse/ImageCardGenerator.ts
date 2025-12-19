/**
 * ImageCardGenerator - Canvas-based verse image generation
 *
 * Visual parity with FeaturedVerse component:
 * - ॐ (Om) symbol at top
 * - Sanskrit text with proper formatting
 * - ॥ chapter.verse ॥ reference
 * - English paraphrase
 * - Hindi translation (for formats with space)
 * - Geetanjali branding
 */

import { formatSanskritLines } from "../../lib/sanskritFormatter";

// Types
export type ImageTheme = "warm" | "dark" | "minimal";
export type ImageFormat = "square" | "portrait" | "wide";

export interface ImageCardOptions {
  sanskrit: string;
  paraphrase: string;
  hindi?: string;
  chapter: number;
  verse: number;
  theme: ImageTheme;
  format: ImageFormat;
  showHindi: boolean;
}

interface ThemeColors {
  background: string | CanvasGradient;
  om: string;
  sanskrit: string;
  verseRef: string;
  english: string;
  hindi: string;
  branding: string;
  divider: string;
  border?: string;
}

interface FormatConfig {
  width: number;
  height: number;
  includeHindi: boolean;
  includeEnglish: boolean;
  fontScale: number;
}

// Fixed aspect ratio formats
const FORMAT_CONFIG: Record<ImageFormat, FormatConfig> = {
  square: {
    width: 1080,
    height: 1080,
    includeHindi: false,
    includeEnglish: true,
    fontScale: 1.0,
  },
  portrait: {
    width: 1080,
    height: 1350,
    includeHindi: true,
    includeEnglish: true,
    fontScale: 1.0,
  },
  wide: {
    width: 1200,
    height: 675,
    includeHindi: false,
    includeEnglish: true,
    fontScale: 0.82,
  },
};

// Theme color definitions
const THEME_COLORS: Record<ImageTheme, Omit<ThemeColors, "background">> = {
  warm: {
    om: "#F59E0B", // amber-500
    sanskrit: "#78350F", // amber-900
    verseRef: "#B45309", // amber-700
    english: "#1F2937", // gray-800
    hindi: "#92400E", // amber-800
    branding: "#9CA3AF", // gray-400
    divider: "#D97706", // amber-600
  },
  dark: {
    om: "#FBBF24", // amber-400
    sanskrit: "#FCD34D", // amber-300
    verseRef: "#F59E0B", // amber-500
    english: "#F3F4F6", // gray-100
    hindi: "#FBBF24", // amber-400
    branding: "#6B7280", // gray-500
    divider: "#4B5563", // gray-600
  },
  minimal: {
    om: "#EA580C", // orange-600
    sanskrit: "#1F2937", // gray-800
    verseRef: "#EA580C", // orange-600
    english: "#374151", // gray-700
    hindi: "#4B5563", // gray-600
    branding: "#9CA3AF", // gray-400
    divider: "#D1D5DB", // gray-300
    border: "#E5E7EB", // gray-200
  },
};

// Logo cache
let logoImage: HTMLImageElement | null = null;
let logoLoadPromise: Promise<HTMLImageElement> | null = null;

async function loadLogo(): Promise<HTMLImageElement> {
  if (logoImage) return logoImage;
  if (logoLoadPromise) return logoLoadPromise;

  logoLoadPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      logoImage = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = "/logo.svg";
  });

  return logoLoadPromise;
}

export async function loadFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('600 48px "Noto Serif Devanagari"'),
      document.fonts.load('400 24px "Source Sans 3"'),
      document.fonts.load('500 24px "Source Sans 3"'),
    ]);
  } catch (err) {
    // Continue execution - browser will use fallback fonts
    console.warn("Failed to preload fonts:", err);
  }
}

function createBackground(
  ctx: CanvasRenderingContext2D,
  theme: ImageTheme,
  width: number,
  height: number,
): string | CanvasGradient {
  if (theme === "warm") {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#FEF3C7");
    gradient.addColorStop(0.5, "#FFEDD5");
    gradient.addColorStop(1, "#FED7AA");
    return gradient;
  } else if (theme === "dark") {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1F2937");
    gradient.addColorStop(1, "#111827");
    return gradient;
  } else {
    return "#FFFFFF";
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  width: number,
): void {
  const x = (width - ctx.measureText(text).width) / 2;
  ctx.fillText(text, x, y);
}

export async function generateVerseImage(
  options: ImageCardOptions,
): Promise<Blob> {
  await Promise.all([loadFonts(), loadLogo().catch(() => null)]);

  const config = FORMAT_CONFIG[options.format];
  const { width, height, fontScale } = config;
  const colors = THEME_COLORS[options.theme];

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get 2D rendering context");
  }

  // Base measurements
  const padding = width * 0.06;
  const contentWidth = width - padding * 2;
  const baseFont = (width / 28) * fontScale;

  // Draw background
  ctx.fillStyle = createBackground(ctx, options.theme, width, height);
  ctx.fillRect(0, 0, width, height);

  // Border for minimal theme
  if (options.theme === "minimal" && colors.border) {
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);
  }

  // === HEADER: Logo + "Geetanjali" ===
  const logoSize = baseFont * 1.6;
  if (logoImage) {
    ctx.drawImage(logoImage, padding, padding, logoSize, logoSize);
  }
  ctx.font = `500 ${baseFont * 0.7}px "Source Sans 3"`;
  ctx.fillStyle = colors.branding;
  ctx.textAlign = "left";
  ctx.fillText(
    "Geetanjali",
    logoImage ? padding + logoSize + 10 : padding,
    padding + logoSize / 2 + baseFont * 0.25,
  );

  // Calculate vertical center for content
  const headerHeight = logoSize + padding;
  const footerHeight = baseFont * 2;
  const availableHeight = height - headerHeight - footerHeight - padding * 2;

  // Format Sanskrit
  const sanskritLines = formatSanskritLines(options.sanskrit, {
    mode: "compact",
    includeSpeakerIntro: false,
  });

  // Measure content to center vertically
  // Refined sizing for balanced layout
  const omSize = baseFont * 1.8;
  const sanskritFontSize = baseFont * 1.4;
  const sanskritLineHeight = sanskritFontSize * 1.25;
  const verseRefSize = baseFont * 0.9;
  const englishFontSize = baseFont * 0.9;
  const englishLineHeight = englishFontSize * 1.4;
  const hindiFontSize = baseFont * 0.8;
  const hindiLineHeight = hindiFontSize * 1.35;

  // Wrap text for measurement
  ctx.font = `600 ${sanskritFontSize}px "Noto Serif Devanagari"`;
  const wrappedSanskrit: string[] = [];
  for (const line of sanskritLines) {
    if (ctx.measureText(line).width > contentWidth * 0.95) {
      wrappedSanskrit.push(...wrapText(ctx, line, contentWidth * 0.95));
    } else {
      wrappedSanskrit.push(line);
    }
  }

  ctx.font = `400 ${englishFontSize}px "Source Sans 3"`;
  const englishText = `"${options.paraphrase}"`;
  const wrappedEnglish = config.includeEnglish
    ? wrapText(ctx, englishText, contentWidth * 0.9)
    : [];

  ctx.font = `400 ${hindiFontSize}px "Noto Serif Devanagari"`;
  const wrappedHindi =
    config.includeHindi && options.showHindi && options.hindi
      ? wrapText(ctx, options.hindi, contentWidth * 0.88)
      : [];

  // Calculate total content height with tighter spacing
  const omHeight = omSize * 1.1;
  const gapAfterOm = padding * 0.2;
  const sanskritHeight = wrappedSanskrit.length * sanskritLineHeight;
  const verseRefHeight = verseRefSize * 1.5;
  const gapAfterRef = padding * 0.4;
  const englishHeight = wrappedEnglish.length * englishLineHeight;
  const dividerHeight = wrappedHindi.length > 0 ? padding * 0.6 : 0;
  const hindiHeight = wrappedHindi.length * hindiLineHeight;

  const totalContentHeight =
    omHeight +
    gapAfterOm +
    sanskritHeight +
    verseRefHeight +
    gapAfterRef +
    englishHeight +
    dividerHeight +
    hindiHeight;

  // Start Y position (vertically centered)
  let currentY = headerHeight + (availableHeight - totalContentHeight) / 2;

  // === OM SYMBOL ===
  ctx.font = `400 ${omSize}px "Noto Serif Devanagari"`;
  ctx.fillStyle = colors.om;
  ctx.globalAlpha = 0.5;
  drawCenteredText(ctx, "ॐ", currentY + omSize * 0.8, width);
  ctx.globalAlpha = 1;
  currentY += omHeight + gapAfterOm;

  // === SANSKRIT TEXT ===
  ctx.font = `600 ${sanskritFontSize}px "Noto Serif Devanagari"`;
  ctx.fillStyle = colors.sanskrit;
  for (const line of wrappedSanskrit) {
    drawCenteredText(ctx, line, currentY + sanskritFontSize, width);
    currentY += sanskritLineHeight;
  }

  // === VERSE REFERENCE ===
  ctx.font = `500 ${verseRefSize}px "Noto Serif Devanagari"`;
  ctx.fillStyle = colors.verseRef;
  ctx.globalAlpha = 0.7;
  drawCenteredText(
    ctx,
    `॥ ${options.chapter}.${options.verse} ॥`,
    currentY + verseRefSize * 1.1,
    width,
  );
  ctx.globalAlpha = 1;
  currentY += verseRefHeight + gapAfterRef;

  // === ENGLISH PARAPHRASE ===
  if (wrappedEnglish.length > 0) {
    ctx.font = `400 ${englishFontSize}px "Source Sans 3"`;
    ctx.fillStyle = colors.english;
    for (const line of wrappedEnglish) {
      drawCenteredText(ctx, line, currentY + englishFontSize, width);
      currentY += englishLineHeight;
    }
  }

  // === DIVIDER + HINDI ===
  if (wrappedHindi.length > 0) {
    currentY += padding * 0.2;
    ctx.strokeStyle = colors.divider;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width * 0.3, currentY);
    ctx.lineTo(width * 0.7, currentY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    currentY += padding * 0.4;

    ctx.font = `400 ${hindiFontSize}px "Noto Serif Devanagari"`;
    ctx.fillStyle = colors.hindi;
    for (const line of wrappedHindi) {
      drawCenteredText(ctx, line, currentY + hindiFontSize, width);
      currentY += hindiLineHeight;
    }
  }

  // === FOOTER: Branding ===
  ctx.font = `400 ${baseFont * 0.55}px "Source Sans 3"`;
  ctx.fillStyle = colors.branding;
  ctx.textAlign = "right";
  ctx.fillText("geetanjaliapp.com", width - padding, height - padding);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Failed to generate image")),
      "image/png",
      1.0,
    );
  });
}

export function downloadImage(
  blob: Blob,
  chapter: number,
  verse: number,
): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `geeta-${chapter}-${verse}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revocation to ensure download starts in all browsers
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
