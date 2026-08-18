import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getNetworkEconomics, listRecentTransactions, type RecentTransactionSummary } from "../lib/indexer";
import { formatMicroTari, formatNumber, formatRelativeTime } from "../lib/format";
import { readTxBody, isStealthTransaction } from "../lib/txShape";
import { Card, ErrorBlock, LoadingBlock, StatTile } from "../components/ui";
import { Hash } from "../components/Hash";
import { StatusPill, VeilBadge } from "../components/StatusPill";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 20;

function TxRow({ tx }: { tx: RecentTransactionSummary }) {
  const body = readTxBody(tx.transaction);
  const stealth = isStealthTransaction(body);
  return (
    <Link to={`/tx/${tx.transaction_id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border-soft px-5 py-3.5 last:border-0 hover:bg-surface-2 sm:grid-cols-[minmax(0,2.2fr)_auto_auto_auto]">
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

export default function HomePage() {
  const economics = useQuery({ queryKey: ["economics"], queryFn: getNetworkEconomics, refetchInterval: 20_000 });

  // Cursor-based paging: the indexer's `last_id` is a cursor (the previous page's last
  // transaction id), not a numeric offset -- `cursors[i]` is the cursor used to fetch page i+1,
  // so `cursors[0]` is always undefined (first page, no cursor needed).
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const cursor = cursors[pageIndex];

  const recent = useQuery({
    queryKey: ["recent-transactions", cursor ?? "first"],
    queryFn: () => listRecentTransactions(PAGE_SIZE, cursor),
    // Only auto-refresh the live first page -- refreshing an older page out from under someone
    // mid-read would shift its contents underneath them.
    refetchInterval: pageIndex === 0 ? 8_000 : false,
  });

  const transactions = recent.data?.transactions ?? [];
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
      <div className="mb-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Tari Ootle, laid bare.</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-dim">
          Live transactions, substates, and templates on the Ootle layer 2 — including which transfers stay confidential and which reveal their
          amount on-chain.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-dim">Recent transactions</h2>
        {recent.isFetching && !recent.isLoading && <span className="text-xs text-ink-faint">refreshing…</span>}
      </div>

      {recent.isLoading && <LoadingBlock label="Loading recent transactions…" />}
      {recent.isError && <ErrorBlock message={(recent.error as Error).message} />}
      {recent.data && (
        <Card>
          <div className="hidden grid-cols-[minmax(0,2.2fr)_auto_auto_auto] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Transaction</span>
            <span>Privacy</span>
            <span>Outcome</span>
            <span className="text-right">Age</span>
          </div>
          {transactions.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-dim">No transactions yet.</p>
          ) : (
            transactions.map((tx) => <TxRow key={tx.transaction_id} tx={tx} />)
          )}
          <Pagination page={pageIndex + 1} canPrev={canPrev} canNext={canNext} onPrev={goPrev} onNext={goNext} disabled={recent.isFetching} />
        </Card>
      )}
    </div>
  );
}
