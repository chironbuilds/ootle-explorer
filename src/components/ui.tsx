import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface ${className}`}>{children}</div>;
}

export function StatTile({
  label,
  value,
  sub,
  accent = "accent",
  title,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "accent" | "reveal" | "veil";
  title?: string;
}) {
  const colors = { accent: "text-accent", reveal: "text-reveal", veil: "text-veil" } as const;
  return (
    <Card className="min-w-0 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p title={title} className={`font-display tabular mt-2 truncate text-2xl font-semibold ${colors[accent]}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-dim">{sub}</p>}
    </Card>
  );
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-dim">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-dim">{children}</h2>;
}

export function KeyValueRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border-soft px-5 py-3.5 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-full shrink-0 text-sm text-ink-faint sm:w-44">{label}</div>
      <div className="min-w-0 flex-1 text-sm text-ink">{children}</div>
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" stroke="var(--border)" strokeWidth="2.5" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-surface py-16 text-sm text-ink-dim">
      <Spinner />
      {label}
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 px-5 py-8 text-center">
      <p className="text-sm font-medium text-danger">Couldn't load this from the indexer</p>
      <p className="mt-1 font-mono text-xs text-ink-faint">{message}</p>
    </div>
  );
}

export function ProgressBar({
  fraction,
  label,
  accent = "accent",
}: {
  /** 0-1. Values outside that range are clamped, so a caller doesn't need to pre-guard rounding. */
  fraction: number;
  label?: ReactNode;
  accent?: "accent" | "reveal" | "veil";
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  const colors = { accent: "bg-accent", reveal: "bg-reveal", veil: "bg-veil" } as const;
  return (
    <div className="min-w-0">
      {label && <div className="mb-1.5 flex items-center justify-between text-xs text-ink-dim">{label}</div>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${colors[accent]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "reveal" | "veil";
  title?: string;
}) {
  const tones = {
    neutral: "bg-surface-2 text-ink-dim",
    accent: "bg-accent/10 text-accent",
    reveal: "bg-reveal/10 text-reveal",
    veil: "bg-veil/10 text-veil",
  } as const;
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
