/**
 * CSP contract test.
 *
 * Commit d8c34a5 (2026-03-28) shipped a CSP that silently disabled TTS playback, the ShareModal
 * preview, Umami analytics, Web Vitals and the inline theme script. Nothing failed — the app degraded
 * gracefully in six places at once and stayed at HTTP 200 for four months.
 *
 * These assertions run in CI so that a directive regression fails at review time rather than in
 * production, where this class of change produces no error.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Resolve a file in the frontend root. Vitest's cwd is `frontend/` when run via npm scripts, but
 * resolving from the repo root too keeps this test runnable from either place in CI.
 */
function frontendFile(name: string): string {
  for (const base of [process.cwd(), resolve(process.cwd(), "frontend")]) {
    const candidate = resolve(base, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not locate ${name} from cwd ${process.cwd()}`);
}

const HEADERS_FILE = frontendFile("nginx-security-headers.inc");
const INDEX_HTML = frontendFile("index.html");

/** Extract the Content-Security-Policy value from the nginx add_header directive. */
function readCspHeader(): string {
  const conf = readFileSync(HEADERS_FILE, "utf8");
  const match = conf.match(
    /add_header\s+Content-Security-Policy\s+"([^"]+)"\s+always;/,
  );
  if (!match) {
    throw new Error(
      `No Content-Security-Policy add_header found in ${HEADERS_FILE}`,
    );
  }
  return match[1];
}

/** Parse a CSP string into directive -> source list. */
function parseCsp(header: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of header.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    directives.set(tokens[0], tokens.slice(1));
  }
  return directives;
}

/**
 * Inline scripts the browser will execute: no `src`, no `type` attribute.
 *
 * Excludes `<script type="application/ld+json">` — data, never executed, so script-src does not
 * apply to it and it needs no hash.
 */
function executableInlineScripts(html: string): string[] {
  const pattern = /<script(?![^>]*\bsrc=)(?![^>]*\btype=)[^>]*>([\s\S]*?)<\/script>/g;
  return [...html.matchAll(pattern)].map((m) => m[1]);
}

function sha256Base64(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("base64");
}

describe("Content-Security-Policy contract", () => {
  const csp = parseCsp(readCspHeader());

  const sourceOf = (directive: string): string[] => csp.get(directive) ?? [];

  it.each([
    // directive,      required source,                 what breaks without it
    ["media-src", "'self'", "TTS audio playback"],
    ["media-src", "blob:", "TTS blob URLs (TTSContext.tsx)"],
    ["img-src", "blob:", "ShareModal card preview"],
    ["script-src", "https://cloud.umami.is", "Umami analytics + Web Vitals"],
    // Two distinct hosts: the script comes from cloud, the events go to gateway. Allowing
    // only the script host loads Umami and then silently drops everything it sends.
    ["connect-src", "https://cloud.umami.is", "Umami script host"],
    ["connect-src", "https://gateway.umami.is", "Umami event delivery"],
    ["connect-src", "https://*.ingest.sentry.io", "Sentry error ingest"],
    ["connect-src", "'self'", "same-origin API and degradation telemetry"],
  ])("%s allows %s (protects: %s)", (directive, source) => {
    expect(sourceOf(directive)).toContain(source);
  });

  it("declares media-src explicitly rather than inheriting default-src", () => {
    // The original bug: media-src was absent, so it fell back to default-src 'self',
    // which does not match blob:. An explicit directive makes the intent reviewable.
    expect(csp.has("media-src")).toBe(true);
  });

  it("keeps the baseline lockdown directives", () => {
    expect(sourceOf("default-src")).toEqual(["'self'"]);
    expect(sourceOf("frame-ancestors")).toEqual(["'self'"]);
    expect(sourceOf("base-uri")).toEqual(["'self'"]);
    expect(sourceOf("form-action")).toEqual(["'self'"]);
  });

  it("does not resort to 'unsafe-inline' for scripts", () => {
    // Hashes are the whole point of the drift guard below; unsafe-inline would void it.
    expect(sourceOf("script-src")).not.toContain("'unsafe-inline'");
  });
});

describe("inline script hash drift guard", () => {
  const scriptSrc = parseCsp(readCspHeader()).get("script-src") ?? [];
  const scripts = executableInlineScripts(readFileSync(INDEX_HTML, "utf8"));

  it("finds the inline theme script in index.html", () => {
    // If this fails, index.html changed shape and the guard below is no longer guarding anything.
    expect(scripts.length).toBeGreaterThan(0);
  });

  it.each(scripts.map((s, i) => [i, s] as const))(
    "inline script #%i has a matching sha256 in script-src",
    (_i, script) => {
      const expected = `'sha256-${sha256Base64(script)}'`;
      expect(scriptSrc).toContain(expected);
    },
  );

  it("has no stale sha256 sources left over in script-src", () => {
    const live = new Set(scripts.map((s) => `'sha256-${sha256Base64(s)}'`));
    const declared = scriptSrc.filter((s) => s.startsWith("'sha256-"));
    for (const hash of declared) {
      expect(live).toContain(hash);
    }
  });
});
