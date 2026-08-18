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

type TransferRow =
  | { kind: "single"; vaultId: string; divisibility: number; symbol?: string; txId: string; event: TransactionEvent }
  | { kind: "private"; vaultId: string; divisibility: number; symbol?: string; txId: string; netRevealed: string };

/** A stealth/confidential send shows up as a `deposit` *and* a `withdraw` of the same tiny "revealed"
 * amount in the very same transaction, on the same vault -- the protocol's balance equation needs a
 * sliver of cleartext value to tie the proof together, and that sliver round-trips straight back into
 * the sending vault. The real amount moved stays hidden in the stealth outputs and never appears in
 * any event payload. Left as two separate rows, this reads as a meaningless no-op; grouped into one
 * "Private transfer" row instead, with only the immaterial revealed remainder (usually zero) shown. */
function groupTransferRows(vaultId: string, divisibility: number, symbol: string | undefined, events: [string, TransactionEvent][]): TransferRow[] {
  const byTx = new Map<string, [string, TransactionEvent][]>();
  for (const entry of events) {
    if (!(entry[1].topic in TRANSFER_TOPIC_LABEL)) continue;
    const list = byTx.get(entry[0]) ?? [];
    list.push(entry);
    byTx.set(entry[0], list);
  }

  const rows: TransferRow[] = [];
  for (const [txId, group] of byTx) {
    const deposit = group.find(([, e]) => e.topic === "std.vault.deposit");
    const withdraw = group.find(([, e]) => e.topic === "std.vault.withdraw");
    const resourceType = deposit?.[1].payload.resource_type ?? withdraw?.[1].payload.resource_type;
    const isPrivatePair = deposit && withdraw && group.length === 2 && (resourceType === "Stealth" || resourceType === "Confidential");

    if (isPrivatePair) {
      let netRevealed = "0";
      try {
        netRevealed = (BigInt(String(deposit[1].payload.amount ?? 0)) - BigInt(String(withdraw[1].payload.amount ?? 0))).toString();
      } catch {
        // Leave at "0" if either amount isn't a parseable integer.
      }
      rows.push({ kind: "private", vaultId, divisibility, symbol, txId, netRevealed });
    } else {
      for (const [id, event] of group) rows.push({ kind: "single", vaultId, divisibility, symbol, txId: id, event });
    }
  }
  return rows;
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

  const rows: TransferRow[] = vaultIds.flatMap((vaultId, i) => {
    const container = vaultQueries[i]?.data?.substate.Vault.resource_container;
    const resourceAddress = container ? containerResourceAddress(container) : undefined;
    const resource = resourceAddress ? resourceByAddress.get(resourceAddress) : undefined;
    const events = transferQueries[i]?.data?.events ?? [];
    return groupTransferRows(vaultId, resource?.resource.divisibility ?? 0, resource?.resource.metadata?.SYMBOL, events);
  });

  if (vaultIds.length === 0) return null;
  if (loading) return <LoadingBlock label="Loading transfers…" />;

  const hasPrivateRows = rows.some((r) => r.kind === "private");

  return (
    <Card className="mb-3">
      {hasPrivateRows && (
        <p className="border-b border-border-soft px-5 py-2.5 text-xs text-ink-faint">
          Private transfers hide their real amount -- only the immaterial cleartext remainder (usually zero) shows here.
        </p>
      )}
      <div className="hidden grid-cols-[130px_130px_minmax(0,1fr)] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
        <span>Direction</span>
        <span className="text-right">Amount</span>
        <span>Transaction</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-ink-dim">No deposits or withdrawals found for this component's vaults.</p>
      ) : (
        rows.map((row, i) => {
          if (row.kind === "private") {
            const nonZero = row.netRevealed !== "0";
            return (
              <div
                key={`${row.vaultId}-${row.txId}-${i}`}
                className="grid grid-cols-2 gap-2 border-b border-border-soft px-5 py-3.5 last:border-0 sm:grid-cols-[130px_130px_minmax(0,1fr)] sm:items-center sm:gap-3"
              >
                <TopicBadge topic="private" label="Private transfer" tone="accent" />
                <span className="tabular text-right text-xs text-ink-faint">
                  {nonZero
                    ? `${row.netRevealed.startsWith("-") ? "" : "+"}${formatAmount(row.netRevealed, row.divisibility)}${row.symbol ? ` ${row.symbol}` : ""}`
                    : "amount hidden"}
                </span>
                <Hash value={row.txId} />
              </div>
            );
          }
          const known = TRANSFER_TOPIC_LABEL[row.event.topic];
          const amount = row.event.payload.amount;
          return (
            <div
              key={`${row.vaultId}-${row.txId}-${i}`}
              className="grid grid-cols-2 gap-2 border-b border-border-soft px-5 py-3.5 last:border-0 sm:grid-cols-[130px_130px_minmax(0,1fr)] sm:items-center sm:gap-3"
            >
              <TopicBadge topic={row.event.topic} label={known?.label} tone={known?.tone} />
              <span className="tabular text-right text-sm text-ink">
                {typeof amount === "string" || typeof amount === "number"
                  ? `${formatAmount(amount, row.divisibility)}${row.symbol ? ` ${row.symbol}` : ""}`
                  : "—"}
              </span>
              <Hash value={row.txId} />
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
