interface Props {
  page: number;
  pageCount?: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}

export function Pagination({ page, pageCount, canPrev, canNext, onPrev, onNext, disabled }: Props) {
  return (
    <div className="flex items-center justify-between border-t border-border-soft px-5 py-3">
      <button
        onClick={onPrev}
        disabled={!canPrev || disabled}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink-dim transition-colors hover:enabled:text-ink hover:enabled:border-accent-dim disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Previous
      </button>
      <span className="tabular text-xs text-ink-faint">
        Page {page}
        {pageCount ? ` of ${pageCount}` : ""}
      </span>
      <button
        onClick={onNext}
        disabled={!canNext || disabled}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink-dim transition-colors hover:enabled:text-ink hover:enabled:border-accent-dim disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  );
}
