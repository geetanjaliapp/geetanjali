/**
 * Audio Player Context (v1.17.0)
 *
 * Global audio state management for verse recitations.
 * Ensures only one audio plays at a time across the app.
 *
 * Features:
 * - Single audio playback (stops others when new one starts)
 * - Playback speed control (persisted to localStorage)
 * - Loop mode for memorization
 * - Media Session API for lock screen controls
 * - Analytics tracking via Umami
 */

// Declare Umami types for analytics
declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { formatVerseId } from "./audioUtils";

// Storage key for audio settings
const STORAGE_KEY_SPEED = "geetanjali_audio_speed";
const STORAGE_KEY_LOOP = "geetanjali_audio_loop";

// Retry configuration for network errors
const MAX_AUTO_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // 1s, 3s backoff

// Load timeout - prevents infinite loading on slow/stuck connections
const LOAD_TIMEOUT_MS = 20000; // 20 seconds

// Playback speed options
export const PLAYBACK_SPEEDS = [0.75, 1, 1.25] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// Audio playback state ("completed" briefly shows after audio ends)
export type AudioState =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "error"
  | "completed";

// Audio error messages by MediaError code
const AUDIO_ERROR_MESSAGES: Record<number, string> = {
  1: "Audio loading aborted",
  2: "Network error loading audio",
  3: "Audio decoding failed",
  4: "Audio format not supported",
};

interface AudioContextValue {
  /** Currently playing verse canonical ID */
  currentlyPlaying: string | null;
  /** Current audio state */
  state: AudioState;
  /** Current playback progress (0-1) */
  progress: number;
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Error message if state is 'error' */
  error: string | null;
  /** Playback speed */
  playbackSpeed: PlaybackSpeed;
  /** Loop mode enabled */
  isLooping: boolean;
  /** Play audio for a verse */
  play: (verseId: string, src: string) => void;
  /** Pause current audio */
  pause: () => void;
  /** Resume paused audio */
  resume: () => void;
  /** Stop and reset */
  stop: () => void;
  /** Seek to position (0-1) */
  seek: (position: number) => void;
  /** Set playback speed */
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  /** Toggle loop mode */
  toggleLoop: () => void;
  /** Check if a specific verse is playing */
  isPlaying: (verseId: string) => boolean;
  /** Retry loading after error */
  retry: () => void;
}

const AudioContext = createContext<AudioContextValue | undefined>(undefined);

// Get stored playback speed with error handling
function getStoredSpeed(): PlaybackSpeed {
  if (typeof window === "undefined") return 1;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SPEED);
    const parsed = stored ? parseFloat(stored) : 1;
    return PLAYBACK_SPEEDS.includes(parsed as PlaybackSpeed)
      ? (parsed as PlaybackSpeed)
      : 1;
  } catch {
    return 1;
  }
}

// Get stored loop setting with error handling
function getStoredLoop(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY_LOOP) === "true";
  } catch {
    return false;
  }
}

interface AudioPlayerProviderProps {
  children: ReactNode;
}

