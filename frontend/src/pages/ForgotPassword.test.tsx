import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import ForgotPassword from "./ForgotPassword";
import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { authApi, tokenStorage } from "../api/auth";
import type { ReactNode } from "react";

// Mock the auth API
vi.mock("../api/auth", () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    refresh: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
  tokenStorage: {
    getToken: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    needsRefresh: vi.fn(),
    isExpired: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

describe("ForgotPassword Page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(tokenStorage.getToken).mockReturnValue(null);
  });

  it("should show success message after submitting", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.forgotPassword).mockResolvedValue({
      message:
        "If an account exists with this email, you will receive a password reset link.",
    });

    render(<ForgotPassword />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(
      screen.getByLabelText(/email address/i),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Check Your Email")).toBeInTheDocument();
    });

    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it("should show error message on failure", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.forgotPassword).mockRejectedValue(
      new Error("Something went wrong"),
    );

    render(<ForgotPassword />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(
      screen.getByLabelText(/email address/i),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      const errorBox = screen.getByText(/something went wrong/i);
      expect(errorBox).toBeInTheDocument();
    });
  });

  it("should disable button while loading", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.forgotPassword).mockImplementation(
      () => new Promise(() => {}),
    );

    render(<ForgotPassword />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    await user.type(
      screen.getByLabelText(/email address/i),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Sending...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    });
  });
});
