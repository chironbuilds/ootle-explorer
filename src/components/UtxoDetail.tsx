import { useQuery } from "@tanstack/react-query";
import { getResource } from "../lib/indexer";
import { parseOutputSubstateId, describeSpendAuthorization, formatUtxoTag } from "../lib/utxo";
import { formatAmount } from "../lib/format";
import { Card, KeyValueRow, Badge } from "./ui";
import { Hash } from "./Hash";

interface OutputBody {
  minimum_value_promise?: number;
}

interface UtxoSubstateValue {
  output?: { output?: OutputBody; auth?: unknown; tag?: number } | null;
  is_frozen?: boolean;
}

interface ConfidentialOutputSubstateValue {
  output?: OutputBody;
  is_frozen?: boolean;
}

function readUtxo(data: unknown): UtxoSubstateValue | null {
  return (data as { substate?: { Utxo?: UtxoSubstateValue } } | undefined)?.substate?.Utxo ?? null;
}

function readConfidentialOutput(data: unknown): ConfidentialOutputSubstateValue | null {
  return (data as { substate?: { ConfidentialOutput?: ConfidentialOutputSubstateValue } } | undefined)?.substate?.ConfidentialOutput ?? null;
}

/** Structured view for a stealth UTXO or confidential output -- both address as
 * `<prefix>_<resource_hex>_<commitment_hex>` and hold the same revealed-floor/hidden-balance
 * shape, so this reads whichever substate variant matches `kind` and renders them identically
 * except for the parts only a UTXO has: its own spend authorization and public scan tag. A
 * confidential output has neither -- its spend is gated by the owning vault's access rules
 * instead (see `ConfidentialOutput`'s own doc comment in tari-ootle's engine_types crate). */
export function UtxoDetail({ id, data, kind }: { id: string; data: unknown; kind: "utxo" | "coutput" }) {
  const parsed = parseOutputSubstateId(id);

  const resourceQuery = useQuery({
    queryKey: ["resource", parsed?.resourceAddress],
    queryFn: () => getResource(parsed!.resourceAddress),
    enabled: !!parsed,
  });

  if (!parsed) return null;

  const utxo = kind === "utxo" ? readUtxo(data) : null;
  const coutput = kind === "coutput" ? readConfidentialOutput(data) : null;
  const isFrozen = kind === "utxo" ? utxo?.is_frozen : coutput?.is_frozen;
  const output = kind === "utxo" ? utxo?.output?.output : coutput?.output;
  const authInfo = kind === "utxo" ? describeSpendAuthorization(utxo?.output?.auth) : null;
  const tag = kind === "utxo" ? utxo?.output?.tag : undefined;
  const burnt = kind === "utxo" && !!utxo && !utxo.output;

  const symbol = resourceQuery.data?.resource.metadata?.SYMBOL;
  const divisibility = resourceQuery.data?.resource.divisibility ?? 0;
  const promise = output?.minimum_value_promise ?? 0;

  return (
    <Card className="mb-8">
      <KeyValueRow label="Resource">
        <div className="flex items-center gap-2">
          <Hash value={parsed.resourceAddress} />
          {symbol && <Badge tone="accent">{symbol}</Badge>}
        </div>
      </KeyValueRow>
      <KeyValueRow label="Pedersen commitment">
        <Hash value={parsed.commitment} full link={false} />
      </KeyValueRow>
      {!burnt && (
        <KeyValueRow label="Amount">
          {promise > 0 ? (
            <span className="text-sm text-ink">
              Minimum disclosed: <span className="tabular">≥ {formatAmount(promise, divisibility)}</span>
              {symbol ? ` ${symbol}` : ""}
            </span>
          ) : (
            <Badge tone="veil">Fully veiled</Badge>
          )}
        </KeyValueRow>
      )}
      {kind === "utxo" &&
        (burnt ? (
          <KeyValueRow label="Spendable via">
            <span className="text-ink-faint">Burnt — output permanently destroyed</span>
          </KeyValueRow>
        ) : (
          <KeyValueRow label="Spendable via">
            {authInfo?.kind === "Key" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>Key-path</Badge>
                <Hash value={authInfo.key} link={false} />
              </div>
            )}
            {authInfo?.kind === "Script" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="accent">Script-path</Badge>
                <span className="text-xs text-ink-faint">condition root:</span>
                <Hash value={authInfo.conditionRoot} link={false} />
              </div>
            )}
            {authInfo?.kind === "KeyAndScript" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="reveal">Key or Script-path</Badge>
                <Hash value={authInfo.key} link={false} />
                <span className="text-xs text-ink-faint">condition root:</span>
                <Hash value={authInfo.conditionRoot} link={false} />
              </div>
            )}
            {!authInfo && <span className="text-ink-faint">—</span>}
          </KeyValueRow>
        ))}
      {kind === "utxo" && tag !== undefined && (
        <KeyValueRow label="Scan tag">
          <span
            className="font-mono text-xs text-ink-dim"
            title="Public 4-byte hint a wallet scans for to recognize outputs addressed to it, without revealing anything about the recipient."
          >
            {formatUtxoTag(tag)}
          </span>
        </KeyValueRow>
      )}
      {kind === "coutput" && (
        <KeyValueRow label="Spend authorization">
          <span className="text-xs text-ink-dim">Controlled entirely by the owning vault's access rules — this substate carries no spend key of its own.</span>
        </KeyValueRow>
      )}
      {!burnt && (
        <KeyValueRow label="Frozen">
          {isFrozen ? <Badge tone="veil">Frozen — cannot currently be spent</Badge> : <Badge tone="reveal">Spendable</Badge>}
        </KeyValueRow>
      )}
    </Card>
  );
}
