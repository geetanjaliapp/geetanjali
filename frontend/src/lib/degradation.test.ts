/**
 * Tests for degradation reporting.
 *
 * The property that matters most is the one the old umami-based reporting lacked: this must not be
 * silently disableable, and it must never turn a degraded experience into a broken one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportDegradation } from "./degradation";

describe("reportDegradation", () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      value: sendBeacon,
      configurable: true,
      writable: true,
    });

    fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function beaconPayload(): Promise<Record<string, unknown>> {
    const blob = sendBeacon.mock.calls[0][1] as Blob;
    return JSON.parse(await blob.text());
  }

  it("posts the path to the same-origin telemetry endpoint", async () => {
    reportDegradation("tts_fallback");

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url] = sendBeacon.mock.calls[0];
    expect(String(url)).toContain("/telemetry/degraded");
    await expect(beaconPayload()).resolves.toEqual({ path: "tts_fallback" });
  });

  it("sends the endpoint as same-origin so connect-src 'self' covers it", () => {
    // A third-party host here would reintroduce the failure mode this replaces.
    reportDegradation("tts_fallback");
    const [url] = sendBeacon.mock.calls[0];
    expect(String(url)).not.toMatch(/^https?:\/\/(?!localhost)/);
  });

  it("includes detail when given", async () => {
    reportDegradation("tts_unavailable", "Audio playback failed");
    await expect(beaconPayload()).resolves.toEqual({
      path: "tts_unavailable",
      detail: "Audio playback failed",
    });
  });

  it("truncates detail to the length the server accepts", async () => {
    reportDegradation("tts_fallback", "z".repeat(5000));
    const payload = (await beaconPayload()) as { detail: string };
    expect(payload.detail.length).toBe(200);
  });

  it("omits detail rather than sending an empty string", async () => {
    reportDegradation("offline_fallback", "");
    await expect(beaconPayload()).resolves.toEqual({ path: "offline_fallback" });
  });

  it("falls back to fetch when sendBeacon refuses the payload", () => {
    sendBeacon.mockReturnValue(false);

    reportDegradation("share_image_failed");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    // keepalive so the report survives the navigation that often follows a degradation.
    expect(init.keepalive).toBe(true);
  });

  it("falls back to fetch when sendBeacon is unavailable", () => {
    Object.defineProperty(navigator, "sendBeacon", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    reportDegradation("chunk_load_retry");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("never throws when sendBeacon throws", () => {
    sendBeacon.mockImplementation(() => {
      throw new Error("beacon exploded");
    });

    expect(() => reportDegradation("tts_fallback")).not.toThrow();
  });

  it("never throws when fetch rejects", async () => {
    sendBeacon.mockReturnValue(false);
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(() => reportDegradation("tts_fallback")).not.toThrow();
    // Flush the rejection so it cannot surface as an unhandled rejection.
    await Promise.resolve();
  });
});
