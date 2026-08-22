import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getNetworkEconomics, listRecentTransactions, type RecentTransactionSummary } from "../lib/indexer";
import { formatMicroTari, formatNumber, formatRelativeTime } from "../lib/format";
import { readTxBody, isStealthTransaction } from "../lib/txShape";
import { useTxPulse } from "../lib/useTxPulse";
import { Card, ErrorBlock, StatTile } from "../components/ui";
import { Hash } from "../components/Hash";
import { StatusPill, VeilBadge } from "../components/StatusPill";
import { Pagination } from "../components/Pagination";
import { LatestCheckpoint } from "../components/LatestCheckpoint";
import { Sparkline } from "../components/Sparkline";
import { StatTileSkeleton, TableRowsSkeleton } from "../components/Skeleton";

const PAGE_SIZE = 20;
const REFRESH_MS = 8_000;

function TxRow({ tx, fresh }: { tx: RecentTransactionSummary; fresh: boolean }) {
  const body = readTxBody(tx.transaction);
  const stealth = isStealthTransaction(body);
  return (
    <Link
      to={`/tx/${tx.transaction_id}`}
      className={`grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border-soft px-5 py-3.5 last:border-0 hover:bg-surface-2 sm:grid-cols-[minmax(0,2.2fr)_110px_150px_90px] ${fresh ? "flash-in" : ""}`}
    >
      <Hash value={tx.transaction_id} link={false} />
      <div className="hidden sm:block">
        <VeilBadge veiled={stealth} />
      </div>
      <div className="justify-self-end sm:justify-self-auto">
        <StatusPill outcome={tx.summary?.outcome} />
      </div>
      <span className="tabular justify-self-end text-right text-xs text-ink-faint">{formatRelativeTime(tx.created_at)}</span>
    </Link>
  );
}

function PauseButton({ paused, onClick }: { paused: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={paused ? "Resume live updates" : "Pause live updates"}
      aria-label={paused ? "Resume live updates" : "Pause live updates"}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-ink-dim transition-colors hover:border-accent-dim hover:text-ink"
    >
      {paused ? (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 1.8v8.4l6.6-4.2z" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
          <rect x="2.5" y="1.8" width="2.4" height="8.4" rx="0.8" />
          <rect x="7.1" y="1.8" width="2.4" height="8.4" rx="0.8" />
        </svg>
      )}
    </button>
  );
}

export default function HomePage() {
  const economics = useQuery({ queryKey: ["economics"], queryFn: getNetworkEconomics, refetchInterval: 20_000 });

  // Cursor-based paging: the indexer's `last_id` is a cursor (the previous page's last
  // transaction id), not a numeric offset -- `cursors[i]` is the cursor used to fetch page i+1,
  // so `cursors[0]` is always undefined (first page, no cursor needed).
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [live, setLive] = useState(true);
  const cursor = cursors[pageIndex];
  const pollingFirstPage = live && pageIndex === 0;

  const recent = useQuery({
    queryKey: ["recent-transactions", cursor ?? "first"],
    queryFn: () => listRecentTransactions(PAGE_SIZE, cursor),
    // Only auto-refresh the live first page -- refreshing an older page out from under someone
    // mid-read would shift its contents underneath them.
    refetchInterval: pollingFirstPage ? REFRESH_MS : false,
  });

  const transactions = recent.data?.transactions ?? [];
  const pulse = useTxPulse(recent.data?.transactions, { intervalMs: REFRESH_MS, enabled: pollingFirstPage });
  const canNext = transactions.length === PAGE_SIZE;
  const canPrev = pageIndex > 0;

  const goNext = () => {
    if (!canNext) return;
    const lastId = transactions[transactions.length - 1]!.transaction_id;
    setCursors((prev) => {
      const next = prev.slice(0, pageIndex + 1);
      next[pageIndex + 1] = lastId;
      return next;
    });
    setPageIndex((p) => p + 1);
  };

  const goPrev = () => {
    if (!canPrev) return;
    setPageIndex((p) => p - 1);
  };

  return (
    <div>
      <div className="fade-up mb-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Tari Ootle, laid bare.</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-dim">
          Live transactions, substates, and templates on the Ootle layer 2 — including which transfers stay confidential and which reveal their
          amount on-chain.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {economics.isLoading ? (
          <>
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
          </>
        ) : (
          <>
            <StatTile label="Epoch" value={economics.data ? formatNumber(economics.data.current_epoch) : "—"} accent="accent" />
            <StatTile
              label="Total supply"
              value={economics.data ? formatMicroTari(economics.data.total_supply) : "—"}
              title={economics.data ? formatMicroTari(economics.data.total_supply) + " tTARI" : undefined}
              sub="tTARI"
              accent="reveal"
            />
            <StatTile label="Fee volume" value={economics.data ? formatMicroTari(economics.data.fee_volume) : "—"} sub="tTARI" accent="veil" />
            <StatTile
              label="Receipts"
              value={economics.data ? formatNumber(economics.data.transaction_receipt_count) : "—"}
              accent="accent"
            />
          </>
        )}
      </div>

      {/* Live pulse -- arrival rate sampled from this tab's own polling, so it reflects exactly what
          you're seeing rather than a global statistic nobody can verify from here. */}
      <Card className="mb-8 flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4 fade-up">
        <div className="flex items-center gap-3">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${pollingFirstPage ? "pulse-dot bg-success" : "bg-ink-faint"}`}
            title={pollingFirstPage ? "Live" : "Live updates paused"}
          />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              {pollingFirstPage ? "Network pulse" : "Network pulse (paused)"}
            </p>
            <p className="font-display tabular text-2xl font-semibold text-ink">
              {pulse.series.length > 0 ? Math.round(pulse.perMinute) : "—"}
              <span className="ml-1.5 font-body text-xs font-normal text-ink-dim">tx / min</span>
            </p>
          </div>
        </div>

        {pulse.series.length > 1 ? (
          <>
            <Sparkline data={pulse.series} width={200} height={40} color="var(--accent)" className="hidden sm:block" />
            <p className="tabular text-xs text-ink-faint">
              {pulse.totalArrivals} new transaction{pulse.totalArrivals === 1 ? "" : "s"} observed since this tab opened
            </p>
          </>
        ) : (
          <p className="text-xs text-ink-faint">{pollingFirstPage ? "Measuring activity…" : "Paused — resume to measure activity."}</p>
        )}

        <div className="ml-auto flex items-center gap-2">
          {recent.isFetching && !recent.isLoading && <span className="text-xs text-ink-faint">refreshing…</span>}
          <PauseButton paused={!pollingFirstPage} onClick={() => setLive((v) => !v)} />
        </div>
      </Card>

      <LatestCheckpoint />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-dim">Recent transactions</h2>
      </div>

      {recent.isLoading && <TableRowsSkeleton rows={10} cols={3} />}
      {recent.isError && <ErrorBlock message={(recent.error as Error).message} />}
      {recent.data && (
        <Card>
          <div className="hidden grid-cols-[minmax(0,2.2fr)_110px_150px_90px] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Transaction</span>
            <span>Privacy</span>
            <span>Outcome</span>
            <span className="text-right">Age</span>
          </div>
          {transactions.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-dim">No transactions yet.</p>
          ) : (
            transactions.map((tx) => <TxRow key={tx.transaction_id} tx={tx} fresh={pulse.freshIds.has(tx.transaction_id)} />)
          )}
          <Pagination page={pageIndex + 1} canPrev={canPrev} canNext={canNext} onPrev={goPrev} onNext={goNext} disabled={recent.isFetching} />
        </Card>
      )}
    </div>
  );
}
