const MICRO = 1_000_000n;

/** Formats a raw microTari integer (as returned by the indexer, always a decimal string to stay
 * u64-safe) as a tTARI amount with up to 6 fraction digits, comma-grouped. */
export function formatMicroTari(raw: string | number): string {
  let n: bigint;
  try {
    n = BigInt(typeof raw === "number" ? Math.trunc(raw) : raw);
  } catch {
    return String(raw);
  }
  const negative = n < 0n;
  if (negative) n = -n;
  const whole = n / MICRO;
  const frac = n % MICRO;
  const fracStr = frac === 0n ? "" : "." + frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toLocaleString("en-US")}${fracStr}`;
}

/** Formats a raw integer amount using a resource's own `divisibility` (decimal places), the
 * general form of `formatMicroTari` (which is just this at divisibility 6, TARI's own). */
export function formatAmount(raw: string | number, divisibility: number): string {
  const scale = 10n ** BigInt(divisibility);
  let n: bigint;
  try {
    n = BigInt(typeof raw === "number" ? Math.trunc(raw) : raw);
  } catch {
    return String(raw);
  }
  const negative = n < 0n;
  if (negative) n = -n;
  const whole = n / scale;
  const frac = n % scale;
  const fracStr = divisibility === 0 || frac === 0n ? "" : "." + frac.toString().padStart(divisibility, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toLocaleString("en-US")}${fracStr}`;
}

export function formatNumber(n: number | string): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString("en-US");
}

/** Parses the indexer's "YYYY-MM-DD HH:MM:SS.f" timestamps (space-separated, no explicit "Z") as UTC. */
function parseIndexerTimestamp(ts: string): Date {
  return new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
}

export function formatRelativeTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  const date = parseIndexerTimestamp(ts);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatAbsoluteTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return parseIndexerTimestamp(ts).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" });
}

/** The substate-id prefix identifies its kind (component/resource/vault/nft/...) -- used for
 * icons and labels across list and detail views. */
export function substateKind(id: string): string {
  const match = id.match(/^([a-z_]+?)_/);
  return match?.[1] ?? "substate";
}
