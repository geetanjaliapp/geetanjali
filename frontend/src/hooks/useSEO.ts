import { useEffect } from "react";
import { SITE_URL } from "../lib/config";

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
  noIndex?: boolean;
}

const DEFAULT_TITLE = "Geetanjali - Ethical Guidance from the Bhagavad Gita";
const DEFAULT_DESCRIPTION =
  "Ethical leadership guidance and wisdom from the Bhagavad Gita for life's difficult decisions. Free consultations with timeless wisdom.";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * Custom hook for managing page-specific SEO meta tags
 * Updates document head on mount, restores defaults on unmount
 */
export function useSEO({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = "website",
  twitterCard = "summary_large_image",
  noIndex = false,
}: SEOProps = {}) {
  useEffect(() => {
    // Store original values for restoration
    const originalTitle = document.title;
    const originalMetas: Map<string, string | null> = new Map();

    // Helper to update or create meta tag
    const setMeta = (
      selector: string,
      content: string,
      attribute = "content",
    ) => {
      let element = document.querySelector(selector) as
        | HTMLMetaElement
        | HTMLLinkElement
        | null;

      if (element) {
        originalMetas.set(selector, element.getAttribute(attribute));
        element.setAttribute(attribute, content);
      } else {
        // Create new element if it doesn't exist
        if (selector.startsWith("link")) {
          element = document.createElement("link");
          const [, relValue] = selector.match(/rel="([^"]+)"/) || [];
          if (relValue) element.setAttribute("rel", relValue);
        } else {
          element = document.createElement("meta");
          // Parse selector to set attributes
          const nameMatch = selector.match(/name="([^"]+)"/);
          const propertyMatch = selector.match(/property="([^"]+)"/);
          if (nameMatch) element.setAttribute("name", nameMatch[1]);
          if (propertyMatch) element.setAttribute("property", propertyMatch[1]);
        }
        element.setAttribute(attribute, content);
        document.head.appendChild(element);
        originalMetas.set(selector, null); // Mark as newly created
      }
    };

    // Update title
    const fullTitle = title ? `${title} | Geetanjali` : DEFAULT_TITLE;
    document.title = fullTitle;

    // Update meta tags
    const finalDescription = description || DEFAULT_DESCRIPTION;
    const finalOgTitle = ogTitle || title || DEFAULT_TITLE;
    const finalOgDescription =
      ogDescription || description || DEFAULT_DESCRIPTION;
    const finalOgImage = ogImage || DEFAULT_IMAGE;
    const finalCanonical = canonical
      ? `${SITE_URL}${canonical}`
      : `${SITE_URL}/`;

    // Primary meta tags
    setMeta('meta[name="description"]', finalDescription);
    setMeta('meta[name="title"]', fullTitle);

    // Canonical URL
    setMeta('link[rel="canonical"]', finalCanonical, "href");

    // Open Graph
    setMeta('meta[property="og:title"]', finalOgTitle);
    setMeta('meta[property="og:description"]', finalOgDescription);
    setMeta('meta[property="og:image"]', finalOgImage);
    setMeta('meta[property="og:url"]', finalCanonical);
    setMeta('meta[property="og:type"]', ogType);

    // Twitter
    setMeta('meta[name="twitter:card"]', twitterCard);
    setMeta('meta[name="twitter:title"]', finalOgTitle);
    setMeta('meta[name="twitter:description"]', finalOgDescription);
    setMeta('meta[name="twitter:image"]', finalOgImage);

    // Robots
    if (noIndex) {
      setMeta('meta[name="robots"]', "noindex, nofollow");
    }

    // Cleanup: restore original values
    return () => {
      document.title = originalTitle;

      originalMetas.forEach((originalValue, selector) => {
        const element = document.querySelector(selector);
        if (element) {
          if (originalValue === null) {
            // Element was created by this hook, remove it
            element.remove();
          } else {
            // Restore original value
            const attribute = selector.startsWith("link") ? "href" : "content";
            element.setAttribute(attribute, originalValue);
          }
        }
      });
    };
  }, [
    title,
    description,
    canonical,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    twitterCard,
    noIndex,
  ]);
}
