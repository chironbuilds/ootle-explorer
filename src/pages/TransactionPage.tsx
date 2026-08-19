import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getTransaction, getTransactionResult } from "../lib/indexer";
import { readTxBody, isStealthTransaction } from "../lib/txShape";
import { formatAbsoluteTime, formatMicroTari, formatRelativeTime } from "../lib/format";
import { Badge, Card, ErrorBlock, KeyValueRow, LoadingBlock, PageHeader, SectionLabel } from "../components/ui";
import { Hash } from "../components/Hash";
import { StatusPill, VeilBadge } from "../components/StatusPill";
import { JsonTree } from "../components/JsonTree";
import { InstructionSummary } from "../components/InstructionSummary";
import { Disclosure } from "../components/Disclosure";
import { StealthTransferDetail } from "../components/StealthTransferDetail";
import { describeSpendAuthorization, formatUtxoTag } from "../lib/utxo";

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
      {instructions.map((instr, i) => {
        const statement =
          instr && typeof instr === "object" && "StealthTransfer" in instr
            ? (instr as { StealthTransfer: { statement?: unknown } }).StealthTransfer.statement
            : undefined;
        return (
          <Disclosure key={i} summary={<InstructionSummary instruction={instr} />}>
            {statement !== undefined && <StealthTransferDetail statement={statement} />}
            <JsonTree data={instr} />
          </Disclosure>
        );
      })}
    </div>
  );
}

/** A created (`up_substates`) UTXO's value, per `SubstateId::Utxo` -- `output.output` carries the
 * confidential commitment itself (only `minimum_value_promise` is ever cleartext, and it's a
 * disclosed *floor*, not the real amount; 0 means nothing at all is disclosed). `output.auth` is
 * one of Key/Script/KeyAndScript (see `lib/utxo.ts`), `output.tag` a public scan hint, and
 * `is_frozen` whether this specific output can currently be spent at all. */
interface UtxoUpValue {
  substate?: {
    Utxo?: {
      output?: {
        output?: { minimum_value_promise?: number };
        auth?: unknown;
        tag?: number;
      };
      is_frozen?: boolean;
    };
  };
}

function readUtxoUp(value: unknown) {
  const utxo = (value as UtxoUpValue | undefined)?.substate?.Utxo;
  return {
    minValuePromise: utxo?.output?.output?.minimum_value_promise ?? 0,
    auth: describeSpendAuthorization(utxo?.output?.auth),
    tag: utxo?.output?.tag,
    isFrozen: utxo?.is_frozen ?? false,
  };
}

function UtxoSection({ upSubstates, downSubstates }: { upSubstates: [string, unknown][]; downSubstates: [string, number][] }) {
  const created = upSubstates.filter(([id]) => id.startsWith("utxo_"));
  const spent = downSubstates.filter(([id]) => id.startsWith("utxo_"));
  if (created.length === 0 && spent.length === 0) return null;

  return (
    <div className="mb-8">
      <SectionLabel>UTXOs ({created.length + spent.length})</SectionLabel>
      <Card>
        {created.map(([id, value]) => {
          const { minValuePromise, auth, tag, isFrozen } = readUtxoUp(value);
          return (
            <div key={id} className="flex flex-wrap items-center gap-2 border-b border-border-soft px-5 py-3.5 last:border-0">
              <Badge tone="reveal">created</Badge>
              <Hash value={id} />
              {minValuePromise > 0 ? (
                <span className="tabular text-xs text-ink-dim">Minimum disclosed: ≥ {formatMicroTari(minValuePromise)} tTARI</span>
              ) : (
                <Badge tone="veil">Fully veiled</Badge>
              )}
              {auth?.kind === "Key" && (
                <span className="flex items-center gap-1.5 text-xs text-ink-faint">
                  Key-path · <Hash value={auth.key} link={false} className="text-xs" />
                </span>
              )}
              {auth?.kind === "Script" && (
                <span className="flex items-center gap-1.5 text-xs text-ink-faint">
                  Script-path · condition root <Hash value={auth.conditionRoot} link={false} className="text-xs" />
                </span>
              )}
              {auth?.kind === "KeyAndScript" && (
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                  Key or Script-path · <Hash value={auth.key} link={false} className="text-xs" /> · condition root{" "}
                  <Hash value={auth.conditionRoot} link={false} className="text-xs" />
                </span>
              )}
              {tag !== undefined && (
                <span className="font-mono text-xs text-ink-faint" title="Public scan tag">
                  {formatUtxoTag(tag)}
                </span>
              )}
              {isFrozen && <Badge tone="veil">Frozen</Badge>}
            </div>
          );
        })}
        {spent.map(([id, version]) => (
          <div key={id} className="flex flex-wrap items-center gap-2 border-b border-border-soft px-5 py-3.5 last:border-0">
            <Badge tone="veil">spent</Badge>
            <Hash value={id} />
            <span className="tabular text-xs text-ink-faint">v{version}</span>
          </div>
        ))}
      </Card>
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
  const upSubstates = resultQuery.data ? (findArrayField(resultQuery.data, "up_substates") as [string, unknown][] | null) : null;
  const downSubstates = resultQuery.data ? (findArrayField(resultQuery.data, "down_substates") as [string, number][] | null) : null;

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

      {(upSubstates || downSubstates) && <UtxoSection upSubstates={upSubstates ?? []} downSubstates={downSubstates ?? []} />}

      {((upSubstates?.length ?? 0) > 0 || (downSubstates?.length ?? 0) > 0) && (
        <div className="mb-8">
          <SectionLabel>
            Substate diff ({(upSubstates?.length ?? 0) + (downSubstates?.length ?? 0)})
          </SectionLabel>
          <Card>
            {upSubstates?.map(([id, value]) => (
              <Disclosure
                key={`up-${id}`}
                className="border-b border-border-soft py-3 last:border-0"
                summary={
                  <>
                    <Badge tone="reveal">created</Badge>
                    <Hash value={id} />
                  </>
                }
              >
                <JsonTree data={value} />
              </Disclosure>
            ))}
            {downSubstates?.map(([id, version]) => (
              <div key={`down-${id}`} className="flex flex-wrap items-center gap-2 border-b border-border-soft px-5 py-3 last:border-0">
                <Badge tone="veil">destroyed</Badge>
                <Hash value={id} />
                <span className="tabular text-xs text-ink-faint">v{version}</span>
              </div>
            ))}
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
