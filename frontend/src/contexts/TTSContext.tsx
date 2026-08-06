/**
 * Global TTS Context - ensures only one audio plays at a time
 *
 * Provides a singleton TTS manager that:
 * - Cancels previous audio when starting new speech
 * - Tracks which text is currently playing
 * - Shares state across all SpeakButton instances
 */

/* eslint-disable react-refresh/only-export-components -- Provider and hook must be co-located */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { API_BASE_URL, API_V1_PREFIX } from "../lib/config";
import { reportDegradation } from "../lib/degradation";
import { useAudioPlayer } from "../components/audio";

type TTSLanguage = "en" | "hi";

interface TTSOptions {
  lang?: TTSLanguage;
  rate?: string;
  pitch?: string;
}

interface TTSContextValue {
  /** Speak text (cancels any playing audio first) */
  speak: (text: string, options?: TTSOptions) => Promise<void>;
  /** Stop current speech */
  stop: () => void;
  /** Text currently being spoken (null if idle) */
  currentText: string | null;
  /** Text currently being loaded (null if not loading) */
  loadingText: string | null;
  /** Whether Web Speech API fallback is available */
  hasFallback: boolean;
  /** Whether the audio currently playing is the degraded browser voice, not our narration */
  usingFallback: boolean;
  /** Last error message */
  lastError: string | null;
}

const TTSContext = createContext<TTSContextValue | null>(null);

// Voice preferences for Web Speech API fallback
const FALLBACK_VOICE_PREFERENCES: Record<TTSLanguage, string[]> = {
  en: [
    "Samantha",
    "Google UK English Female",
    "Microsoft Zira",
    "en-IN",
    "en-US",
  ],
  hi: ["Google हिन्दी", "hi-IN", "Hindi"],
};

