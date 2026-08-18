import type { ReactNode } from "react";
import { Hash } from "./Hash";
import { Badge } from "./ui";

// A human-readable one-liner for a transaction `Instruction`, per the `Instruction` enum in
// tari-ootle's crates/transaction/src/v1/instruction.rs. Every field name and shape below (`call`
// vs `address`, ComponentReference/ResourceAddressRef as `{Address}`/`{Workspace}`,
// WorkspaceOffsetId as `{id, offset}`) mirrors that source exactly -- this only covers variants
// worth a tailored summary; anything else (or a shape mismatch) falls back to just the variant
// name, with the full JsonTree already rendered alongside for complete detail either way.

function componentOrWorkspace(ref: unknown): ReactNode {
  if (ref && typeof ref === "object") {
    if ("Address" in ref) return <Hash value={(ref as { Address: string }).Address} />;
    if ("Workspace" in ref) return <span className="font-mono text-xs text-ink-dim">workspace[{String((ref as { Workspace: unknown }).Workspace)}]</span>;
  }
  return <span className="text-ink-faint">—</span>;
}

function bucketSlot(ref: unknown): ReactNode {
  if (ref && typeof ref === "object" && "id" in ref) {
    const { id, offset } = ref as { id: unknown; offset?: unknown };
    return (
      <span className="font-mono text-xs text-ink-dim">
        bucket[{String(id)}
        {offset != null ? `.${offset}` : ""}]
      </span>
    );
  }
  return <span className="text-ink-faint">—</span>;
}

function argCount(args: unknown): ReactNode {
  if (!Array.isArray(args) || args.length === 0) return null;
  return (
    <span className="text-xs text-ink-faint">
      ({args.length} arg{args.length === 1 ? "" : "s"})
    </span>
  );
}

export function InstructionSummary({ instruction }: { instruction: unknown }) {
  // Unit variants (no fields) serialize as a bare string, not `{Variant: ...}`.
  if (typeof instruction === "string") return <Badge>{instruction}</Badge>;
  if (!instruction || typeof instruction !== "object") return null;

  const entry = Object.entries(instruction as Record<string, unknown>)[0];
  if (!entry) return null;
  const [variant, raw] = entry;
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const row = "flex flex-wrap items-center gap-2 text-sm";

  switch (variant) {
    case "CallMethod":
      return (
        <div className={row}>
          <Badge tone="accent">call</Badge>
          <span className="font-mono font-medium text-ink">{String(body.method ?? "?")}</span>
          <span className="text-ink-faint">on</span>
          {componentOrWorkspace(body.call)}
          {argCount(body.args)}
        </div>
      );
    case "CallFunction":
      return (
        <div className={row}>
          <Badge tone="accent">call</Badge>
          <span className="font-mono font-medium text-ink">{String(body.function ?? "?")}</span>
          <span className="text-ink-faint">on template</span>
          {typeof body.address === "string" ? (
            <Hash value={body.address} linkOverride={`/template/${body.address}`} />
          ) : (
            <span className="text-ink-faint">—</span>
          )}
          {argCount(body.args)}
        </div>
      );
    case "CreateAccount":
      return (
        <div className={row}>
          <Badge tone="reveal">create</Badge>
          <span className="text-ink-dim">Account owned by</span>
          {typeof body.owner_public_key === "string" ? <Hash value={body.owner_public_key} link={false} /> : null}
        </div>
      );
    case "PutLastInstructionOutputOnWorkspace":
      return (
        <div className={row}>
          <Badge>workspace</Badge>
          <span className="text-ink-dim">
            Save last output → workspace[{String(body.key)}]
          </span>
        </div>
      );
    case "AllocateAddress":
      return (
        <div className={row}>
          <Badge>allocate</Badge>
          <span className="text-ink-dim">
            {String(body.allocatable_type ?? "address")} address → workspace[{String(body.workspace_id)}]
          </span>
        </div>
      );
    case "TakeFromBucket":
      return (
        <div className={row}>
          <Badge>bucket</Badge>
          <span className="text-ink-dim">Take</span>
          <span className="tabular text-ink">{String(body.amount)}</span>
          <span className="text-ink-faint">from</span>
          {bucketSlot(body.input_bucket)}
          <span className="text-ink-faint">→</span>
          <span className="font-mono text-xs text-ink-dim">bucket[{String(body.output_bucket)}]</span>
        </div>
      );
    case "PutIntoBucket":
      return (
        <div className={row}>
          <Badge>bucket</Badge>
          <span className="text-ink-dim">Merge</span>
          {bucketSlot(body.src)}
          <span className="text-ink-faint">into</span>
          {bucketSlot(body.dest)}
        </div>
      );
    case "PayFeeFromBucket":
      return (
        <div className={row}>
          <Badge tone="veil">fee</Badge>
          <span className="text-ink-dim">Pay fee from</span>
          {bucketSlot(body.bucket)}
        </div>
      );
    case "EmitLog":
      return (
        <div className={row}>
          <Badge>{String(body.level ?? "log")}</Badge>
          <span className="break-all text-ink-dim">{String(body.message ?? "")}</span>
        </div>
      );
    case "UpdateComponentTemplate":
      return (
        <div className={row}>
          <Badge tone="veil">migrate</Badge>
          {componentOrWorkspace(body.component)}
          <span className="text-ink-faint">→ template</span>
          {typeof body.new_template === "string" ? (
            <Hash value={body.new_template} linkOverride={`/template/${body.new_template}`} />
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </div>
      );
    case "ClaimValidatorFees":
      return (
        <div className={row}>
          <Badge tone="reveal">claim</Badge>
          <span className="text-ink-dim">Validator fees</span>
          {typeof body.address === "string" ? <Hash value={body.address} link={false} /> : null}
        </div>
      );
    default:
      return (
        <div className={row}>
          <Badge>{variant}</Badge>
        </div>
      );
  }
}
