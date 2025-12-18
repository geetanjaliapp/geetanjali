/**
 * Social sharing hook using Web Share API with fallbacks
 *
 * Features:
 * - Native Web Share API on supported devices (mobile, some desktop)
 * - Clipboard fallback for unsupported browsers
 * - Share tracking via analytics
 */

import { useCallback, useState, useRef, useEffect } from "react";

interface ShareData {
  title: string;
  text?: string;
  url: string;
}

interface UseShareReturn {
  share: (data: ShareData) => Promise<boolean>;
  copyToClipboard: (text: string) => Promise<boolean>;
  canShare: boolean;
  isSharing: boolean;
  /** True for 2 seconds after successful clipboard copy (for visual feedback) */
  copied: boolean;
  lastError: string | null;
}

/**
 * Hook for sharing content via Web Share API or clipboard
 *
 * @example
 * ```tsx
 * const { share, copyToClipboard, canShare } = useShare()
 *
 * const handleShare = async () => {
 *   const success = await share({
 *     title: 'Bhagavad Geeta 2.47',
 *     text: 'You have the right to work, but never to the fruit of work.',
 *     url: window.location.href
 *   })
 *   if (success) {
 *     console.log('Shared successfully')
 *   }
 * }
 * ```
 */
export function useShare(): UseShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if Web Share API is supported
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Show "copied" state for 2 seconds
   */
  const showCopiedFeedback = useCallback(() => {
    setCopied(true);
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    copiedTimeoutRef.current = setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, []);

  /**
   * Copy text to clipboard
   */
  const copyToClipboard = useCallback(
    async (text: string): Promise<boolean> => {
      setIsSharing(true);
      setLastError(null);

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }

        // Track copy event
        if (window.umami) {
          window.umami.track("share", { method: "clipboard" });
        }

        showCopiedFeedback();
        setIsSharing(false);
        return true;
      } catch (error) {
        // Use friendly message - browser clipboard errors are typically permission-related
        setLastError("Unable to copy to clipboard. Please try again.");
        console.error("[Share] Clipboard error:", error);
        setIsSharing(false);
        return false;
      }
    },
    [showCopiedFeedback],
  );

  /**
   * Share content using Web Share API
   * Falls back to clipboard if not supported
   */
  const share = useCallback(
    async (data: ShareData): Promise<boolean> => {
      setIsSharing(true);
      setLastError(null);

      try {
        if (canShare) {
          await navigator.share({
            title: data.title,
            text: data.text,
            url: data.url,
          });

          // Track share event
          if (window.umami) {
            window.umami.track("share", { method: "native", url: data.url });
          }

          setIsSharing(false);
          return true;
        } else {
          // Fallback to clipboard
          const shareText = data.text
            ? `${data.title}\n\n${data.text}\n\n${data.url}`
            : `${data.title}\n${data.url}`;

          return await copyToClipboard(shareText);
        }
      } catch (error) {
        // User cancelled share (AbortError) or actual error occurred
        if (error instanceof Error && error.name !== "AbortError") {
          // Use friendly message for share failures
          setLastError("Unable to share. Please try again.");
          console.error("[Share] Error:", error);
        }
        setIsSharing(false);
        return false;
      }
    },
    [canShare, copyToClipboard],
  );

  return {
    share,
    copyToClipboard,
    canShare,
    isSharing,
    copied,
    lastError,
  };
}

/**
 * Generate share URLs for specific platforms
 */
export const shareUrls = {
  twitter: (text: string, url: string) =>
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,

  facebook: (url: string) =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,

  linkedin: (url: string, title: string) =>
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,

  whatsapp: (text: string, url: string) =>
    `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,

  telegram: (text: string, url: string) =>
    `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,

  email: (subject: string, body: string, url: string) =>
    `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\n${url}`)}`,
};
