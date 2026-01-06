import { useState, useEffect, useRef, useMemo } from "react";
import type { Verse, Translation } from "../../types";
import {
  generateVerseImage,
  downloadImage,
  type ImageTheme,
  type ImageFormat,
} from "./ImageCardGenerator";
import { getCurrentThemeName } from "../../lib/canvasThemeColors";
import { formatChapterVerse } from "../../lib/verseLinker";
import { truncateForDisplay } from "../../lib/truncate";
import { useFocusTrap } from "../../hooks";

/**
 * Check if native file sharing is supported (Web Share API Level 2)
 * Supported on iOS Safari 15+, Chrome Android
 */
function canShareFiles(): boolean {
  if (
    typeof navigator === "undefined" ||
    !navigator.share ||
    !navigator.canShare
  ) {
    return false;
  }
  // Test with a dummy file to check file sharing support
  const testFile = new File(["test"], "test.png", { type: "image/png" });
  return navigator.canShare({ files: [testFile] });
}

interface ShareModalProps {
  verse: Verse;
  hindiTranslation?: Translation;
  isOpen: boolean;
  onClose: () => void;
}

// Build theme options dynamically so "Current" shows actual theme name
function getThemeOptions(): { id: ImageTheme; label: string; icon: string }[] {
  const currentLabel = `Current (${getCurrentThemeName()})`;
  return [
    { id: "current", label: currentLabel, icon: "🎨" },
    { id: "warm", label: "Warm", icon: "☀️" },
    { id: "dark", label: "Dark", icon: "🌙" },
    { id: "minimal", label: "Minimal", icon: "◻️" },
  ];
}

const FORMATS: { id: ImageFormat; label: string; ratio: string }[] = [
  { id: "square", label: "Square", ratio: "1:1" },
  { id: "portrait", label: "Portrait", ratio: "4:5" },
  { id: "wide", label: "Wide", ratio: "16:9" },
];

