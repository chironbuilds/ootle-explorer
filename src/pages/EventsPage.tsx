import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { queryTransactionEvents, type TransactionEvent } from "../lib/indexer";
import { Card, ErrorBlock, PageHeader } from "../components/ui";
import { Hash } from "../components/Hash";
import { Pagination } from "../components/Pagination";
import { TopicBadge } from "../components/TopicBadge";
import { KNOWN_TOPICS } from "../lib/topics";
import { TableRowsSkeleton } from "../components/Skeleton";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const PAGE_SIZE = 25;

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  "std.vault.deposit": "Value moved into a vault",
  "std.vault.withdraw": "Value moved out of a vault",
  "std.resource.mint": "New supply created",
  "std.resource.burn": "Supply destroyed",
};

/** A value is a substate id if it carries one of the well-known prefixes; resource addresses share
   the `resource_` prefix with resource substate ids, and the events endpoint treats both the same. */
function classifyFilter(value: string): { substateId?: string; resourceAddress?: string } | null {
  const trimmed = value.trim();
  if (/^(component|vault|nft|utxo|coutput|txreceipt)_[0-9a-f_]+$/i.test(trimmed)) return { substateId: trimmed };
  if (/^resource_[0-9a-f_]+$/i.test(trimmed)) return { resourceAddress: trimmed };
  return null;
}

/** Compact key=value preview of an event payload -- full JSON stays available on the transaction
   page; this just makes scanning the feed fast. */
function PayloadPreview({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <span className="text-ink-faint">—</span>;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs">
      {entries.slice(0, 2).map(([k, v]) => (
        <span key={k} className="truncate">
          <span className="text-ink-faint">{k}</span> <span className="text-ink-dim">{String(v)}</span>
        </span>
      ))}
      {entries.length > 2 && <span className="text-ink-faint">+{entries.length - 2} more</span>}
    </div>
  );
}

export default function EventsPage() {
  useDocumentTitle("Events");
  // Filter + paging state lives in the URL so a filtered view can be shared or revisited exactly.
  const [searchParams, setSearchParams] = useSearchParams();
  const topic = searchParams.get("topic") ?? "";
  const filterInput = searchParams.get("q") ?? "";
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const [draftFilter, setDraftFilter] = useState(filterInput);
  const parsedFilter = useMemo(() => (filterInput ? classifyFilter(filterInput) : {}), [filterInput]);
  const filterInvalid = filterInput.trim() !== "" && parsedFilter === null;

  const query = useQuery({
    queryKey: ["events", topic || "all", filterInput, offset],
    queryFn: () => queryTransactionEvents({ topic: topic || undefined, ...parsedFilter!, limit: PAGE_SIZE, offset }),
    enabled: !filterInvalid,
    refetchInterval: offset === 0 && !filterInvalid ? 10_000 : false,
  });

  const events = query.data?.events ?? [];
  const canNext = events.length === PAGE_SIZE;

  const updateParams = (changes: { topic?: string; q?: string; offset?: number }) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        // Only touch keys the caller actually passed -- a topic switch must not clobber an
        // existing text filter (and vice versa). Offset 0 is removed so clean URLs are kept.
        if ("topic" in changes) {
          if (changes.topic) next.set("topic", changes.topic);
          else next.delete("topic");
        }
        if ("q" in changes) {
          if (changes.q) next.set("q", changes.q);
          else next.delete("q");
        }
        if ("offset" in changes) {
          if (changes.offset && changes.offset > 0) next.set("offset", String(changes.offset));
          else next.delete("offset");
        }
        return next;
      },
      { replace: false },
    );
    setDraftFilter(changes.q ?? filterInput);
  };

  return (
    <div>
      <PageHeader title="Events" sub="Everything happening on-chain, as emitted by transactions — deposits, withdrawals, mints, burns, and custom template events." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => updateParams({ topic: "", offset: 0 })}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
            topic === "" ? "bg-accent/15 text-accent" : "border border-border bg-surface text-ink-dim hover:text-ink"
          }`}
        >
          All events
        </button>
        {KNOWN_TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => updateParams({ topic: t, offset: 0 })}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              topic === t ? "bg-accent/15 text-accent" : "border border-border bg-surface text-ink-dim hover:text-ink"
            }`}
          >
            {TOPIC_DESCRIPTIONS[t] ?? t}
            <span className="ml-1.5 font-mono text-[10px] text-ink-faint">{t.split(".").slice(-1)[0]}</span>
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParams({ q: draftFilter.trim(), offset: 0 });
        }}
        className="mb-6 flex flex-wrap items-center gap-2"
      >
        <input
          value={draftFilter}
          onChange={(e) => setDraftFilter(e.target.value)}
          placeholder="Filter by substate id (vault_…, component_…) or resource address (resource_…)"
          spellCheck={false}
          className={`min-w-0 flex-1 rounded-lg border bg-surface px-3.5 py-2 font-mono text-sm text-ink outline-none transition-colors placeholder:font-body placeholder:text-ink-faint focus:border-accent-dim ${
            filterInvalid ? "border-danger" : "border-border"
          }`}
        />
        {(filterInput || draftFilter) && (
          <button
            type="button"
            onClick={() => {
              setDraftFilter("");
              updateParams({ q: "", offset: 0 });
            }}
            className="rounded-lg border border-border px-3 py-2 text-xs text-ink-dim transition-colors hover:text-ink"
          >
            Clear
          </button>
        )}
        <button type="submit" className="rounded-lg bg-accent/15 px-4 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/25">
          Apply
        </button>
        {filterInvalid && <p className="w-full text-xs text-danger">Not a recognizable substate id or resource address.</p>}
      </form>

      {query.isLoading && <TableRowsSkeleton rows={10} cols={3} />}
      {query.isError && <ErrorBlock message={(query.error as Error).message} />}
      {query.data && (
        <Card>
          <div className="hidden grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1.2fr)] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Event</span>
            <span>Location</span>
            <span>Payload</span>
            <span className="text-right sm:text-left">Transaction</span>
          </div>
          {events.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-ink-dim">No events match this filter.</p>
          ) : (
            events.map(([txId, event]: [string, TransactionEvent], i) => (
              <div
                key={`${txId}-${i}`}
                className="grid grid-cols-1 gap-2 border-b border-border-soft px-5 py-3.5 last:border-0 hover:bg-surface-2/60 sm:grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1.2fr)] sm:items-center sm:gap-3"
              >
                <TopicBadge topic={event.topic} />
                <span className="min-w-0">{event.substate_id ? <Hash value={event.substate_id} /> : <span className="text-xs text-ink-faint">—</span>}</span>
                <PayloadPreview payload={event.payload ?? {}} />
                <Link to={`/tx/${txId}`} className="justify-self-start sm:justify-self-auto" title={txId}>
                  <Hash value={txId} />
                </Link>
              </div>
            ))
          )}
          <Pagination
            page={offset / PAGE_SIZE + 1}
            canPrev={offset > 0}
            canNext={canNext}
            onPrev={() => updateParams({ offset: Math.max(0, offset - PAGE_SIZE) })}
            onNext={() => updateParams({ offset: offset + PAGE_SIZE })}
            disabled={query.isFetching}
          />
        </Card>
      )}

      <p className="mt-4 text-xs leading-relaxed text-ink-faint">
        Events are indexed per transaction and kept permanently, unlike live transaction results which expire. Confidential transfers never emit
        deposit/withdraw events for their hidden amounts, so this feed only reflects revealed activity.
      </p>
    </div>
  );
}
