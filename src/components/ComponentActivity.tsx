import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { findVaultIds } from "../lib/cborState";
import { getResource, getVault, queryTransactionEvents, type ResourceContainer, type TransactionEvent } from "../lib/indexer";
import { formatAmount } from "../lib/format";
import { Card, ErrorBlock, LoadingBlock, SectionLabel } from "./ui";
import { Hash } from "./Hash";
import { JsonTree } from "./JsonTree";
import { Pagination } from "./Pagination";

const EVENT_LIMIT = 25;

function containerResourceAddress(container: ResourceContainer): string {
  if ("Fungible" in container) return container.Fungible.address;
  if ("Stealth" in container) return container.Stealth.address;
  if ("Confidential" in container) return container.Confidential.address;
  return container.NonFungible.address;
}

const TRANSFER_TOPIC_LABEL: Record<string, { label: string; tone: "success" | "danger" }> = {
  "std.vault.deposit": { label: "Deposit", tone: "success" },
  "std.vault.withdraw": { label: "Withdraw", tone: "danger" },
};

function TopicBadge({ topic, label, tone }: { topic: string; label?: string; tone?: "success" | "danger" | "accent" }) {
  const cls = tone === "success" ? "text-success bg-success/10" : tone === "danger" ? "text-danger bg-danger/10" : "text-accent bg-accent/10";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label ?? topic}</span>;
}

interface VaultTransfer {
  vaultId: string;
  divisibility: number;
  symbol?: string;
  txId: string;
  event: TransactionEvent;
}

/** A component's own vaults are where money actually moves -- `std.vault.deposit`/`withdraw` fire
 * with the *vault* as the event's subject, not the component, so the component's own event log
 * (see below) never shows a transfer by itself. Each held vault's history is fetched separately
 * (the indexer's substate_id filter is a single exact match, not a set) and listed per vault rather
 * than merged into one globally-sorted feed -- events carry no timestamp to sort by, and for the
 * common single-vault account this ordering is already the vault's own chronological order. */
function VaultTransfers({ componentState }: { componentState: unknown }) {
  const vaultIds = findVaultIds(componentState);

  const vaultQueries = useQueries({ queries: vaultIds.map((id) => ({ queryKey: ["substate", id], queryFn: () => getVault(id) })) });
  const resourceAddresses = [
    ...new Set(
      vaultQueries
        .map((q) => q.data)
        .filter((d): d is NonNullable<typeof d> => !!d)
        .map((d) => containerResourceAddress(d.substate.Vault.resource_container)),
    ),
  ];
  const resourceQueries = useQueries({
    queries: resourceAddresses.map((address) => ({ queryKey: ["resource", address], queryFn: () => getResource(address) })),
  });
  const resourceByAddress = new Map(resourceAddresses.map((address, i) => [address, resourceQueries[i]?.data]));

  const transferQueries = useQueries({
    queries: vaultIds.map((id) => ({
      queryKey: ["vault-events", id],
      queryFn: () => queryTransactionEvents({ substateId: id, limit: EVENT_LIMIT }),
    })),
  });

  const loading = vaultQueries.some((q) => q.isLoading) || transferQueries.some((q) => q.isLoading);

  const transfers: VaultTransfer[] = vaultIds.flatMap((vaultId, i) => {
    const container = vaultQueries[i]?.data?.substate.Vault.resource_container;
    const resourceAddress = container ? containerResourceAddress(container) : undefined;
    const resource = resourceAddress ? resourceByAddress.get(resourceAddress) : undefined;
    const events = transferQueries[i]?.data?.events ?? [];
    return events
      .filter(([, event]) => event.topic in TRANSFER_TOPIC_LABEL)
      .map(([txId, event]) => ({
        vaultId,
        divisibility: resource?.resource.divisibility ?? 0,
        symbol: resource?.resource.metadata?.SYMBOL,
        txId,
        event,
      }));
  });

  if (vaultIds.length === 0) return null;
  if (loading) return <LoadingBlock label="Loading transfers…" />;

  return (
    <Card className="mb-3">
      <div className="hidden grid-cols-[104px_130px_minmax(0,1fr)] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
        <span>Direction</span>
        <span className="text-right">Amount</span>
        <span>Transaction</span>
      </div>
      {transfers.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-dim">No deposits or withdrawals found for this component's vaults.</p>
      ) : (
        transfers.map(({ vaultId, divisibility, symbol, txId, event }, i) => {
          const known = TRANSFER_TOPIC_LABEL[event.topic];
          const amount = event.payload.amount;
          return (
            <div
              key={`${vaultId}-${txId}-${i}`}
              className="grid grid-cols-2 gap-2 border-b border-border-soft px-5 py-3.5 last:border-0 sm:grid-cols-[104px_130px_minmax(0,1fr)] sm:items-center sm:gap-3"
            >
              <TopicBadge topic={event.topic} label={known?.label} tone={known?.tone} />
              <span className="tabular text-right text-sm text-ink">
                {typeof amount === "string" || typeof amount === "number" ? `${formatAmount(amount, divisibility)}${symbol ? ` ${symbol}` : ""}` : "—"}
              </span>
              <Hash value={txId} />
            </div>
          );
        })
      )}
    </Card>
  );
}

const TOPIC_TONE: Record<string, "success" | "danger" | "accent"> = {
  "std.component.created": "success",
  "std.component.updated": "accent",
};

/** A component substate never records its own call history -- only its current state -- so its own
 * event log (below) only ever shows `std.component.created`/`updated` (fired on any state-mutating
 * call) plus whatever custom events its own template defines. Actual money movement lives in
 * `VaultTransfers` above instead. */
function ComponentEvents({ componentAddress }: { componentAddress: string }) {
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey: ["component-events", componentAddress, offset],
    queryFn: () => queryTransactionEvents({ substateId: componentAddress, limit: EVENT_LIMIT, offset }),
  });

  const events = query.data?.events ?? [];

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Component events</p>
      {query.isLoading && <LoadingBlock label="Loading…" />}
      {query.isError && <ErrorBlock message={(query.error as Error).message} />}
      {query.data && (
        <Card>
          {events.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-ink-dim">No component-level events (creation/update or custom) found.</p>
          ) : (
            events.map(([txId, event], i) => (
              <div key={`${txId}-${i}`} className="border-b border-border-soft px-5 py-3.5 last:border-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <TopicBadge topic={event.topic} tone={TOPIC_TONE[event.topic]} />
                  <Hash value={txId} />
                </div>
                {!!event.payload && Object.keys(event.payload).length > 0 && <JsonTree data={event.payload} />}
              </div>
            ))
          )}
          <Pagination
            page={offset / EVENT_LIMIT + 1}
            canPrev={offset > 0}
            canNext={events.length === EVENT_LIMIT}
            onPrev={() => setOffset((o) => Math.max(0, o - EVENT_LIMIT))}
            onNext={() => setOffset((o) => o + EVENT_LIMIT)}
            disabled={query.isFetching}
          />
        </Card>
      )}
    </div>
  );
}

export function ComponentActivity({ componentAddress, componentState }: { componentAddress: string; componentState: unknown }) {
  return (
    <div className="mb-8">
      <SectionLabel>Activity</SectionLabel>
      <VaultTransfers componentState={componentState} />
      <ComponentEvents componentAddress={componentAddress} />
    </div>
  );
}
