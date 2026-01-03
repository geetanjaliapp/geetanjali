import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { PreferencesProvider } from "../contexts/PreferencesContext";

interface WrapperProps {
  children: ReactNode;
}

// Wrapper with all providers (mirrors main.tsx provider hierarchy)
const AllProviders = ({ children }: WrapperProps) => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <PreferencesProvider>{children}</PreferencesProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

// Router only wrapper (for testing components without auth)
const RouterWrapper = ({ children }: WrapperProps) => {
  return (
    <BrowserRouter>
      <ThemeProvider>{children}</ThemeProvider>
    </BrowserRouter>
  );
};

// Custom render with all providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) => render(ui, { wrapper: AllProviders, ...options });

// Render with just router (no auth)
const renderWithRouter = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) => render(ui, { wrapper: RouterWrapper, ...options });

// Re-export everything from testing-library
export * from "@testing-library/react";
export { customRender as render, renderWithRouter };
