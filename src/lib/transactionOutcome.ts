import { useQuery } from "@tanstack/react-query";
import { getTransactionResult, type RecentTransactionSummary, type TransactionOutcome, type TransactionResultResponse } from "./indexer";

/**
 * `summary` (populated by the indexer's own background receipt-sync worker, denormalized into a
 * `transaction_receipts` cache table -- see tari-dan's storage_sqlite/reader.rs) has been null for
 * every transaction on this indexer since around the esmeralda V1 activation epoch (v0.41.0),
 * even for transactions confirmed independently to be long finalized. `/transactions/{id}/result`
 * reads a different, evidently still-working code path (its own doc comment elsewhere notes this
 * live cache "expires" for older transactions, unlike the receipt sync -- but the receipt sync is
 * exactly what's currently stalled, so for now this is the only reliable source left). Every
 * transaction currently shows "Pending" without this: `tx.summary?.outcome` is undefined, and
 * StatusPill defaults undefined to "Pending".
 *
 * Once the upstream bug is fixed, `summary.outcome` starts resolving again and this never queries
 * anything at all (see the `enabled` gate below) -- safe to leave in place indefinitely, but worth
 * removing once that's been true for a while, not the moment it first looks fixed.
 */
export function deriveOutcomeFromResult(response: TransactionResultResponse | undefined): TransactionOutcome | undefined {
  if (!response || response.error) return undefined;
  const result = response.result;
  if (!result || typeof result !== "object") return undefined;
  const record = result as Record<string, unknown>;

  const finalized = record.Finalized;
  if (finalized && typeof finalized === "object" && typeof (finalized as Record<string, unknown>).final_decision === "string") {
    return (finalized as Record<string, unknown>).final_decision as TransactionOutcome;
  }

  // A transaction that never reached execution (e.g. rejected before that point) may be
  // represented as a sibling variant instead of nested under `Finalized` -- same externally-tagged
  // single-key-object enum convention as `Finalized` itself (see findArrayField's own doc comment
  // in TransactionPage.tsx for the same "don't hand-model every variant" reasoning).
  const [firstKey] = Object.keys(record);
  return firstKey && firstKey !== "Finalized" ? (firstKey as TransactionOutcome) : undefined;
}

/** For a list row: `tx.summary` fetched inline (see `listRecentTransactions`) is used directly
 * when present, only falling back to a dedicated `/result` fetch (cached forever once resolved --
 * a finalized outcome never changes) when it's missing. */
export function useTransactionOutcome(tx: Pick<RecentTransactionSummary, "transaction_id" | "summary">): TransactionOutcome | undefined {
  const summaryOutcome = tx.summary?.outcome;
  const fallback = useQuery({
    queryKey: ["tx-result-fallback", tx.transaction_id],
    queryFn: () => getTransactionResult(tx.transaction_id),
    enabled: !summaryOutcome,
    staleTime: Infinity,
    retry: false,
    // Keep polling only until it actually resolves to something -- a genuinely still-pending
    // transaction's first attempt 404s, and there's no point stopping there since it may finalize
    // moments later. Matches HomePage's own list refresh cadence rather than inventing a
    // different one.
    refetchInterval: (query) => (query.state.data && !query.state.data.error ? false : 8_000),
  });

  return summaryOutcome ?? deriveOutcomeFromResult(fallback.data);
}
