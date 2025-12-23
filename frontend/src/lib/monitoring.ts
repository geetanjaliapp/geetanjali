/**
 * Monitoring utilities for Geetanjali
 *
 * Includes:
 * - Sentry error tracking (production only)
 * - Umami analytics (production only)
 * - Web Vitals performance reporting
 * - Service Worker registration
 *
 * All monitoring is production-only and gracefully handles missing config.
 */

// =============================================================================
// Sentry Error Tracking
// =============================================================================

/**
 * Initialize Sentry for error tracking (production only).
 *
 * Requires: VITE_SENTRY_DSN in environment
 */
export function initSentry(): void {
  // Only run in production
  if (!import.meta.env.PROD) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // Silent skip if not configured

  // Dynamically import Sentry to keep initial bundle small
  import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        enabled: true,
        // Sample rate for performance monitoring (0.1 = 10%)
        tracesSampleRate: 0.1,
        // Don't send PII
        beforeSend(event) {
          if (event.user) {
            delete event.user.email;
            delete event.user.ip_address;
          }
          return event;
        },
      });
    })
    .catch(() => {
      // Silent fail - don't pollute console
    });
}

// =============================================================================
// Umami Analytics
// =============================================================================

/**
 * Initialize Umami analytics (production only).
 *
 * Requires: VITE_UMAMI_WEBSITE_ID in environment
 */
export function initUmami(): void {
  // Only run in production
  if (!import.meta.env.PROD) return;

  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  if (!websiteId) return; // Silent skip if not configured

  // Inject Umami script
  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://cloud.umami.is/script.js";
  script.setAttribute("data-website-id", websiteId);
  document.head.appendChild(script);
}

/**
 * Capture an exception manually
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>,
): void {
  import("@sentry/react")
    .then((Sentry) => {
      Sentry.captureException(error, { extra: context });
    })
    .catch(() => {
      console.error("[Sentry] Failed to capture:", error);
    });
}

// =============================================================================
// Web Vitals
// =============================================================================

/**
 * Initialize Web Vitals reporting.
 *
 * Reports Core Web Vitals (LCP, FID, CLS) to console in dev mode
 * and to analytics endpoint in production.
 */
export function initWebVitals(): void {
  import("web-vitals")
    .then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      const reportVital = (metric: {
        name: string;
        value: number;
        id: string;
      }) => {
        // Log in development
        if (import.meta.env.DEV) {
          console.log(`[Web Vitals] ${metric.name}:`, metric.value.toFixed(2));
        }

        // Send to analytics in production
        if (import.meta.env.PROD && window.umami) {
          window.umami.track(`web-vital-${metric.name.toLowerCase()}`, {
            value: Math.round(metric.value),
            id: metric.id,
          });
        }
      };

      onCLS(reportVital); // Cumulative Layout Shift
      onINP(reportVital); // Interaction to Next Paint (replaced FID in v4)
      onLCP(reportVital); // Largest Contentful Paint
      onFCP(reportVital); // First Contentful Paint
      onTTFB(reportVital); // Time to First Byte
    })
    .catch((err) => {
      console.warn("[Web Vitals] Failed to load:", err);
    });
}

// =============================================================================
// Service Worker
// =============================================================================

/**
 * Register the service worker for PWA functionality.
 */
export function registerServiceWorker(): void {
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("[SW] Registration failed:", error);
      }
    });
  }
}

/**
 * Unregister service worker (useful for debugging)
 */
export async function unregisterServiceWorker(): Promise<void> {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.unregister();
  }
}

// =============================================================================
// Type declarations for global objects
// =============================================================================

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}