export function ShareModal({
  verse,
  hindiTranslation,
  isOpen,
  onClose,
}: ShareModalProps) {
  // Link sharing state
  const [linkCopied, setLinkCopied] = useState(false);

  // Image sharing state - default to current theme so cards match what user sees
  const [theme, setTheme] = useState<ImageTheme>("current");
  const themes = useMemo(() => getThemeOptions(), []);
  const [format, setFormat] = useState<ImageFormat>("square");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const blobRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Trap focus within modal (WCAG 2.1)
  useFocusTrap(modalRef, isOpen);

  // Check native share support once on mount
  const nativeShareSupported = useMemo(() => canShareFiles(), []);

  // Generate share URL
  const shareUrl = `${window.location.origin}/verses/${verse.canonical_id}`;

  // Copy link handler
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // Generate image preview when options change
  useEffect(() => {
    if (!isOpen) return;
    if (!verse.sanskrit_devanagari || !verse.paraphrase_en) return;

    let cancelled = false;

    const generate = async () => {
      setGenerating(true);
      setError(null);

      const sanskrit = verse.sanskrit_devanagari!;
      const paraphrase = verse.paraphrase_en!;

      try {
        const blob = await generateVerseImage({
          sanskrit,
          paraphrase,
          hindi: hindiTranslation?.text,
          chapter: verse.chapter,
          verse: verse.verse,
          theme,
          format,
          showHindi: true,
        });

        if (cancelled) return;

        blobRef.current = blob;

        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }

        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch (err) {
        if (cancelled) return;
        setError("Failed to generate image. Please try again.");
        console.error("Image generation error:", err);
      } finally {
        if (!cancelled) {
          setGenerating(false);
        }
      }
    };

    generate();

    return () => {
      cancelled = true;
    };
  }, [isOpen, verse, hindiTranslation, theme, format]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Native share with image file (mobile)
  const handleNativeShare = async () => {
    if (!blobRef.current) return;

    setSharing(true);
    setError(null);

    try {
      const file = new File(
        [blobRef.current],
        `geeta-${verse.chapter}-${verse.verse}.png`,
        { type: "image/png" },
      );

      await navigator.share({
        files: [file],
        title: `Bhagavad Geeta ${verse.chapter}.${verse.verse}`,
      });
    } catch (err) {
      // User cancelled share - not an error
      if (err instanceof Error && err.name === "AbortError") {
        // Silently ignore user cancellation
      } else {
        setError("Failed to share. Try downloading instead.");
      }
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = async () => {
    if (!blobRef.current) return;

    setDownloading(true);
    try {
      downloadImage(blobRef.current, verse.chapter, verse.verse);
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  // Shorter quote for compact display
  const shortQuote = verse.paraphrase_en
    ? truncateForDisplay(verse.paraphrase_en)
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-bg)] transition-opacity"
        onClick={onClose}
      />

      {/* Modal - compact width */}
      <div
        ref={modalRef}
        className="relative bg-[var(--surface-elevated)] rounded-[var(--radius-modal)] shadow-[var(--shadow-modal)] w-full max-w-md p-4 transform transition-[var(--transition-all)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header - minimal */}
        <div className="flex items-center justify-between mb-3">
          <h2
            id="modal-title"
            className="text-base font-semibold text-[var(--text-primary)]"
          >
            Share
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] rounded-[var(--radius-button)] hover:bg-[var(--interactive-ghost-hover-bg)] transition-[var(--transition-color)]"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Quote + Copy Link - compact inline */}
        <div className="flex items-start gap-3 mb-3 p-3 bg-[var(--surface-warm-subtle)] rounded-[var(--radius-card)] border border-[var(--border-warm)]">
          <div className="flex-1 min-w-0">
            <p className="text-[var(--text-secondary)] text-sm italic leading-snug truncate">
              "{shortQuote}"
            </p>
            <p className="text-[var(--badge-warm-text)] text-xs mt-1 font-medium">
              ॥ {formatChapterVerse(verse.chapter, verse.verse)} ॥
            </p>
          </div>
          <button
            onClick={handleCopyLink}
            className={`shrink-0 px-3 py-1.5 rounded-[var(--radius-button)] text-xs font-medium transition-[var(--transition-all)] ${
              linkCopied
                ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                : "bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--interactive-ghost-hover-bg)] shadow-[var(--shadow-button)]"
            }`}
          >
            {linkCopied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        {/* Image Preview - fixed size canvas */}
        <div className="mb-3 bg-[var(--surface-muted)] rounded-[var(--radius-card)] p-2">
          <div className="relative w-full h-48 flex items-center justify-center overflow-hidden rounded-[var(--radius-button)]">
            {generating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[var(--text-tertiary)]">
                <svg
                  className="animate-spin w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-xs">Generating...</span>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Verse card preview"
                className="max-w-full max-h-full rounded-[var(--radius-button)] shadow-[var(--shadow-button)] object-contain"
              />
            ) : (
              <span className="text-[var(--text-muted)] text-xs">Preview</span>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-3 p-2 bg-[var(--status-error-bg)] border border-[var(--status-error-border)] rounded-[var(--radius-button)] text-[var(--status-error-text)] text-xs">
            {error}
          </div>
        )}

        {/* Theme + Format - side by side segmented controls */}
        <div className="flex gap-2 mb-3">
          {/* Theme segmented control */}
          <div className="flex-1" role="radiogroup" aria-label="Image theme">
            <div className="flex bg-[var(--surface-muted)] rounded-[var(--radius-button)] p-0.5">
              {themes.map((t) => (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={theme === t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex-1 py-1.5 rounded-[var(--radius-nav)] text-xs font-medium transition-[var(--transition-all)] ${
                    theme === t.id
                      ? "bg-[var(--surface-elevated)] text-[var(--text-accent)] shadow-[var(--shadow-button)]"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  }`}
                  aria-label={`${t.label} theme`}
                  title={t.label}
                >
                  {t.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Format segmented control */}
          <div className="flex-1" role="radiogroup" aria-label="Image format">
            <div className="flex bg-[var(--surface-muted)] rounded-[var(--radius-button)] p-0.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={format === f.id}
                  onClick={() => setFormat(f.id)}
                  className={`flex-1 py-1.5 rounded-[var(--radius-nav)] text-[10px] font-medium transition-[var(--transition-all)] ${
                    format === f.id
                      ? "bg-[var(--surface-elevated)] text-[var(--text-accent)] shadow-[var(--shadow-button)]"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  }`}
                  aria-label={`${f.label} format (${f.ratio})`}
                  title={f.label}
                >
                  {f.ratio}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons - compact */}
        <div className="flex items-center gap-2">
          {nativeShareSupported ? (
            <>
              <button
                onClick={handleNativeShare}
                disabled={generating || sharing || !previewUrl}
                className="flex-1 px-4 py-2 bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] disabled:bg-[var(--interactive-primary-disabled-bg)] disabled:text-[var(--interactive-primary-disabled-text)] text-[var(--interactive-primary-text)] text-sm font-medium rounded-[var(--radius-card)] transition-[var(--transition-color)] disabled:cursor-not-allowed"
              >
                {sharing ? "Sharing..." : "Share Image"}
              </button>
              <button
                onClick={handleDownload}
                disabled={generating || downloading || !previewUrl}
                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--interactive-ghost-hover-bg)] rounded-[var(--radius-card)] transition-[var(--transition-color)] disabled:opacity-40"
                aria-label="Download"
                title="Download"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={handleDownload}
              disabled={generating || downloading || !previewUrl}
              className="flex-1 px-4 py-2 bg-[var(--interactive-primary)] hover:bg-[var(--interactive-primary-hover)] disabled:bg-[var(--interactive-primary-disabled-bg)] disabled:text-[var(--interactive-primary-disabled-text)] text-[var(--interactive-primary-text)] text-sm font-medium rounded-[var(--radius-card)] transition-[var(--transition-color)] disabled:cursor-not-allowed"
            >
              {downloading ? "Downloading..." : "Download Image"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
