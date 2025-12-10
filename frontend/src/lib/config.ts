/**
 * Frontend configuration - centralized environment variables
 *
 * All environment-dependent values should be defined here.
 * Both dev and prod use relative paths - Vite proxy (dev) and nginx (prod)
 * handle /api/ routing to backend. This ensures dev/prod parity.
 */

// API configuration - relative URLs work in both dev (Vite proxy) and prod (nginx)
// Override with VITE_API_URL only if direct backend access is needed
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export const API_V1_PREFIX = import.meta.env.VITE_API_V1_PREFIX || "/api/v1";

// Site URL for SEO and canonical links
export const SITE_URL =
  import.meta.env.VITE_SITE_URL || "https://geetanjaliapp.com";
