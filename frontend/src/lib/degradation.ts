/**
 * Client-side degradation reporting.
 *
 * The app degrades gracefully in several places, which is why a CSP change in d8c34a5 disabled six
 * features for four months without producing a single alert. TTS fallbacks *were* being reported --
 * via `umami.track` -- but Umami was blocked by the same header that caused the fallback, so the
 * signal and the failure shared a fate.
 *
 * These reports go to a same-origin endpoint instead. `connect-src 'self'` is the one source a CSP
 * cannot remove without breaking the app outright, so this channel cannot fail silently in the way
 * the one it replaces did.
 *
 * Fire-and-forget: never throws, never blocks, never surfaces to the user.
 */

import { API_BASE_URL, API_V1_PREFIX } from "./config";

/** Closed set — must stay in sync with DEGRADATION_PATHS in backend/api/telemetry.py. */
export type DegradationPath =
  | "tts_fallback"
  | "tts_unavailable"
  | "audio_preload_failed"
  | "offline_fallback"
  | "share_image_failed"
  | "chunk_load_retry";

const ENDPOINT = `${API_BASE_URL}${API_V1_PREFIX}/telemetry/degraded`;

/** Cap detail length client-side; the server rejects anything over 200. */
const MAX_DETAIL = 200;

/**
 * Report that a graceful-degradation path was taken.
 *
 * @param path  Which degradation occurred.
 * @param detail Optional context for server logs. Never becomes a metric label.
 */
export function reportDegradation(path: DegradationPath, detail?: string): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    path,
    ...(detail ? { detail: detail.slice(0, MAX_DETAIL) } : {}),
  });

  try {
    // sendBeacon survives page unload, which matters because degradations often happen
    // as the user is navigating away in frustration.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Reporting a failure must never itself become a failure.
    });
  } catch {
    // Same.
  }
}
