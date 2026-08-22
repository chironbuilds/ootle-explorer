import { useEffect } from "react";

/** Sets a per-page document title so tabs/history entries are distinguishable. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Veil` : "Veil — Tari Ootle Explorer";
  }, [title]);
}

/** Shortens a hash for display in titles, e.g. "abc12345…wxyz". */
export function shortHash(value: string, lead = 8): string {
  return value.length <= lead + 6 ? value : `${value.slice(0, lead)}…`;
}
