import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import Signup from "./Signup";
import { AuthProvider } from "../contexts/AuthContext";
import { authApi, tokenStorage } from "../api/auth";
import { mockUser } from "../test/fixtures";
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
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
);

describe("Signup Page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(tokenStorage.getToken).mockReturnValue(null);
  });

  describe("Form Rendering", () => {
    it("should render signup form with all fields", async () => {
      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /sign up/i }),
      ).toBeInTheDocument();
    });

    it("should have link to login page", async () => {
      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText("Already have an account?"),
        ).toBeInTheDocument();
      });

      // Find the sign in link after "Already have an account?"
      const signInLinks = screen.getAllByRole("link", { name: /sign in/i });
      expect(signInLinks.length).toBeGreaterThan(0);
      expect(
        signInLinks.some((link) => link.getAttribute("href") === "/login"),
      ).toBe(true);
    });

    it("should show password requirements hint", async () => {
      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText(/at least 8 characters with one letter and one number/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form Input", () => {
    it("should allow typing in all form fields", async () => {
      const user = userEvent.setup();
      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, "John Doe");
      await user.type(emailInput, "john@example.com");
      await user.type(passwordInput, "Password123");
      await user.type(confirmInput, "Password123");

      expect(nameInput).toHaveValue("John Doe");
      expect(emailInput).toHaveValue("john@example.com");
      expect(passwordInput).toHaveValue("Password123");
      expect(confirmInput).toHaveValue("Password123");
    });
  });

  describe("Password Validation", () => {
    it("should show error when passwords do not match", async () => {
      const user = userEvent.setup();
      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/full name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "Password123");
      await user.type(screen.getByLabelText(/confirm password/i), "DifferentPass456");
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      await waitFor(() => {
        expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
      });

      // Should not call signup API
      expect(authApi.signup).not.toHaveBeenCalled();
    });

    it("should show error when password is too short", async () => {
      const user = userEvent.setup();
      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/full name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
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

    it("should show error when password has no letters", async () => {
      const user = userEvent.setup();
      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/full name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
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

    it("should show error when password has no numbers", async () => {
      const user = userEvent.setup();
      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/full name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
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

  describe("Form Submission", () => {
    it("should call signup and navigate on success", async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.signup).mockResolvedValue({
        access_token: "token",
        token_type: "bearer",
        user: mockUser,
      });

      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/full name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "Password123");
      await user.type(screen.getByLabelText(/confirm password/i), "Password123");
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      await waitFor(() => {
        expect(authApi.signup).toHaveBeenCalledWith({
          name: "John Doe",
          email: "john@example.com",
          password: "Password123",
        });
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });
    });

    it("should show error message on signup failure", async () => {
      const user = userEvent.setup();
      vi.mocked(authApi.signup).mockRejectedValue(
        new Error("Email already exists"),
      );

      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/full name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "existing@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "Password123");
      await user.type(screen.getByLabelText(/confirm password/i), "Password123");
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      await waitFor(() => {
        expect(screen.getByText("Email already exists")).toBeInTheDocument();
      });
    });

    it("should disable button and show loading state while submitting", async () => {
      const user = userEvent.setup();
      // Make signup hang
      vi.mocked(authApi.signup).mockImplementation(() => new Promise(() => {}));

      render(<Signup />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/full name/i), "John Doe");
      await user.type(screen.getByLabelText(/email address/i), "john@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "Password123");
      await user.type(screen.getByLabelText(/confirm password/i), "Password123");
      await user.click(screen.getByRole("button", { name: /sign up/i }));

      await waitFor(() => {
        expect(screen.getByText("Creating account...")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /creating account/i }),
        ).toBeDisabled();
      });
    });
  });
});
