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
  /** Last error message */
  lastError: string | null;
}

const TTSContext = createContext<TTSContextValue | null>(null);

// Voice preferences for Web Speech API fallback
const FALLBACK_VOICE_PREFERENCES: Record<TTSLanguage, string[]> = {
  en: ["Samantha", "Google UK English Female", "Microsoft Zira", "en-IN", "en-US"],
  hi: ["Google हिन्दी", "hi-IN", "Hindi"],
};

export function TTSProvider({ children }: { children: ReactNode }) {
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findBestVoice = useCallback(
    (lang: TTSLanguage): SpeechSynthesisVoice | null => {
      if (!hasFallback) return null;
      const voices = window.speechSynthesis.getVoices();
      const preferences = FALLBACK_VOICE_PREFERENCES[lang];
      for (const pref of preferences) {
        const voice = voices.find(
          (v) => v.name.includes(pref) || v.lang.startsWith(pref) || v.lang === pref
        );
        if (voice) return voice;
      }
      const langPrefix = lang === "hi" ? "hi" : "en";
      return voices.find((v) => v.lang.startsWith(langPrefix)) || null;
    },
    [hasFallback]
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

        utterance.onstart = () => setCurrentText(text);
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

        if (window.umami) {
          window.umami.track("tts_fallback", { lang });
        }
      });
    },
    [hasFallback, findBestVoice]
  );

  const speakWithEdgeTTS = useCallback(
    async (text: string, options: TTSOptions = {}): Promise<void> => {
      const { lang = "en", rate = "-5%", pitch = "+0Hz" } = options;

      abortControllerRef.current = new AbortController();

      const response = await fetch(`${API_BASE_URL}${API_V1_PREFIX}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang, rate, pitch }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`TTS API error: ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => setCurrentText(text);
        audio.onended = () => {
          setCurrentText(null);
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setCurrentText(null);
          URL.revokeObjectURL(url);
          audioRef.current = null;
          reject(new Error("Audio playback failed"));
        };

        audio.play().catch(reject);

        if (window.umami) {
          window.umami.track("tts_edge", { lang });
        }
      });
    },
    []
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
    return () => window.removeEventListener("audioRecitationStart", handleRecitationStart);
  }, [stop]);

  // Announce TTS state changes to screen readers
  useEffect(() => {
    if (loadingText) {
      setAnnouncement("Loading speech...");
    } else if (currentText) {
      setAnnouncement("Playing speech");
    } else if (lastError) {
      setAnnouncement(`Speech error: ${lastError}`);
    } else {
      setAnnouncement("");
    }
  }, [currentText, loadingText, lastError]);

  const speak = useCallback(
    async (text: string, options: TTSOptions = {}): Promise<void> => {
      const { lang = "en" } = options;

      // Stop any ongoing speech first (ensures one audio at a time)
      stop();

      // Also stop any audio recitation to prevent competing audio
      stopAudioRecitation();

      setLastError(null);
      setLoadingText(text);

      try {
        await speakWithEdgeTTS(text, options);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setLoadingText(null);
          return;
        }

        console.warn("[TTS] Edge TTS failed, trying fallback:", error);

        if (hasFallback) {
          try {
            await speakWithFallback(text, lang);
          } catch (fallbackError) {
            setLastError("Unable to play speech. Please try again.");
            console.error("[TTS] Fallback also failed:", fallbackError);
          }
        } else {
          setLastError("Text-to-speech not available");
        }
      } finally {
        setLoadingText(null);
      }
    },
    [stop, stopAudioRecitation, speakWithEdgeTTS, speakWithFallback, hasFallback]
  );

  return (
    <TTSContext.Provider
      value={{ speak, stop, currentText, loadingText, hasFallback, lastError }}
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
