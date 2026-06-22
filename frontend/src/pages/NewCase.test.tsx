import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock dependencies to keep the test focused on the anchor verse UI
vi.mock("../lib/api", () => ({
  casesApi: {
    create: vi.fn().mockResolvedValue({ id: "test-case-id" }),
    analyze: vi.fn().mockResolvedValue(undefined),
  },
  preferencesApi: {
    get: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
  versesApi: {
    getDaily: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../hooks", () => ({
  useSEO: vi.fn(),
  useAsyncAction: vi.fn(() => ({
    loading: false,
    error: null,
    execute: vi.fn((fn: () => Promise<unknown>) => fn()),
  })),
}));

vi.mock("../lib/experiment", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("../lib/contentFilter", () => ({
  validateContent: vi.fn(),
}));

vi.mock("../lib/storage", () => ({
  getStorageItem: vi.fn(() => null),
  setStorageItem: vi.fn(),
  removeStorageItem: vi.fn(),
  STORAGE_KEYS: {},
}));

vi.mock("../contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("../contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

// Mock components barrel to avoid deep dependency tree in unit test
vi.mock("../components", () => ({
  Navbar: () => <nav data-testid="navbar-mock">Navbar</nav>,
}));

vi.mock("../components/ExampleQuestions", () => ({
  ExampleQuestions: () => null,
}));

vi.mock("../components/InspirationVerse", () => ({
  InspirationVerse: () => null,
}));

import NewCase from "./NewCase";

describe("NewCase with anchor verse", () => {
  it("shows anchor banner when ?verse= is present", () => {
    render(
      <MemoryRouter initialEntries={["/cases/new?verse=BG_2_47"]}>
        <NewCase />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/Guidance anchored to/)
    ).toBeInTheDocument();
    expect(screen.getByText("BG 2 47")).toBeInTheDocument();
  });

  it("shows dismiss button on anchor banner", () => {
    render(
      <MemoryRouter initialEntries={["/cases/new?verse=BG_2_47"]}>
        <NewCase />
      </MemoryRouter>
    );
    const dismissBtn = screen.getByLabelText(/Remove anchor verse/);
    expect(dismissBtn).toBeInTheDocument();
  });

  it("does not show anchor banner without ?verse=", () => {
    render(
      <MemoryRouter initialEntries={["/cases/new"]}>
        <NewCase />
      </MemoryRouter>
    );
    expect(
      screen.queryByText(/Guidance anchored to/)
    ).not.toBeInTheDocument();
  });
});
