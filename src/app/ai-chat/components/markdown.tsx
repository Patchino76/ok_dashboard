"use client";

import React, { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, ImageIcon } from "lucide-react";
import { getCurrentRole } from "../stores/role-store";

// Append the caller's role as a query param so native <img>/<a> requests
// (which can't send custom headers) still pass the backend role check.
export function withRole(url: string): string {
  const role = getCurrentRole();
  return (
    url + (url.includes("?") ? "&" : "?") + "role=" + encodeURIComponent(role)
  );
}

// ── Collapsible image (used inside markdown rendering) ─────────────────────
export function CollapsibleImage({ src, alt }: { src: string; alt: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-3 rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
        <ImageIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span className="text-xs text-gray-600 truncate">
          {alt || "Графика"}
        </span>
      </button>
      {expanded && (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <img src={src} alt={alt} className="w-full h-auto" loading="lazy" />
        </a>
      )}
    </div>
  );
}

function resolveImageSrc(rawSrc: string, baseUrl: string): string {
  if (rawSrc && !rawSrc.startsWith("http") && !rawSrc.startsWith("/")) {
    return withRole(`${baseUrl}/${encodeURIComponent(rawSrc)}`);
  }
  if (rawSrc.startsWith("/api/v1/agentic/reports/")) {
    return withRole(rawSrc);
  }
  return rawSrc;
}

// ── Custom markdown components (rewrite image src to API, make collapsible) ─
// Factory: returns components that resolve image paths with the correct analysisId
export function makeMarkdownComponents(
  analysisId?: string,
): Record<string, any> {
  const baseUrl = analysisId
    ? `/api/v1/agentic/reports/${encodeURIComponent(analysisId)}`
    : `/api/v1/agentic/reports`;

  return {
    // Avoid <div> inside <p> hydration error: detect images via the AST node
    // (the img component returns a <div>, which can't be inside <p>)
    p: ({ node, children, ...rest }: any) => {
      const hasImage = node?.children?.some(
        (child: any) =>
          child.tagName === "img" ||
          (child.type === "element" && child.tagName === "img"),
      );
      if (hasImage) {
        return (
          <div className="my-1" {...rest}>
            {children}
          </div>
        );
      }
      return <p {...rest}>{children}</p>;
    },
    img: ({ node, src, alt, ...rest }: any) => {
      const resolvedSrc = resolveImageSrc(String(src || ""), baseUrl);
      return <CollapsibleImage src={resolvedSrc} alt={String(alt || "")} />;
    },
  };
}

// ── Print-optimized markdown components (images always expanded) ───────────
export function makePrintMarkdownComponents(
  analysisId?: string,
): Record<string, any> {
  const baseUrl = analysisId
    ? `/api/v1/agentic/reports/${encodeURIComponent(analysisId)}`
    : `/api/v1/agentic/reports`;

  return {
    img: ({ node, src, alt, ...rest }: any) => {
      const resolvedSrc = resolveImageSrc(String(src || ""), baseUrl);
      return (
        <img
          src={resolvedSrc}
          alt={String(alt || "")}
          style={{ maxWidth: "100%", height: "auto", margin: "0.5rem 0" }}
        />
      );
    },
  };
}

// ── Printable report (hidden off-screen, used by react-to-print) ────────
export const PrintableReport = React.forwardRef<
  HTMLDivElement,
  { markdown: string; title: string; analysisId?: string }
>(function PrintableReport({ markdown, title, analysisId }, ref) {
  const printMdComponents = React.useMemo(
    () => makePrintMarkdownComponents(analysisId),
    [analysisId],
  );

  return (
    <div style={{ overflow: "hidden", height: 0, width: 0 }}>
      <div
        ref={ref}
        className="print-report"
        style={{
          width: "210mm",
          padding: "2rem",
          fontSize: "11pt",
          lineHeight: 1.6,
          color: "#1a1a1a",
          background: "white",
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={printMdComponents}>
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
});