export function AudioPlayerProvider({ children }: AudioPlayerProviderProps) {
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [state, setState] = useState<AudioState>("idle");
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeedState] =
    useState<PlaybackSpeed>(getStoredSpeed);
  const [isLooping, setIsLooping] = useState(getStoredLoop);
  // Aria-live announcement for screen readers
  const [announcement, setAnnouncement] = useState<string>("");

  // Audio element ref - initialized once on mount
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Current source URL for retry
  const currentSrcRef = useRef<string | null>(null);
  // Current verse ID ref for analytics (accessible by event handlers)
  const currentVerseIdRef = useRef<string | null>(null);
  // Track if audio element is initialized
  const isInitializedRef = useRef(false);
  // Completion timeout ref for cleanup
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Auto-retry state
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Load timeout ref - prevents infinite loading spinner
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update media session metadata
  const updateMediaSession = useCallback((verseId: string | null) => {
    if (!("mediaSession" in navigator) || !verseId) return;

    const parts = verseId.split("_");
    if (parts.length !== 3) return;

    const chapter = parseInt(parts[1], 10);
    const verse = parseInt(parts[2], 10);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Bhagavad Geeta ${chapter}.${verse}`,
      artist: "Geetanjali",
      album: "Bhagavad Geeta - Sanskrit Recitation",
      artwork: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  }, []);

  // Initialize audio element with event listeners
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const audio = new Audio();
    audio.preload = "metadata"; // Use metadata preload to reduce data usage
    audioRef.current = audio;

    // Named handlers for proper cleanup
    const handleLoadStart = () => {
      setState("loading");
      setError(null);
    };

    const handleCanPlay = () => {
      // Clear load timeout - audio loaded successfully
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      setState("playing");
      audio.play().catch(() => {
        setState("paused");
        setError("Tap play to start audio");
      });
    };

    const handlePlaying = () => {
      setState("playing");
      setError(null);
    };

    const handlePause = () => {
      if (!audio.ended) {
        setState("paused");
      }
    };

    const handleEnded = () => {
      if (audio.loop) {
        return; // Loop mode - audio restarts automatically
      }

      // Track completion event
      if (window.umami && currentVerseIdRef.current) {
        window.umami.track("audio_complete", {
          verse_id: currentVerseIdRef.current,
          duration: Math.round(audio.duration || 0),
        });
      }

      // Show completion state briefly before resetting
      setState("completed");
      setProgress(1); // Show full progress

      // Clear any existing completion timeout
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }

      // After brief delay, reset to idle
      completionTimeoutRef.current = setTimeout(() => {
        completionTimeoutRef.current = null;
        setState("idle");
        setCurrentlyPlaying(null);
        currentVerseIdRef.current = null;
        setProgress(0);
        setCurrentTime(0);
      }, 1500);
    };

    const handleError = () => {
      // Clear load timeout on error
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }

      const errorCode = audio.error?.code || 0;
      const message = AUDIO_ERROR_MESSAGES[errorCode] || "Failed to load audio";

      // Auto-retry for network errors (code 2) with backoff
      if (errorCode === 2 && retryCountRef.current < MAX_AUTO_RETRIES) {
        const delay = RETRY_DELAYS[retryCountRef.current] || 3000;
        retryCountRef.current++;

        // Show retry state with message
        setState("loading");
        setError(`Network error, retrying... (${retryCountRef.current}/${MAX_AUTO_RETRIES})`);

        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          if (currentSrcRef.current && currentVerseIdRef.current) {
            // Re-attempt loading
            audio.src = currentSrcRef.current;
            audio.load();
          }
        }, delay);

        return; // Don't set error state yet, we're retrying
      }

      // Max retries exceeded or non-network error
      const finalRetryCount = retryCountRef.current;
      setState("error");
      setError(message);
      retryCountRef.current = 0; // Reset for next play attempt

      // Track error event
      if (window.umami && currentVerseIdRef.current) {
        window.umami.track("audio_error", {
          verse_id: currentVerseIdRef.current,
          error_code: errorCode,
          error_message: message,
          retry_count: finalRetryCount,
        });
      }
    };

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      const dur = audio.duration || 0;
      setCurrentTime(time);
      setDuration(dur);
      setProgress(dur > 0 ? time / dur : 0);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    // Add event listeners
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);

    // Cleanup on unmount
    return () => {
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
      isInitializedRef.current = false;
      // Clear completion timeout to prevent state updates after unmount
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      // Clear load timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, []);

  // Play audio
  const play = useCallback(
    (verseId: string, src: string) => {
      const audio = audioRef.current;
      if (!audio) return;

      // Clear any pending completion reset timeout (prevents state reset during playback)
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }

      // Clear any pending retry and reset count for fresh play
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      retryCountRef.current = 0;

      // Clear any existing load timeout
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }

      // Dispatch event to stop TTS (TTSContext listens for this)
      window.dispatchEvent(new CustomEvent("audioRecitationStart"));

      // If already playing this verse and paused, just resume
      if (currentlyPlaying === verseId && state === "paused") {
        audio.play().catch(() => {
          setState("error");
          setError("Playback failed");
        });
        // Track resume
        if (window.umami) {
          window.umami.track("audio_resume", { verse_id: verseId });
        }
        return;
      }

      // Track play event
      if (window.umami) {
        window.umami.track("audio_play", { verse_id: verseId });
      }

      // Stop any current playback
      audio.pause();
      audio.currentTime = 0;

      // Set new source
      currentSrcRef.current = src;
      audio.src = src;
      audio.playbackRate = playbackSpeed;
      audio.loop = isLooping;

      // Set state synchronously BEFORE load() to prevent race condition
      // where currentlyPlaying updates but state is still "completed" from previous verse
      setState("loading");
      setCurrentlyPlaying(verseId);
      currentVerseIdRef.current = verseId; // For analytics in event handlers
      setProgress(0);
      setCurrentTime(0);
      setError(null);

      updateMediaSession(verseId);
      audio.load();

      // Set load timeout - prevents infinite loading on slow/stuck connections
      loadTimeoutRef.current = setTimeout(() => {
        loadTimeoutRef.current = null;
        // Only trigger timeout if still in loading state
        if (audioRef.current && currentSrcRef.current === src) {
          setState("error");
          setError("Audio loading timed out - check your connection");
          // Track timeout event
          if (window.umami) {
            window.umami.track("audio_timeout", {
              verse_id: verseId,
              timeout_ms: LOAD_TIMEOUT_MS,
            });
          }
        }
      }, LOAD_TIMEOUT_MS);
    },
    [currentlyPlaying, state, playbackSpeed, isLooping, updateMediaSession],
  );

  // Pause
  const pause = useCallback(() => {
    audioRef.current?.pause();
    // Track pause event
    if (window.umami && currentlyPlaying) {
      window.umami.track("audio_pause", {
        verse_id: currentlyPlaying,
        progress: Math.round(progress * 100),
      });
    }
  }, [currentlyPlaying, progress]);

  // Resume
  const resume = useCallback(() => {
    audioRef.current?.play().catch(() => {
      setState("error");
      setError("Playback failed");
    });
  }, []);

  // Stop
  const stop = useCallback(() => {
    // Clear completion timeout if active
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
    // Clear retry timeout if active
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    // Clear load timeout if active
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    retryCountRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      // Clear source to cancel pending operations
      // Note: Don't call load() here - it would queue error events for the empty src
      // that could race with subsequent play() calls (causes study mode restart bug)
      audioRef.current.src = "";
    }
    currentSrcRef.current = null;
    setState("idle");
    setCurrentlyPlaying(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // Seek
  const seek = useCallback((position: number) => {
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = position * audioRef.current.duration;
    }
  }, []);

  // Set playback speed
  const setPlaybackSpeed = useCallback(
    (speed: PlaybackSpeed) => {
      const oldSpeed = playbackSpeed;
      setPlaybackSpeedState(speed);
      try {
        localStorage.setItem(STORAGE_KEY_SPEED, speed.toString());
      } catch {
        // Ignore localStorage errors (private browsing, quota exceeded)
      }
      if (audioRef.current) {
        audioRef.current.playbackRate = speed;
      }
      // Track speed change
      if (window.umami && oldSpeed !== speed) {
        window.umami.track("audio_speed_change", {
          old_speed: oldSpeed,
          new_speed: speed,
        });
      }
    },
    [playbackSpeed],
  );

  // Toggle loop
  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      const newValue = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_LOOP, newValue.toString());
      } catch {
        // Ignore localStorage errors
      }
      if (audioRef.current) {
        audioRef.current.loop = newValue;
      }
      return newValue;
    });
  }, []);

  // Check if specific verse is playing
  const isPlaying = useCallback(
    (verseId: string) => {
      return currentlyPlaying === verseId && state === "playing";
    },
    [currentlyPlaying, state],
  );

  // Retry after error - fully reset audio element to clear partial state
  const retry = useCallback(() => {
    if (currentlyPlaying && currentSrcRef.current) {
      const audio = audioRef.current;
      const savedSrc = currentSrcRef.current;
      const savedVerseId = currentlyPlaying;

      // Fully reset audio element to clear browser's partial buffer state
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load(); // Clear internal buffers
      }

      // Reset state
      setState("idle");
      setError(null);
      currentSrcRef.current = null;

      // Small delay to ensure browser has cleared state, then replay
      setTimeout(() => {
        // Add cache-bust param to force fresh request (bypasses browser's partial cache)
        const freshSrc = savedSrc.includes("?")
          ? `${savedSrc}&_t=${Date.now()}`
          : `${savedSrc}?_t=${Date.now()}`;
        play(savedVerseId, freshSrc);
      }, 150);
    }
  }, [currentlyPlaying, play]);

  // Setup Media Session API handlers
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const handleMediaPlay = () => resume();
    const handleMediaPause = () => pause();

    navigator.mediaSession.setActionHandler("play", handleMediaPlay);
    navigator.mediaSession.setActionHandler("pause", handleMediaPause);

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [resume, pause]);

  // Announce audio state changes to screen readers
  useEffect(() => {
    if (!currentlyPlaying) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync accessibility announcements with audio state
      setAnnouncement("");
      return;
    }

    const verseRef = formatVerseId(currentlyPlaying);
    let message = "";

    switch (state) {
      case "playing":
        message = `Playing verse ${verseRef}`;
        break;
      case "paused":
        message = `Paused verse ${verseRef}`;
        break;
      case "completed":
        message = `Completed verse ${verseRef}`;
        break;
      case "error":
        message = error ? `Error: ${error}` : `Error loading verse ${verseRef}`;
        break;
      case "loading":
        message = `Loading verse ${verseRef}`;
        break;
      default:
        message = "";
    }

    setAnnouncement(message);
  }, [state, currentlyPlaying, error]);

  const value = useMemo(
    () => ({
      currentlyPlaying,
      state,
      progress,
      currentTime,
      duration,
      error,
      playbackSpeed,
      isLooping,
      play,
      pause,
      resume,
      stop,
      seek,
      setPlaybackSpeed,
      toggleLoop,
      isPlaying,
      retry,
    }),
    [
      currentlyPlaying,
      state,
      progress,
      currentTime,
      duration,
      error,
      playbackSpeed,
      isLooping,
      play,
      pause,
      resume,
      stop,
      seek,
      setPlaybackSpeed,
      toggleLoop,
      isPlaying,
      retry,
    ],
  );

  return (
    <AudioContext.Provider value={value}>
      {children}
      {/* Screen reader announcements for audio state changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </AudioContext.Provider>
  );
}

/**
 * Hook to access audio player context
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAudioPlayer(): AudioContextValue {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error(
      "useAudioPlayer must be used within an AudioPlayerProvider",
    );
  }
  return context;
}
