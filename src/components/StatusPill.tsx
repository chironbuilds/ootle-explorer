const TONES: Record<string, { fg: string; bg: string; dot: string }> = {
  commit: { fg: "text-success", bg: "bg-success/10", dot: "bg-success" },
  reject: { fg: "text-danger", bg: "bg-danger/10", dot: "bg-danger" },
  abort: { fg: "text-danger", bg: "bg-danger/10", dot: "bg-danger" },
  pending: { fg: "text-pending", bg: "bg-pending/10", dot: "bg-pending" },
  feeintentcommit: { fg: "text-pending", bg: "bg-pending/10", dot: "bg-pending" },
  unknown: { fg: "text-ink-dim", bg: "bg-white/5", dot: "bg-ink-faint" },
};

export function StatusPill({ outcome }: { outcome?: string | null }) {
  const key = (outcome ?? "pending").toLowerCase();
  const tone = TONES[key] ?? TONES.unknown!;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone.bg} ${tone.fg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {outcome ?? "Pending"}
    </span>
  );
}

/** Marks a value as confidential ("veiled") vs. plainly revealed -- the core distinction this
 * chain's transfers make, surfaced directly rather than left implicit in raw JSON. */
export function VeilBadge({ veiled }: { veiled: boolean }) {
  return veiled ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-veil/10 px-2.5 py-1 text-xs font-medium text-veil">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 8s2.2-4.5 6-4.5S14 8 14 8s-2.2 4.5-6 4.5S2 8 2 8z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 3l10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      Veiled
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-reveal/10 px-2.5 py-1 text-xs font-medium text-reveal">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <path d="M2 8s2.2-4.5 6-4.5S14 8 14 8s-2.2 4.5-6 4.5S2 8 2 8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      Revealed
    </span>
  );
}
