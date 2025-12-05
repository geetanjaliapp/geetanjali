import type { ReactNode } from 'react';
import { Navbar } from './Navbar';

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex flex-col">
      {navbar && <Navbar />}
      {children}
    </div>
  );
}

export default PageLayout;
