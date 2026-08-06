/**
 * Outside-in synthetic check against production.
 *
 * Every other signal in this stack terminates before the point of failure: CI stops at the bundle,
 * Prometheus stops at the HTTP response, uptime stops at 200. The CSP regression in d8c34a5 lived
 * past all three for four months because the app kept working, just worse.
 *
 * This runs a real browser and asserts on things only a browser can see.
 *
 * Deliberately deterministic: every assertion is an event (a CSP violation fired, speechSynthesis
 * was invoked, a response arrived), never a duration. A synthetic check that flakes gets muted, and
 * a muted check is worse than none.
 *
 * Usage: node check.mjs [baseUrl]
 */

import { chromium } from "playwright";

const BASE = process.argv[2] || process.env.SYNTHETIC_BASE_URL || "https://geetanjaliapp.com";
const VERSE_PATH = "/verses/BG_2_47";

/** Console messages that are never acceptable. */
const FATAL_CONSOLE = [
  /Content Security Policy/i,
  /violates the following/i,
  /Failed to construct 'URL'/i,
  /Uncaught \(in promise\)/i,
];

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  const browser = await chromium.launch({ args: ["--mute-audio"] });
  const context = await browser.newContext();

  // Let the analytics script load (we assert on it) but drop its events, so the weekly
  // check does not show up as traffic in the numbers it exists to protect.
  // Events go to gateway.umami.is, not the cloud.umami.is host the script loads from.
  await context.route(/gateway\.umami\.is\//, (route) => route.fulfill({ status: 204, body: "" }));

  const page = await context.newPage();

  const consoleErrors = [];

  // Installed before any page script runs.
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__violations.push({
        directive: e.effectiveDirective,
        blocked: String(e.blockedURI).slice(0, 120),
      });
    });

    // Record what TTS actually plays. A blob: source means the app has regressed to the
    // pre-v1.40 delivery path -- which still works only because CSP currently permits blob:.
    // Dropping that permission is safe exactly when this stays same-origin.
    window.__audioSources = [];
    const OriginalAudio = window.Audio;
    window.Audio = function (src) {
      window.__audioSources.push(src || "");
      return new OriginalAudio(src);
    };

    // A call here means TTS fell back to the browser voice. This is the signal the
    // production bug produced, and it is precisely what nothing was watching.
    window.__spokeViaFallback = false;
    if (window.speechSynthesis) {
      const original = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = (utterance) => {
        window.__spokeViaFallback = true;
        return original(utterance);
      };
    }
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") return;
    const text = msg.text();
    if (FATAL_CONSOLE.some((re) => re.test(text))) consoleErrors.push(text.slice(0, 200));
  });

  // --- Home page -----------------------------------------------------------
  const homeResponse = await page.goto(BASE, { waitUntil: "networkidle" });
  record("home responds 200", homeResponse?.status() === 200, `status ${homeResponse?.status()}`);

  const homeViolations = await page.evaluate(() => window.__violations);
  record("home has no CSP violations", homeViolations.length === 0, JSON.stringify(homeViolations));

  // Analytics alive. This was dead for four months and nothing noticed, which is why
  // it is asserted rather than assumed.
  const umamiLoaded = await page.evaluate(
    () => typeof window.umami !== "undefined",
  );
  record("umami analytics loaded", umamiLoaded, umamiLoaded ? "" : "window.umami is undefined");

  // --- Verse page and TTS --------------------------------------------------
  await page.goto(`${BASE}${VERSE_PATH}`, { waitUntil: "networkidle" });

  const versePageViolations = await page.evaluate(() => window.__violations);
  record(
    "verse page has no CSP violations",
    versePageViolations.length === 0,
    JSON.stringify(versePageViolations),
  );

  const speakButton = page.getByRole("button", { name: /listen to english translation/i }).first();
  const hasSpeakButton = await speakButton.count().then((c) => c > 0);
  record("speak control present", hasSpeakButton);

  if (hasSpeakButton) {
    const ttsResponse = page.waitForResponse(
      (r) => r.url().includes("/api/v1/tts"),
      { timeout: 30_000 },
    );
    await speakButton.click();

    let ttsStatus = 0;
    try {
      ttsStatus = (await ttsResponse).status();
    } catch {
      ttsStatus = 0;
    }
    record("TTS endpoint returned audio", ttsStatus === 200, `status ${ttsStatus}`);

    // Give playback a bounded window to either start or fall back. The assertion is on
    // which of the two happened, not on how long it took.
    await page.waitForTimeout(4000);

    const fellBack = await page.evaluate(() => window.__spokeViaFallback);
    record(
      "TTS played generated audio, not the browser voice",
      fellBack === false,
      fellBack ? "speechSynthesis.speak was called — TTS is degraded" : "",
    );

    const sources = await page.evaluate(() => window.__audioSources || []);
    const usesBlob = sources.some((s) => s.startsWith("blob:"));
    const usesSameOrigin = sources.some((s) => s.includes("/api/v1/tts/audio/"));
    record(
      "TTS plays a same-origin URL, not a blob",
      usesSameOrigin && !usesBlob,
      usesBlob
        ? "regressed to blob: delivery — CSP media-src blob: cannot be dropped"
        : usesSameOrigin
          ? ""
          : `no TTS audio source observed: ${JSON.stringify(sources)}`,
    );

    const afterClickViolations = await page.evaluate(() => window.__violations);
    record(
      "no CSP violations after TTS playback",
      afterClickViolations.length === 0,
      JSON.stringify(afterClickViolations),
    );
  }

  // --- Share card ----------------------------------------------------------
  // ShareModal renders its preview from a canvas blob, so it depends on `blob:` in img-src.
  // It was one of the six things d8c34a5 broke and the only one with no coverage here until
  // now -- a detection layer that misses one of the failures it was built for is the shape of
  // problem this whole exercise is about.
  const shareButton = page.getByRole("button", { name: /share/i }).first();
  if (await shareButton.count().then((c) => c > 0)) {
    await shareButton.click();
    const preview = page.locator("img[src^='blob:']").first();
    const present = await preview
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    // naturalWidth, not visibility: a blocked <img> still counts as visible, so asserting on
    // presence alone passes even when CSP has blocked the image. Only a decoded image has
    // non-zero natural dimensions.
    const decoded = present
      ? await preview.evaluate((img) => img.naturalWidth > 0).catch(() => false)
      : false;

    record(
      "share card preview renders",
      decoded,
      decoded
        ? ""
        : present
          ? "img element present but image never decoded (check img-src blob:)"
          : "no blob preview element appeared",
    );

    const afterShareViolations = await page.evaluate(() => window.__violations);
    record(
      "no CSP violations after opening share",
      afterShareViolations.length === 0,
      JSON.stringify(afterShareViolations),
    );
  } else {
    record("share control present", false, "no share button found on the verse page");
  }

  record("no fatal console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log(`\nFailing: ${failed.map((f) => f.name).join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Synthetic check errored:", err);
  process.exit(1);
});
