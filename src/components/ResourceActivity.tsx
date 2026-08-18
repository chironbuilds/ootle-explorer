import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryTransactionEvents } from "../lib/indexer";
import { formatAmount } from "../lib/format";
import { Card, ErrorBlock, LoadingBlock, SectionLabel } from "./ui";
import { Hash } from "./Hash";
import { Pagination } from "./Pagination";

const PAGE_SIZE = 15;

const TOPIC_LABEL: Record<string, { label: string; tone: "success" | "danger" | "accent" }> = {
  "std.vault.deposit": { label: "Deposit", tone: "success" },
  "std.vault.withdraw": { label: "Withdraw", tone: "danger" },
  "std.resource.mint": { label: "Mint", tone: "success" },
  "std.resource.burn": { label: "Burn", tone: "danger" },
};

function TopicBadge({ topic }: { topic: string }) {
  const known = TOPIC_LABEL[topic];
  const tone = known?.tone === "success" ? "text-success bg-success/10" : known?.tone === "danger" ? "text-danger bg-danger/10" : "text-accent bg-accent/10";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{known?.label ?? topic}</span>;
}

/** A resource's own substate never changes on an ordinary transfer -- only the two vaults involved
 * do -- so "this token's activity" isn't a substate history, it's every std.vault.deposit/withdraw
 * (and std.resource.mint/burn) event naming this resource, which the indexer can filter directly. */
export function ResourceActivity({
  resourceAddress,
  divisibility,
  symbol,
  isConfidential,
}: {
  resourceAddress: string;
  divisibility: number;
  symbol?: string;
  isConfidential: boolean;
}) {
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey: ["resource-events", resourceAddress, offset],
    queryFn: () => queryTransactionEvents({ resourceAddress, limit: PAGE_SIZE, offset }),
  });

  const events = query.data?.events ?? [];

  return (
    <div className="mb-8">
      <SectionLabel>Activity</SectionLabel>
      {isConfidential && (
        <p className="mb-3 text-xs text-ink-faint">
          Only revealed (cleartext) transfers appear here -- a vault holding this resource confidentially never emits a deposit/withdraw event for
          the hidden portion.
        </p>
      )}
      {query.isLoading && <LoadingBlock label="Loading activity…" />}
      {query.isError && <ErrorBlock message={(query.error as Error).message} />}
      {query.data && (
        <Card>
          <div className="hidden grid-cols-[104px_minmax(0,1.5fr)_150px_minmax(0,1.5fr)] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Event</span>
            <span>Location</span>
            <span className="text-right">Amount</span>
            <span>Transaction</span>
          </div>
          {events.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-dim">No activity found for this resource.</p>
          ) : (
            events.map(([txId, event], i) => {
              const amount = event.payload.amount;
              return (
                <div
                  key={`${txId}-${i}`}
                  className="grid grid-cols-2 gap-2 border-b border-border-soft px-5 py-3.5 last:border-0 sm:grid-cols-[104px_minmax(0,1.5fr)_150px_minmax(0,1.5fr)] sm:items-center sm:gap-3"
                >
                  <TopicBadge topic={event.topic} />
                  {event.substate_id ? <Hash value={event.substate_id} /> : <span className="text-ink-faint">—</span>}
                  <span className="tabular text-right text-sm text-ink">
                    {typeof amount === "string" || typeof amount === "number" ? `${formatAmount(amount, divisibility)}${symbol ? ` ${symbol}` : ""}` : "—"}
                  </span>
                  <Hash value={txId} />
                </div>
              );
            })
          )}
          <Pagination
            page={offset / PAGE_SIZE + 1}
            canPrev={offset > 0}
            canNext={events.length === PAGE_SIZE}
            onPrev={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            onNext={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={query.isFetching}
          />
        </Card>
      )}
    </div>
  );
}
