"use client";

import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";

const EMPTY_PLACEHOLDER = "No description provided.";

export interface MarkdownContentProps {
  /** Raw issue/PR body (markdown). Empty/whitespace/null renders a placeholder. */
  content?: string | null | undefined;
}

/**
 * Sanitized markdown renderer for issue/PR bodies.
 *
 * Renders GitHub-flavored markdown via `react-markdown`, which is safe by
 * default: raw HTML is escaped and never executed. As defense in depth (design
 * D7), DOMPurify additionally strips dangerous tags and event handlers from the
 * source before rendering. Empty or whitespace-only body renders the "No
 * description provided." placeholder instead of an empty box.
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  const text = (content ?? "").trim();

  if (!text) {
    return <p className="text-xs italic text-muted-foreground">{EMPTY_PLACEHOLDER}</p>;
  }

  const sanitized = sanitizeHtml(text);

  return (
    <div className="font-sans text-sm leading-relaxed text-foreground/90">
      <ReactMarkdown>{sanitized}</ReactMarkdown>
    </div>
  );
}

/**
 * DOMPurify needs a DOM to run; during SSR prerender (no `window`) react-markdown
 * still escapes raw HTML, so passing the source through unchanged is safe there.
 * On the client the dangerous markup is stripped before it reaches the renderer.
 */
function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html);
}