export function TTSProvider({ children }: { children: ReactNode }) {
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  // Aria-live announcement for screen readers
  const [announcement, setAnnouncement] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get audio player to stop recitation when TTS starts
  const { stop: stopAudioRecitation } = useAudioPlayer();

  const hasFallback =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup runs once on unmount, stop is stable
  }, []);

  const findBestVoice = useCallback(
    (lang: TTSLanguage): SpeechSynthesisVoice | null => {
      if (!hasFallback) return null;
      const voices = window.speechSynthesis.getVoices();
      const preferences = FALLBACK_VOICE_PREFERENCES[lang];
      for (const pref of preferences) {
        const voice = voices.find(
          (v) =>
            v.name.includes(pref) || v.lang.startsWith(pref) || v.lang === pref,
        );
        if (voice) return voice;
      }
      const langPrefix = lang === "hi" ? "hi" : "en";
      return voices.find((v) => v.lang.startsWith(langPrefix)) || null;
    },
    [hasFallback],
  );

  const speakWithFallback = useCallback(
    async (text: string, lang: TTSLanguage): Promise<void> => {
      if (!hasFallback) throw new Error("Speech synthesis not available");

      return new Promise((resolve, reject) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === "hi" ? "hi-IN" : "en-IN";
        utterance.rate = 0.9;
        const voice = findBestVoice(lang);
        if (voice) utterance.voice = voice;

        utterance.onstart = () => {
          setCurrentText(text);
          setUsingFallback(true);
        };
        utterance.onend = () => {
          setCurrentText(null);
          resolve();
        };
        utterance.onerror = (event) => {
          setCurrentText(null);
          if (event.error !== "canceled" && event.error !== "interrupted") {
            reject(new Error(`Speech error: ${event.error}`));
          } else {
            resolve();
          }
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    [hasFallback, findBestVoice],
  );

  const speakWithEdgeTTS = useCallback(
    async (text: string, options: TTSOptions = {}): Promise<void> => {
      const { lang = "en", rate = "-5%", pitch = "+0Hz" } = options;

      abortControllerRef.current = new AbortController();

      // Accept: application/json asks the API for a same-origin URL instead of the bytes.
      // Playing a real URL rather than a blob: is what keeps this working under CSP -- 'self'
      // does not match the blob: scheme, which is how d8c34a5 silently broke narration. It also
      // gets HTTP caching, service-worker caching and Range-based seeking for free.
      const response = await fetch(`${API_BASE_URL}${API_V1_PREFIX}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ text, lang, rate, pitch }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`TTS API error: ${response.status}`);

      const { url } = (await response.json()) as { url: string };
      if (!url) throw new Error("TTS API returned no audio URL");

      return new Promise((resolve, reject) => {
        const audio = new Audio(`${API_BASE_URL}${url}`);
        audioRef.current = audio;

        audio.onplay = () => setCurrentText(text);
        audio.onended = () => {
          setCurrentText(null);
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setCurrentText(null);
          audioRef.current = null;
          reject(new Error("Audio playback failed"));
        };

        audio.play().catch(reject);

        if (window.umami) {
          window.umami.track("tts_edge", { lang });
        }
      });
    },
    [],
  );

  const stop = useCallback(() => {
    // Stop Edge TTS audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    // Abort ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop Web Speech API
    if (hasFallback) {
      window.speechSynthesis.cancel();
    }

    setCurrentText(null);
    setLoadingText(null);
    setUsingFallback(false);
  }, [hasFallback]);

  // Stop TTS on in-app navigation (user is engaging with new content)
  // Watch both pathname and search params - Reading Mode uses ?c= and ?v= params
  const location = useLocation();
  useEffect(() => {
    stop();
  }, [location.pathname, location.search, stop]);

  // Escape key stops TTS globally (quick way to stop from anywhere)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (currentText || loadingText)) {
        stop();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentText, loadingText, stop]);

  // Stop TTS when audio recitation starts (to prevent competing audio)
  useEffect(() => {
    const handleRecitationStart = () => stop();
    window.addEventListener("audioRecitationStart", handleRecitationStart);
    return () =>
      window.removeEventListener("audioRecitationStart", handleRecitationStart);
  }, [stop]);

  // Announce TTS state changes to screen readers
  useEffect(() => {
    if (loadingText) {
      setAnnouncement("Loading speech...");
    } else if (currentText) {
      setAnnouncement(
        usingFallback
          ? "Playing speech using your browser's basic voice"
          : "Playing speech",
      );
    } else if (lastError) {
      setAnnouncement(`Speech error: ${lastError}`);
    } else {
      setAnnouncement("");
    }
  }, [currentText, loadingText, lastError, usingFallback]);

  const speak = useCallback(
    async (text: string, options: TTSOptions = {}): Promise<void> => {
      const { lang = "en" } = options;

      // Stop any ongoing speech first (ensures one audio at a time)
      stop();

      // Also stop any audio recitation to prevent competing audio
      stopAudioRecitation();

      setLastError(null);
      setLoadingText(text);
      setUsingFallback(false);

      try {
        await speakWithEdgeTTS(text, options);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setLoadingText(null);
          return;
        }

        console.warn("[TTS] Edge TTS failed, trying fallback:", error);

        if (hasFallback) {
          // Report at the point of degradation, not after playback completes: the promise
          // from speakWithFallback resolves on utterance end, and a user who navigates away
          // mid-sentence is exactly the case worth counting.
          reportDegradation(
            "tts_fallback",
            error instanceof Error ? error.message : String(error),
          );
          try {
            await speakWithFallback(text, lang);
          } catch (fallbackError) {
            setLastError("Unable to play speech. Please try again.");
            console.error("[TTS] Fallback also failed:", fallbackError);
            reportDegradation(
              "tts_unavailable",
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
            );
          }
        } else {
          setLastError("Text-to-speech not available");
          reportDegradation("tts_unavailable", "no speechSynthesis support");
        }
      } finally {
        setLoadingText(null);
      }
    },
    [
      stop,
      stopAudioRecitation,
      speakWithEdgeTTS,
      speakWithFallback,
      hasFallback,
    ],
  );

  return (
    <TTSContext.Provider
      value={{
        speak,
        stop,
        currentText,
        loadingText,
        hasFallback,
        usingFallback,
        lastError,
      }}
    >
      {children}
      {/* Screen reader announcements for TTS state changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </TTSContext.Provider>
  );
}

/**
 * Hook to access global TTS context
 */
export function useTTSContext(): TTSContextValue {
  const context = useContext(TTSContext);
  if (!context) {
    throw new Error("useTTSContext must be used within TTSProvider");
  }
  return context;
}
