import { describe, expect, it } from "vitest";
import { sentryBeforeBreadcrumb, sentryBeforeSend } from "./monitoring";

const SITE = "https://geetanjaliapp.com";
const SECRET = "tok_9f2c";

const tokenUrls = [
  "/verify-email/{}",
  "/n/verify/{}",
  "/n/unsubscribe/{}",
  "/n/preferences/{}",
  "/reset-password?token={}",
  "/api/v1/newsletter/preferences/{}",
];

describe("Sentry scrubbing", () => {
  it.each(tokenUrls)("filters the token in %s", (path) => {
    const url = SITE + path.replace("{}", SECRET);
    const event = sentryBeforeSend({
      type: undefined,
      request: { url, headers: { Referer: url } },
      user: { email: "a@example.com", ip_address: "203.0.113.9" },
      exception: { values: [{ type: "Error", value: `Failed: ${url}` }] },
      extra: { context: { href: url } },
      breadcrumbs: [
        { category: "navigation", data: { from: url, to: url } },
        { category: "fetch", data: { url, method: "GET" } },
        { category: "sentry.event", message: `Error: ${url}` },
      ],
    });

    expect(JSON.stringify(event)).not.toContain(SECRET);
    expect(event?.request?.url).toBe(SITE + path.replace("{}", "[Filtered]"));
    expect(event?.user).toEqual({});
  });

  it("drops console breadcrumbs", () => {
    const url = `${SITE}/n/unsubscribe/${SECRET}`;
    const crumb = sentryBeforeBreadcrumb({
      category: "console",
      message: `GET ${url}`,
      data: { arguments: ["GET", { config: { url } }], logger: "console" },
    });

    expect(crumb).toBeNull();
  });

  it("keeps ordinary URLs and the text around a token", () => {
    const url = `${SITE}/c/abc123?ref=home`;
    const event = sentryBeforeSend({
      type: undefined,
      request: { url },
      exception: {
        values: [{ value: `GET ${SITE}/n/verify/${SECRET}: 404 (Not Found)` }],
      },
    });

    expect(event.request?.url).toBe(url);
    expect(event.exception?.values?.[0].value).toBe(
      `GET ${SITE}/n/verify/[Filtered]: 404 (Not Found)`,
    );
  });
});
