/**
 * GuidanceMarkdown - Markdown renderer with verse reference linking
 *
 * Renders guidance text with automatic verse reference detection.
 * Verse references (BG_X_Y) become clickable pills that open a
 * popover with the verse paraphrase.
 *
 * Usage:
 *   <GuidanceMarkdown
 *     content={guidance.text}
 *     sources={output.result_json.sources}
 *   />
 */

import { useMemo, useState, useCallback } from "react";
import Markdown from "react-markdown";
import { VersePopover } from "./VersePopover";
import {
  extractVerseRefs,
  formatVerseRef,
  type VerseRef,
} from "../lib/verseLinker";
import { versesApi } from "../lib/api";

interface Source {
  canonical_id: string;
  paraphrase: string;
  school?: string;
}

interface GuidanceMarkdownProps {
  /** Markdown content to render */
  content: string;
  /** Sources from output.result_json.sources for paraphrase lookup */
  sources?: Source[];
  /** Additional className for the container */
  className?: string;
}

/**
 * Split text into segments of plain text and verse references
 */
function splitTextWithVerseRefs(
  text: string
): Array<{ type: "text"; content: string } | { type: "verse"; ref: VerseRef }> {
  const refs = extractVerseRefs(text);
  if (refs.length === 0) {
    return [{ type: "text", content: text }];
  }

  const segments: Array<
    { type: "text"; content: string } | { type: "verse"; ref: VerseRef }
  > = [];
  let lastIndex = 0;

  for (const ref of refs) {
    // Add text before this reference
    if (ref.startIndex > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, ref.startIndex),
      });
    }

    // Add the verse reference
    segments.push({ type: "verse", ref });
    lastIndex = ref.endIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Component to render a single verse reference with popover
 */
function VerseRefWithPopover({
  verseRef,
  sources,
  fetchedParaphrases,
  onFetchParaphrase,
}: {
  verseRef: VerseRef;
  sources: Source[];
  fetchedParaphrases: Map<string, string>;
  onFetchParaphrase: (canonicalId: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  // Find paraphrase in sources or fetched cache
  const paraphrase = useMemo(() => {
    // First check sources
    const source = sources.find(
      (s) => s.canonical_id === verseRef.canonicalId
    );
    if (source) return source.paraphrase;

    // Then check fetched cache
    return fetchedParaphrases.get(verseRef.canonicalId);
  }, [sources, fetchedParaphrases, verseRef.canonicalId]);

  // Fetch paraphrase when popover opens if not available
  const handleOpen = useCallback(async () => {
    if (paraphrase || loading) return;

    setLoading(true);
    try {
      await onFetchParaphrase(verseRef.canonicalId);
    } finally {
      setLoading(false);
    }
  }, [paraphrase, loading, onFetchParaphrase, verseRef.canonicalId]);

  // Display format - preserve parentheses if original had them
  const displayText = verseRef.hasParens
    ? `(${formatVerseRef(verseRef.canonicalId)})`
    : formatVerseRef(verseRef.canonicalId);

  return (
    <VersePopover
      canonicalId={verseRef.canonicalId}
      chapter={verseRef.chapter}
      paraphrase={paraphrase}
      loading={loading}
      onOpen={handleOpen}
    >
      {displayText}
    </VersePopover>
  );
}

export function GuidanceMarkdown({
  content,
  sources = [],
  className = "",
}: GuidanceMarkdownProps) {
  // Cache for fetched paraphrases (for verses not in sources)
  const [fetchedParaphrases, setFetchedParaphrases] = useState<
    Map<string, string>
  >(new Map());

  // Fetch paraphrase from API
  const fetchParaphrase = useCallback(async (canonicalId: string) => {
    // Skip if already fetched
    if (fetchedParaphrases.has(canonicalId)) return;

    try {
      const verse = await versesApi.get(canonicalId);
      if (verse?.paraphrase_en) {
        const paraphraseText = verse.paraphrase_en;
        setFetchedParaphrases((prev) => {
          const next = new Map(prev);
          next.set(canonicalId, paraphraseText);
          return next;
        });
      }
    } catch (error) {
      // Silently fail - popover will show "not available"
      console.warn(`Failed to fetch verse ${canonicalId}:`, error);
    }
  }, [fetchedParaphrases]);

  // Split content into segments
  const segments = useMemo(() => splitTextWithVerseRefs(content), [content]);

  // Check if there are any verse refs
  const hasVerseRefs = segments.some((s) => s.type === "verse");

  // If no verse refs, render plain markdown
  if (!hasVerseRefs) {
    return (
      <div className={className}>
        <Markdown>{content}</Markdown>
      </div>
    );
  }

  // Render segments with verse popovers
  // We need to handle this carefully because Markdown expects a string,
  // but we want to inject React components for verse refs.
  // Strategy: Render each text segment through Markdown, verse refs as components.
  return (
    <div className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          // Render text through Markdown
          // Use span wrapper to keep inline flow
          return (
            <Markdown
              key={index}
              components={{
                // Unwrap p tags to keep inline
                p: ({ children }) => <>{children}</>,
              }}
            >
              {segment.content}
            </Markdown>
          );
        } else {
          // Render verse ref with popover
          return (
            <VerseRefWithPopover
              key={`verse-${index}-${segment.ref.canonicalId}`}
              verseRef={segment.ref}
              sources={sources}
              fetchedParaphrases={fetchedParaphrases}
              onFetchParaphrase={fetchParaphrase}
            />
          );
        }
      })}
    </div>
  );
}
