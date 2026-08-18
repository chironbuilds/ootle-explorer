import { useState } from "react";
import { Link } from "react-router-dom";
import { linkForId } from "../lib/links";

function truncate(value: string, lead = 10, tail = 8): string {
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** A hash/address rendered in monospace, truncated by default with a copy button, and linked to
 * its detail page when the value's shape identifies one (substate id or 64-hex transaction id).
 * `linkOverride` bypasses that shape guess for bare 64-hex values whose surrounding context (a
 * JSON key like `template_address`) already disambiguates them -- shape alone can't tell a
 * template address from a transaction id, both being bare 64-hex. */
export function Hash({
  value,
  full = false,
  link = true,
  linkOverride,
  className = "",
}: {
  value: string;
  full?: boolean;
  link?: boolean;
  linkOverride?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = full ? value : truncate(value);
  const target = link ? (linkOverride ?? linkForId(value)) : null;

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const content = (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[0.9em] ${full ? "flex-wrap break-all" : ""} ${className}`} title={value}>
      <span className={target ? "text-accent hover:text-accent-strong" : "text-ink"}>{display}</span>
      <button
        onClick={copy}
        className="shrink-0 rounded p-0.5 text-ink-faint opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3 3 7-7" stroke="var(--success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M3 10.2V3.4A1.4 1.4 0 0 1 4.4 2h6.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </span>
  );

  if (target) {
    return (
      <Link to={target} className="group inline-flex items-center">
        {content}
      </Link>
    );
  }
  return <span className="group inline-flex items-center">{content}</span>;
}
