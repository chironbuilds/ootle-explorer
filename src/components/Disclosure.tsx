import type { ReactNode } from "react";

/** A collapsible row: always-visible summary line, expandable detail below. Shared by anything
 * that pairs a readable one-line summary with a raw-JSON drill-down (instructions, substate diff
 * entries) so the disclosure chevron and layout stay identical everywhere it's used. */
export function Disclosure({ summary, children, className = "" }: { summary: ReactNode; children: ReactNode; className?: string }) {
  return (
    <details className={`group px-5 py-3.5 ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0 text-ink-faint transition-transform group-open:rotate-90">
          <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {summary}
      </summary>
      <div className="mt-2 pl-4">{children}</div>
    </details>
  );
}
