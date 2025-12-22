import { Link } from "react-router-dom";

/**
 * Footer component - single line on desktop, stacked on mobile
 * - Links: About, Contact, GitHub
 * - Trust signals: 701 Verses, Private to you, Always Free
 * - Copyleft
 */
export function Footer() {
  return (
    <footer className="border-t border-amber-200/50 dark:border-gray-700/50 bg-amber-50/50 dark:bg-gray-900/50 py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile: Stacked layout */}
        <div className="sm:hidden text-center space-y-3">
          {/* Links */}
          <div className="flex justify-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <Link
              to="/"
              className="font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
            >
              Geetanjali
            </Link>
            <Link
              to="/about"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              About
            </Link>
            <Link
              to="/about#contact"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Contact
            </Link>
            <a
              href="https://github.com/geetanjaliapp/geetanjali"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              GitHub
            </a>
          </div>
          {/* Trust signals */}
          <div className="flex justify-center gap-3 text-xs text-gray-500 dark:text-gray-500">
            <span>701 Verses</span>
            <span>·</span>
            <span>Private to you</span>
            <span>·</span>
            <span>Always Free</span>
          </div>
          {/* Copyleft */}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            <span className="inline-block -scale-x-100">©</span>{" "}
            {new Date().getFullYear()}{" "}
            <Link
              to="/"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Geetanjali
            </Link>
          </p>
        </div>

        {/* Desktop: Single line */}
        <div className="hidden sm:flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          {/* Left: Links */}
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
            >
              Geetanjali
            </Link>
            <Link
              to="/about"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              About
            </Link>
            <Link
              to="/about#contact"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Contact
            </Link>
            <a
              href="https://github.com/geetanjaliapp/geetanjali"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              GitHub
            </a>
          </div>

          {/* Center: Trust signals */}
          <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
            <span>701 Verses</span>
            <span>·</span>
            <span>Private to you</span>
            <span>·</span>
            <span>Always Free</span>
          </div>

          {/* Right: Copyleft */}
          <span className="text-gray-400 dark:text-gray-500">
            <span className="inline-block -scale-x-100">©</span>{" "}
            {new Date().getFullYear()}{" "}
            <Link
              to="/"
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Geetanjali
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
