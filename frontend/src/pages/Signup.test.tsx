import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import Signup from "./Signup";
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
  },
  tokenStorage: {
    getToken: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    needsRefresh: vi.fn(),
    isExpired: vi.fn(),
  },
}));

// Mock useNavigate
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

describe("Signup Password Validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(tokenStorage.getToken).mockReturnValue(null);
  });

  it("should reject passwords that don't match", async () => {
    const user = userEvent.setup();
    render(<Signup />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/full name/i), "John Doe");
    await user.type(
      screen.getByLabelText(/email address/i),
      "john@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "Password123");
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "DifferentPass456",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    });
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it("should reject passwords shorter than 8 characters", async () => {
    const user = userEvent.setup();
    render(<Signup />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/full name/i), "John Doe");
    await user.type(
      screen.getByLabelText(/email address/i),
      "john@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "Pass1");
    await user.type(screen.getByLabelText(/confirm password/i), "Pass1");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 8 characters long"),
      ).toBeInTheDocument();
    });
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it("should reject passwords without letters", async () => {
    const user = userEvent.setup();
    render(<Signup />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/full name/i), "John Doe");
    await user.type(
      screen.getByLabelText(/email address/i),
      "john@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "12345678");
    await user.type(screen.getByLabelText(/confirm password/i), "12345678");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Password must contain at least one letter"),
      ).toBeInTheDocument();
    });
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it("should reject passwords without numbers", async () => {
    const user = userEvent.setup();
    render(<Signup />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/full name/i), "John Doe");
    await user.type(
      screen.getByLabelText(/email address/i),
      "john@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "Password");
    await user.type(screen.getByLabelText(/confirm password/i), "Password");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Password must contain at least one number"),
      ).toBeInTheDocument();
    });
    expect(authApi.signup).not.toHaveBeenCalled();
  });
});
