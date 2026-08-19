// Decodes a revealed script-path spend witness -- the one MAST leaf (a conjunction of
// `AtomicCondition`s) and inclusion proof a `StealthTransfer` instruction reveals when spending a
// stealth output via its script path, per `SpendWitness::ScriptPath` in tari-ootle's
// template_lib_types crate (crates/template_lib_types/src/stealth/{spend_witness,unspent_output}.rs).
//
// A condition tree's *unexercised* branches are never reconstructable from on-chain data -- only
// the committed 32-byte root is public before a spend. This only ever decodes the one leaf a real
// spend actually revealed, which is by definition public at that point; it does not and cannot
// recover the rest of the tree.

export type AtomicConditionInfo =
  | { kind: "AccessRule"; rule: unknown }
  | { kind: "TemplateFunction"; template: string; function: string; args: string[] }
  | { kind: "AfterEpoch"; epoch: string | number }
  | { kind: "BeforeEpoch"; epoch: string | number }
  | { kind: "HashLock"; hash: string; alg: string }
  | { kind: "OutputPreservesCondition" }
  | { kind: "OutputTo"; conditionRoot: string; minValue: string | number }
  | { kind: "BalancePreserved"; maxRevealed: string | number }
  | { kind: "unknown"; raw: unknown };

export function describeAtomicCondition(atom: unknown): AtomicConditionInfo {
  if (atom && typeof atom === "object") {
    if ("AccessRule" in atom) return { kind: "AccessRule", rule: (atom as { AccessRule: unknown }).AccessRule };
    if ("TemplateFunction" in atom) {
      const v = (atom as { TemplateFunction: { template: unknown; function: unknown; args: unknown[] } }).TemplateFunction;
      return { kind: "TemplateFunction", template: String(v.template), function: String(v.function), args: (v.args ?? []).map(String) };
    }
    if ("Builtin" in atom) {
      const builtin = (atom as { Builtin: unknown }).Builtin;
      if (builtin && typeof builtin === "object") {
        if ("AfterEpoch" in builtin) return { kind: "AfterEpoch", epoch: (builtin as { AfterEpoch: string | number }).AfterEpoch };
        if ("BeforeEpoch" in builtin) return { kind: "BeforeEpoch", epoch: (builtin as { BeforeEpoch: string | number }).BeforeEpoch };
        if ("HashLock" in builtin) {
          const hl = (builtin as { HashLock: { hash: unknown; alg: unknown } }).HashLock;
          return { kind: "HashLock", hash: String(hl.hash), alg: String(hl.alg) };
        }
      }
    }
    if ("Covenant" in atom) {
      const covenant = (atom as { Covenant: unknown }).Covenant;
      if (covenant === "OutputPreservesCondition") return { kind: "OutputPreservesCondition" };
      if (covenant && typeof covenant === "object") {
        if ("OutputTo" in covenant) {
          const v = (covenant as { OutputTo: { condition_root: unknown; min_value: unknown } }).OutputTo;
          return { kind: "OutputTo", conditionRoot: String(v.condition_root), minValue: v.min_value as string | number };
        }
        if ("BalancePreserved" in covenant) {
          return { kind: "BalancePreserved", maxRevealed: (covenant as { BalancePreserved: string | number }).BalancePreserved };
        }
      }
    }
  }
  return { kind: "unknown", raw: atom };
}

export interface ScriptPathWitnessInfo {
  leaf: unknown[];
  siblingCount: number;
  data: string | null;
  /** True when one of the leaf's atoms is a HashLock -- the witness `data` blob is then that atom's
   * preimage by construction (a data-consuming builtin owns the whole blob and must be the sole
   * consumer in its leaf), not an arbitrary witness. */
  dataIsPreimage: boolean;
}

/** Reads a `StealthTransfer` input's `witness` field -- `"KeyPath"` (a bare string, no payload) or
 * `{"ScriptPath": {leaf, proof, data}}`. Returns null for key-path or anything unrecognized. */
export function describeScriptPathWitness(witness: unknown): ScriptPathWitnessInfo | null {
  if (!witness || typeof witness !== "object" || !("ScriptPath" in witness)) return null;
  const v = (witness as { ScriptPath: { leaf?: unknown[]; proof?: { siblings?: unknown[] }; data?: string } }).ScriptPath;
  const leaf = Array.isArray(v.leaf) ? v.leaf : [];
  const data = typeof v.data === "string" && v.data.length > 0 ? v.data : null;
  return {
    leaf,
    siblingCount: v.proof?.siblings?.length ?? 0,
    data,
    dataIsPreimage: leaf.some((atom) => describeAtomicCondition(atom).kind === "HashLock"),
  };
}
