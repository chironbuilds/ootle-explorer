import type { ReactNode } from "react";

/** Shimmering placeholder block -- sized/positioned by the caller via className so skeletons can
 * mirror the exact layout of the content they stand in for (no layout jump on load). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** Matches StatTile's padding/type scale. */
export function StatTileSkeleton() {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface p-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-12" />
    </div>
  );
}

/** A stack of table-row-shaped placeholders for Card-based lists. */
export function TableRowsSkeleton({ rows = 8, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border-soft px-5 py-3.5 last:border-0">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? "w-40" : c === cols - 1 ? "ml-auto w-16" : "w-24"}`} />
          ))}
        </div>
      ))}
      {rows === 0 && null}
    </div>
  );
}

/** Small labeled placeholder used where LoadingBlock's centered spinner would cause the page to
   collapse to a fixed height and then expand (tables, panels). */
export function InlineSkeleton({ children }: { children?: ReactNode }) {
  return <div className="text-xs text-ink-faint">{children}</div>;
}
