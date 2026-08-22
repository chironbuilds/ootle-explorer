import { useEffect, useRef, useState } from "react";
import type { RecentTransactionSummary } from "./indexer";

export interface TxPulse {
  /** Arrival counts per refresh, oldest first -- the sparkline series. */
  series: number[];
  /** Transactions observed per minute over the trailing minute of samples. */
  perMinute: number;
  /** Total new arrivals seen since this tab opened. */
  totalArrivals: number;
  /** Transaction ids that first appeared in the most recent refresh -- rows flash on arrival. */
  freshIds: ReadonlySet<string>;
}

const MAX_SAMPLES = 45;

/** Builds a live "network pulse" from the polling recent-transaction feed: every refresh that
 * delivers ids we haven't seen counts as arrivals -- sampled into a rolling series for the
 * sparkline, rolled up into a per-minute rate, and exposed as a fresh-id set so their rows can
 * flash on arrival.
 *
 * The very first population is baseline only -- flashing all twenty rows on page load reads as
 * noise, and one fake spike would distort the rate. Sampling only runs while live polling is on;
 * when paused (or while reading older pages) existing samples simply freeze. */
export function useTxPulse(transactions: RecentTransactionSummary[] | undefined, opts: { intervalMs: number; enabled: boolean }): TxPulse {
  const [series, setSeries] = useState<number[]>([]);
  const [perMinute, setPerMinute] = useState(0);
  const [totalArrivals, setTotalArrivals] = useState(0);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());

  // Refs mirror state inside the effect so re-runs triggered by our own setState calls (e.g. under
  // StrictMode) can't double-count arrivals -- only genuinely new data does.
  const seenRef = useRef<ReadonlySet<string> | null>(null);
  const lastAtRef = useRef(0);
  const totalsRef = useRef({ series: [] as number[], arrivals: 0 });
  const { intervalMs, enabled } = opts;

  useEffect(() => {
    if (!enabled || !transactions || transactions.length === 0) return;

    const now = Date.now();
    const ids = transactions.map((t) => t.transaction_id);
    const seen = seenRef.current;

    if (seen === null) {
      // Baseline pass: remember what's already here, count nothing.
      seenRef.current = new Set(ids);
      lastAtRef.current = now;
      return;
    }

    const fresh = ids.filter((id) => !seen.has(id));
    seenRef.current = new Set([...seen, ...ids]);

    const elapsedMin = (now - lastAtRef.current) / 60_000;
    lastAtRef.current = now;
    if (fresh.length === 0 || elapsedMin <= 0) return;

    const nextSeries = [...totalsRef.current.series, fresh.length].slice(-MAX_SAMPLES);
    totalsRef.current = { series: nextSeries, arrivals: totalsRef.current.arrivals + fresh.length };
    setSeries(nextSeries);
    setTotalArrivals(totalsRef.current.arrivals);

    // Rate across the trailing ~minute of samples; early on (less than a minute of history) this
    // scales the short window up, which is noisier but responsive rather than showing nothing.
    const windowSamples = nextSeries.filter((_, i) => (nextSeries.length - 1 - i) * intervalMs <= 60_000);
    const windowMinutes = Math.max(Math.min(windowSamples.length * intervalMs, 60_000) / 60_000, 0.01);
    setPerMinute(windowSamples.reduce((a, b) => a + b, 0) / windowMinutes);

    const freshSet = new Set(fresh);
    setFreshIds(freshSet);
    const timer = window.setTimeout(() => setFreshIds(new Set()), 2_500);
    return () => window.clearTimeout(timer);
    // `intervalMs`/`enabled` are safe deps: re-running on their change never recounts, because
    // already-seen ids live in the ref and are filtered out before anything is sampled.
  }, [transactions, intervalMs, enabled]);

  return { series, perMinute, totalArrivals, freshIds };
}
