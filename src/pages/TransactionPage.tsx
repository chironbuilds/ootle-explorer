import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getTransaction, getTransactionResult } from "../lib/indexer";
import { readTxBody, isStealthTransaction } from "../lib/txShape";
import { formatAbsoluteTime, formatMicroTari, formatRelativeTime } from "../lib/format";
import { Card, ErrorBlock, KeyValueRow, LoadingBlock, PageHeader, SectionLabel } from "../components/ui";
import { Hash } from "../components/Hash";
import { StatusPill, VeilBadge } from "../components/StatusPill";
import { JsonTree } from "../components/JsonTree";

/** Recursively finds the first array at a field named `key` -- the result envelope's exact
 * nesting (Finalized/Commit/Reject wrapping) varies more than is worth hand-modeling here. */
function findArrayField(value: unknown, key: string, depth = 0): unknown[] | null {
  if (depth > 8 || value === null || typeof value !== "object") return null;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === key && Array.isArray(v)) return v;
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    const found = findArrayField(v, key, depth + 1);
    if (found) return found;
  }
  return null;
}

interface TxEvent {
  substate_id?: string;
  template_address?: string;
  topic?: string;
  payload?: unknown;
}

function InstructionList({ instructions, empty }: { instructions: unknown[]; empty: string }) {
  if (instructions.length === 0) return <p className="px-5 py-4 text-sm text-ink-faint">{empty}</p>;
  return (
    <div className="divide-y divide-border-soft">
      {instructions.map((instr, i) => (
        <div key={i} className="px-5 py-3.5">
          <JsonTree data={instr} />
        </div>
      ))}
    </div>
  );
}

export default function TransactionPage() {
  const { id = "" } = useParams();

  const txQuery = useQuery({ queryKey: ["tx", id], queryFn: () => getTransaction(id), enabled: !!id });
  const resultQuery = useQuery({
    queryKey: ["tx-result", id],
    queryFn: () => getTransactionResult(id),
    enabled: !!id,
    retry: false,
  });

  if (txQuery.isLoading) return <LoadingBlock label="Loading transaction…" />;
  if (txQuery.isError)
    return (
      <div>
        <ErrorBlock message={(txQuery.error as Error).message} />
        <p className="mt-4 text-center text-xs text-ink-faint">
          A 64-character hex value that isn't a known transaction could be something else instead -- a public key, commitment, or other hash.
          There's no way to tell them apart by shape alone.
        </p>
      </div>
    );
  if (!txQuery.data) return null;

  const tx = txQuery.data.transaction;
  const body = readTxBody(tx.transaction);
  const stealth = isStealthTransaction(body);
  const events = resultQuery.data ? (findArrayField(resultQuery.data, "events") as TxEvent[] | null) : null;
  const diff = resultQuery.data ? findArrayField(resultQuery.data, "upped") : null;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xl">
              <Hash value={id} full link={false} />
            </span>
          </span>
        }
        sub="Transaction"
        actions={
          <div className="flex items-center gap-2">
            <VeilBadge veiled={stealth} />
            <StatusPill outcome={tx.summary?.outcome} />
          </div>
        }
      />

      <Card className="mb-8">
        <KeyValueRow label="Created">
          {formatAbsoluteTime(tx.created_at)} <span className="text-ink-faint">({formatRelativeTime(tx.created_at)})</span>
        </KeyValueRow>
        {tx.summary?.finalized_at && (
          <KeyValueRow label="Finalized">{formatAbsoluteTime(tx.summary.finalized_at)}</KeyValueRow>
        )}
        {tx.summary?.total_fees_paid !== undefined && (
          <KeyValueRow label="Fee paid">
            <span className="tabular">{formatMicroTari(tx.summary.total_fees_paid ?? 0)} tTARI</span>
          </KeyValueRow>
        )}
        {tx.rejected_reason && (
          <KeyValueRow label="Rejection reason">
            <span className="text-danger">{tx.rejected_reason}</span>
          </KeyValueRow>
        )}
        {body.network !== null && <KeyValueRow label="Network byte">{body.network}</KeyValueRow>}
        {(body.minEpoch !== null || body.maxEpoch !== null) && (
          <KeyValueRow label="Epoch window">
            {body.minEpoch ?? "any"} – {body.maxEpoch ?? "any"}
          </KeyValueRow>
        )}
        {body.sealSignerPublicKey && (
          <KeyValueRow label="Seal signer">
            {/* A public key, not a transaction id -- despite being the same 64-hex shape, it has no detail page. */}
            <Hash value={body.sealSignerPublicKey} link={false} />
          </KeyValueRow>
        )}
      </Card>

      {body.inputs.length > 0 && (
        <div className="mb-8">
          <SectionLabel>Inputs ({body.inputs.length})</SectionLabel>
          <Card>
            {body.inputs.map((input, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border-soft px-5 py-3 last:border-0">
                <Hash value={input.substate_id} />
                <span className="tabular text-xs text-ink-faint">{input.version === null ? "latest" : `v${input.version}`}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="mb-8">
        <SectionLabel>Fee instructions ({body.feeInstructions.length})</SectionLabel>
        <Card>
          <InstructionList instructions={body.feeInstructions} empty="No fee instructions." />
        </Card>
      </div>

      <div className="mb-8">
        <SectionLabel>Instructions ({body.instructions.length})</SectionLabel>
        <Card>
          <InstructionList instructions={body.instructions} empty="No instructions." />
        </Card>
      </div>

      <div className="mb-8">
        <SectionLabel>Events{events ? ` (${events.length})` : ""}</SectionLabel>
        {resultQuery.isLoading && <LoadingBlock label="Loading result…" />}
        {resultQuery.isError && (
          <Card className="px-5 py-6 text-sm text-ink-dim">
            {tx.summary?.outcome && tx.summary.outcome !== "Pending"
              ? "This transaction has finalized, but this indexer doesn't have detailed event data cached for it anymore."
              : "Result not yet available — the transaction may still be pending."}
          </Card>
        )}
        {events && events.length > 0 && (
          <Card>
            {events.map((event, i) => (
              <div key={i} className="border-b border-border-soft px-5 py-3.5 last:border-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium text-accent">{event.topic}</span>
                  {event.substate_id && <Hash value={event.substate_id} />}
                </div>
                {!!event.payload && Object.keys(event.payload as object).length > 0 && <JsonTree data={event.payload} />}
              </div>
            ))}
          </Card>
        )}
        {events && events.length === 0 && <Card className="px-5 py-6 text-sm text-ink-faint">No events.</Card>}
      </div>

      {diff && (
        <div className="mb-8">
          <SectionLabel>Substate diff</SectionLabel>
          <Card className="px-5 py-4">
            <JsonTree data={diff} />
          </Card>
        </div>
      )}

      <details className="mb-8 rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer select-none px-5 py-3.5 text-sm font-medium text-ink-dim">Raw transaction JSON</summary>
        <div className="border-t border-border-soft px-5 py-4">
          <JsonTree data={tx} />
        </div>
      </details>
    </div>
  );
}
