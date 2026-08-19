import type { ReactNode } from "react";
import { describeAtomicCondition, describeScriptPathWitness } from "../lib/spendCondition";
import { Badge } from "./ui";
import { Hash } from "./Hash";
import { JsonTree } from "./JsonTree";

function AtomRow({ atom }: { atom: unknown }) {
  const info = describeAtomicCondition(atom);
  switch (info.kind) {
    case "AccessRule":
      return (
        <div className="flex flex-wrap items-start gap-2">
          <Badge>Access rule</Badge>
          {info.rule === "AllowAll" || info.rule === "DenyAll" ? (
            <span className="text-xs text-ink-dim">{info.rule}</span>
          ) : (
            <div className="min-w-0 flex-1">
              <JsonTree data={info.rule} />
            </div>
          )}
        </div>
      );
    case "TemplateFunction":
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="accent">Template predicate</Badge>
          <span className="font-mono text-xs text-ink">{info.function}</span>
          <span className="text-xs text-ink-faint">on</span>
          <Hash value={info.template} linkOverride={`/template/${info.template}`} className="text-xs" />
        </div>
      );
    case "AfterEpoch":
      // The refund branch of a timelocked HTLC: unclaimed after this epoch, the sender can reclaim.
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="veil">Timelock</Badge>
          <span className="text-xs text-ink-dim">unlocks at epoch ≥ {String(info.epoch)}</span>
        </div>
      );
    case "BeforeEpoch":
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="veil">Timelock</Badge>
          <span className="text-xs text-ink-dim">expires before epoch {String(info.epoch)}</span>
        </div>
      );
    case "HashLock":
      // The claim branch of an HTLC: satisfiable by anyone who reveals the preimage, hence normally
      // paired with an AccessRule atom in the same conjunction to also bind it to a key.
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="reveal">Hashlock</Badge>
          <span className="text-xs text-ink-faint">{info.alg}</span>
          <Hash value={info.hash} link={false} className="text-xs" />
        </div>
      );
    case "OutputPreservesCondition":
      return (
        <div className="flex items-center gap-1.5">
          <Badge>Covenant</Badge>
          <span className="text-xs text-ink-dim">at least one output must preserve this condition root</span>
        </div>
      );
    case "OutputTo":
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>Covenant</Badge>
          <span className="text-xs text-ink-dim">output to</span>
          <Hash value={info.conditionRoot} link={false} className="text-xs" />
          <span className="text-xs text-ink-faint">min value {String(info.minValue)}</span>
        </div>
      );
    case "BalancePreserved":
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>Covenant</Badge>
          <span className="text-xs text-ink-dim">value conserved into outputs — max revealed {String(info.maxRevealed)}</span>
        </div>
      );
    default:
      return (
        <div className="min-w-0">
          <JsonTree data={info.raw} />
        </div>
      );
  }
}

function ScriptPathBlock({ witness, index }: { witness: unknown; index: number }): ReactNode {
  const info = describeScriptPathWitness(witness);
  if (!info) return null;
  return (
    <div className="rounded-lg border border-border-soft bg-surface-2/40 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone="accent">Script-path revealed</Badge>
        <span className="text-xs text-ink-faint">
          input #{index} · {info.siblingCount} sibling{info.siblingCount === 1 ? "" : "s"} in inclusion proof
        </span>
      </div>
      <div className="space-y-1.5">
        {info.leaf.map((atom, i) => (
          <AtomRow key={i} atom={atom} />
        ))}
      </div>
      {info.data && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
          <span>{info.dataIsPreimage ? "Preimage:" : "Witness data:"}</span>
          <Hash value={info.data} link={false} className="text-xs" />
        </div>
      )}
    </div>
  );
}

interface TransferInput {
  commitment?: string;
  witness?: unknown;
}

/** Decodes a `StealthTransfer` instruction's revealed script-path spends, if any -- the MAST leaf a
 * spend actually exercised (its conjunction of conditions: access rules, template predicates,
 * timelocks, hashlocks, covenants), its inclusion proof size, and any witness data, labeled as a
 * preimage when a hashlock atom is present. Key-path inputs (no script revealed) and the raw
 * confidential I/O are left to the surrounding raw JSON view -- this only surfaces what a
 * script-path spend newly makes public. */
export function StealthTransferDetail({ statement }: { statement: unknown }) {
  const inputs = (statement as { inputs_statement?: { inputs?: TransferInput[] } } | undefined)?.inputs_statement?.inputs ?? [];
  const scriptPathInputs = inputs
    .map((input, i) => ({ input, i }))
    .filter(({ input }) => describeScriptPathWitness(input.witness) !== null);

  if (scriptPathInputs.length === 0) return null;

  return (
    <div className="mb-2 space-y-2">
      {scriptPathInputs.map(({ input, i }) => (
        <ScriptPathBlock key={i} witness={input.witness} index={i} />
      ))}
    </div>
  );
}
