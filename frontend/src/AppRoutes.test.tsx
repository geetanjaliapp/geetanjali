import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppRoutes } from "./AppRoutes";

// Read at runtime, not imported: tsconfig.app.json type-checks tests during `npm run build`,
// and the image build context holds only frontend/, so a static import breaks the build.
// Relative to cwd: vitest runs from frontend/, and import.meta.url is not a file: URL here.
const sitemap: { shapes: { sample: string }[] } = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "../scripts/synthetic/sitemap-shapes.json"),
    "utf-8",
  ),
);

// Every page is a stub: this tests the route table, not the pages behind it.
vi.mock("./lib/lazyWithRetry", () => ({
  lazyWithRetry: () =>
    function Page() {
      return <div data-testid="page" />;
    },
}));
vi.mock("./pages/Home", () => ({
  default: () => <div data-testid="page" />,
}));
vi.mock("./pages/NotFound", () => ({
  default: () => <div data-testid="not-found" />,
}));

function Location() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
      <Location />
    </MemoryRouter>,
  );
}

describe("AppRoutes", () => {
  // The bug this guards: nginx served crawlers a page at /daily, /featured and
  // /verses/chapter/N for nine months while people who clicked through got NotFound.
  it.each(sitemap.shapes.map((s) => s.sample))(
    "sitemap URL %s renders a page, not NotFound",
    (url) => {
      renderAt(url);
      expect(screen.queryByTestId("not-found")).toBeNull();
      expect(screen.getByTestId("page")).toBeInTheDocument();
    },
  );

  it("renders NotFound for an unknown path, so the check above can fail", () => {
    renderAt("/nonexistent-xyz");
    expect(screen.getByTestId("not-found")).toBeInTheDocument();
  });

  it("sends /verses/chapter/N to the chapter filter", () => {
    renderAt("/verses/chapter/2");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/verses?chapter=2",
    );
  });

  it.each(["/verses/chapter/0", "/verses/chapter/19", "/verses/chapter/2x"])(
    "renders NotFound for out-of-range chapter %s",
    (url) => {
      renderAt(url);
      expect(screen.getByTestId("not-found")).toBeInTheDocument();
    },
  );

  it("sends /featured to the verse browser", () => {
    renderAt("/featured");
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/verses$/);
  });
});
