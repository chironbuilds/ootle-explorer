import { useState } from "react";

/** Copies a shareable link (defaults to the current URL) with inline confirmation. Uses the
   Web Share API where it exists (mobile), falling back to the clipboard everywhere else. */
export function ShareButton({ path }: { path?: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;
    const nav = navigator as Navigator & { share?: (data: { url: string }) => Promise<void> };
    try {
      if (nav.share) {
        await nav.share({ url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1_400);
    } catch {
      // User dismissed the share sheet or clipboard was blocked -- nothing to surface.
    }
  };

  return (
    <button
      onClick={share}
      title="Share link to this page"
      aria-label="Share link to this page"
      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-dim transition-colors hover:border-accent-dim hover:text-ink"
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5l3 3 7-7" stroke="var(--success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M6.5 9.5l3-3M7 4.8l1.6-1.6a2.4 2.4 0 0 1 3.4 3.4L10.4 8.2M9 11.2l-1.6 1.6a2.4 2.4 0 0 1-3.4-3.4L5.6 7.8"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          Share
        </>
      )}
    </button>
  );
}
