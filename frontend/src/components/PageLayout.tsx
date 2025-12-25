import type { ReactNode } from "react";
import { Navbar } from "./navigation/Navbar";
import { VerifyEmailBanner } from "./VerifyEmailBanner";

interface PageLayoutProps {
  children: ReactNode;
  navbar?: boolean;
}

/**
 * Shared layout wrapper for pages with consistent background and navbar
 * Provides the standard gradient background and navbar found across the application
 */
export function PageLayout({ children, navbar = true }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--surface-page)] flex flex-col">
      {navbar && <Navbar />}
      <VerifyEmailBanner />
      {children}
    </div>
  );
}

export default PageLayout;
