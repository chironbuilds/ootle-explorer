import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryTransactionEvents } from "../lib/indexer";
import { Card, ErrorBlock, LoadingBlock, SectionLabel } from "./ui";
import { Hash } from "./Hash";
import { Pagination } from "./Pagination";
import { JsonTree } from "./JsonTree";

const PAGE_SIZE = 15;

const TOPIC_TONE: Record<string, "success" | "danger" | "accent"> = {
  "std.component.created": "success",
  "std.component.updated": "accent",
};

function TopicBadge({ topic }: { topic: string }) {
  const tone = TOPIC_TONE[topic] ?? "accent";
  const cls = tone === "success" ? "text-success bg-success/10" : tone === "danger" ? "text-danger bg-danger/10" : "text-accent bg-accent/10";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{topic}</span>;
}

/** A component substate never records its own call history -- only its current state -- so "what
 * has this component done" comes from every event it emitted as the subject: `std.component.
 * created`/`updated` on any state-mutating call, plus whatever custom events its own template
 * defines (a DEX pool's `swap`, a DAO's `vote_cast`, ...). Pure view-method calls that don't
 * mutate state, and activity on the component's own vaults (visible on the resource's own Activity
 * tab instead), don't appear here -- this is the component's own event log, not everything that
 * ever touched it. */
export function ComponentActivity({ componentAddress }: { componentAddress: string }) {
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey: ["component-events", componentAddress, offset],
    queryFn: () => queryTransactionEvents({ substateId: componentAddress, limit: PAGE_SIZE, offset }),
  });

  const events = query.data?.events ?? [];

  return (
    <div className="mb-8">
      <SectionLabel>Activity</SectionLabel>
      {query.isLoading && <LoadingBlock label="Loading activity…" />}
      {query.isError && <ErrorBlock message={(query.error as Error).message} />}
      {query.data && (
        <Card>
          <div className="hidden grid-cols-[200px_minmax(0,1fr)] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Event</span>
            <span>Transaction</span>
          </div>
          {events.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-dim">No activity found for this component.</p>
          ) : (
            events.map(([txId, event], i) => (
              <div key={`${txId}-${i}`} className="border-b border-border-soft px-5 py-3.5 last:border-0">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center sm:gap-3">
                  <TopicBadge topic={event.topic} />
                  <Hash value={txId} />
                </div>
                {!!event.payload && Object.keys(event.payload as object).length > 0 && (
                  <div className="mt-2">
                    <JsonTree data={event.payload} />
                  </div>
                )}
              </div>
            ))
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
