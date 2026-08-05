/**
 * Service worker caching-strategy tests.
 *
 * sw.js is a classic worker served from public/, so it is never imported by the app and had no test
 * coverage. Three bugs lived there as a result, all of the same family: a failure path that produced
 * no error. Each is pinned below.
 *
 * The file is evaluated with a stubbed worker scope rather than refactored into a module, so the
 * thing under test is the artifact that actually ships.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://geetanjaliapp.com";

function swFile(): string {
  for (const base of [process.cwd(), resolve(process.cwd(), "frontend")]) {
    const candidate = resolve(base, "public/sw.js");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not locate public/sw.js from cwd ${process.cwd()}`);
}

/** In-memory stand-in for the CacheStorage API. */
function makeCaches(seed: Record<string, Response> = {}) {
  const store = new Map<string, Response>(Object.entries(seed));
  const keyOf = (req: RequestInfo): string =>
    typeof req === "string" ? req : (req as Request).url;

  const cache = {
    match: vi.fn(async (req: RequestInfo) => store.get(keyOf(req))),
    put: vi.fn(async (req: RequestInfo, res: Response) => {
      store.set(keyOf(req), res);
    }),
    keys: vi.fn(async () => []),
    delete: vi.fn(async () => true),
    addAll: vi.fn(async () => undefined),
  };

  return {
    store,
    api: {
      open: vi.fn(async () => cache),
      match: vi.fn(async (req: RequestInfo) => store.get(keyOf(req))),
      keys: vi.fn(async () => []),
      delete: vi.fn(async () => true),
    },
  };
}

interface SwExports {
  audioCacheKey: (url: string) => string;
  offlineResponse: (request: Request) => Response;
  appShellOrOffline: (request: Request) => Promise<Response>;
  cacheFirst: (request: Request, cacheName: string) => Promise<Response>;
  networkFirstWithCache: (
    request: Request,
    cacheName: string,
    maxAge?: number,
  ) => Promise<Response>;
}

function loadSw(opts: {
  caches?: ReturnType<typeof makeCaches>["api"];
  fetch?: typeof fetch;
}): SwExports {
  const src = readFileSync(swFile(), "utf8");
  const failingFetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as unknown as typeof fetch;

  // Evaluated in a vm context rather than imported: sw.js is a classic worker script, so this
  // exercises the artifact that actually ships instead of a module-shaped copy of it.
  const context = createContext({
    self: {
      addEventListener: () => {},
      location: { origin: ORIGIN },
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [] },
      registration: {},
    },
    caches: opts.caches ?? makeCaches().api,
    fetch: opts.fetch ?? failingFetch,
    // Passed in from this realm so `instanceof` still holds in assertions.
    Response,
    Request,
    Headers,
    URL,
    console,
  });

  // The trailing expression shares the script's lexical scope, so top-level declarations are
  // reachable; runInContext returns its value.
  return runInContext(
    `${src}
;({ audioCacheKey, offlineResponse, appShellOrOffline, cacheFirst, networkFirstWithCache })`,
    context,
  ) as SwExports;
}

const htmlRequest = (path = "/cases/abc") =>
  new Request(`${ORIGIN}${path}`, { headers: { accept: "text/html" } });
const assetRequest = (path = "/api/v1/verses/BG_2_47") =>
  new Request(`${ORIGIN}${path}`, { headers: { accept: "application/json" } });

describe("audioCacheKey", () => {
  let sw: SwExports;
  beforeEach(() => {
    sw = loadSw({});
  });

  it("resolves the relative paths audioPreload.ts actually posts", () => {
    // The bug: new URL('/audio/x.mp3') with no base throws
    // "Failed to construct 'URL': Invalid URL", so every preload failed.
    expect(() => sw.audioCacheKey("/audio/bg_2_47.mp3")).not.toThrow();
    expect(sw.audioCacheKey("/audio/bg_2_47.mp3")).toBe(
      `${ORIGIN}/audio/bg_2_47.mp3`,
    );
  });

  it("still handles absolute URLs", () => {
    expect(sw.audioCacheKey(`${ORIGIN}/audio/bg_2_47.mp3`)).toBe(
      `${ORIGIN}/audio/bg_2_47.mp3`,
    );
  });

  it("normalises away query strings so cache keys stay stable", () => {
    expect(sw.audioCacheKey("/audio/bg_2_47.mp3?v=2")).toBe(
      `${ORIGIN}/audio/bg_2_47.mp3`,
    );
  });
});

describe("appShellOrOffline", () => {
  it("returns a real 503 when the shell was never cached", async () => {
    // The bug: `caches.match('/') || new Response(...)` -- a Promise is always truthy, so the
    // fallback was unreachable and this resolved to undefined. respondWith(undefined) is a
    // network error, which is exactly the dead FetchEvent seen in production.
    const sw = loadSw({ caches: makeCaches().api });
    const res = await sw.appShellOrOffline(htmlRequest());

    expect(res).toBeInstanceOf(Response);
    expect(res).toBeDefined();
    expect(res.status).toBe(503);
  });

  it("returns the cached shell when present", async () => {
    const caches = makeCaches({ "/": new Response("<html>shell</html>") });
    const sw = loadSw({ caches: caches.api });
    const res = await sw.appShellOrOffline(htmlRequest());

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain("shell");
  });
});

describe("offlineResponse", () => {
  let sw: SwExports;
  beforeEach(() => {
    sw = loadSw({});
  });

  it("serves HTML to navigations", () => {
    const res = sw.offlineResponse(htmlRequest());
    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("serves plain text to non-navigations", () => {
    const res = sw.offlineResponse(assetRequest());
    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });
});

describe("networkFirstWithCache", () => {
  it("resolves with 503 rather than rejecting when offline and uncached", async () => {
    // The bug: `throw error` rejected the promise handed to event.respondWith(), producing
    // "FetchEvent ... resulted in a network error response: the promise was rejected" plus an
    // uncaught rejection, and giving the caller no status to branch on.
    const sw = loadSw({ caches: makeCaches().api });
    const res = await sw.networkFirstWithCache(assetRequest(), "dynamic");

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(503);
  });

  it("prefers cached content over the offline response", async () => {
    const req = assetRequest();
    const caches = makeCaches({ [req.url]: new Response('{"cached":true}') });
    const sw = loadSw({ caches: caches.api });

    const res = await sw.networkFirstWithCache(req, "dynamic");
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain("cached");
  });

  it("returns the network response when online", async () => {
    const ok = (async () => new Response("live", { status: 200 })) as unknown as typeof fetch;
    const sw = loadSw({ caches: makeCaches().api, fetch: ok });

    const res = await sw.networkFirstWithCache(assetRequest(), "dynamic");
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe("live");
  });
});

describe("cacheFirst", () => {
  it("resolves with 503 rather than rejecting for uncached assets when offline", async () => {
    const sw = loadSw({ caches: makeCaches().api });
    const res = await sw.cacheFirst(assetRequest("/assets/app.js"), "static");

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(503);
  });

  it("falls back to the app shell for navigations", async () => {
    const caches = makeCaches({ "/": new Response("<html>shell</html>") });
    const sw = loadSw({ caches: caches.api });

    const res = await sw.cacheFirst(htmlRequest(), "static");
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain("shell");
  });
});
