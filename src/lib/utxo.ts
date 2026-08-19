// Shared helpers for stealth UTXOs (`utxo_<resource>_<commitment>`) and confidential outputs
// (`coutput_<resource>_<commitment>`) -- both address forms and value shapes mirror each other
// almost exactly (`ConfidentialOutputAddress`/`UtxoAddress` in tari-ootle's
// template_lib_types crate), the real difference being that a UTXO carries its own spend
// authorization (`auth`) and scanning `tag`, while a confidential output's spend is controlled
// entirely by its owning vault's access rules instead.

/** Splits a `utxo_<resource_hex>_<commitment_hex>` or `coutput_<resource_hex>_<commitment_hex>`
 * substate id into its parts -- mirrors `UtxoAddress`/`ConfidentialOutputAddress`'s own
 * `Display`/`FromStr` in tari-ootle's template_lib_types crate byte-for-byte. */
export function parseOutputSubstateId(id: string): { prefix: "utxo" | "coutput"; resourceAddress: string; commitment: string } | null {
  const match = id.match(/^(utxo|coutput)_([0-9a-f]+)_([0-9a-f]+)$/i);
  if (!match) return null;
  return { prefix: match[1] as "utxo" | "coutput", resourceAddress: `resource_${match[2]}`, commitment: match[3]! };
}

export type SpendAuthorizationInfo =
  | { kind: "Key"; key: string }
  | { kind: "Script"; conditionRoot: string }
  | { kind: "KeyAndScript"; key: string; conditionRoot: string };

/** `SpendAuthorization` in tari-ootle's template_lib_types crate -- a stealth UTXO's spend path:
 * a one-time key (key-path), a MAST condition-tree root (script-path, e.g. an HTLC), or both (the
 * output can be claimed either way). Only the 32-byte condition *root* is ever on-chain before a
 * script-path spend -- the actual condition tree (hashlock, epoch predicate, ...) stays private
 * until the transaction that spends through it reveals the one leaf actually used. */
export function describeSpendAuthorization(auth: unknown): SpendAuthorizationInfo | null {
  if (!auth || typeof auth !== "object") return null;
  if ("Key" in auth) return { kind: "Key", key: String((auth as { Key: unknown }).Key) };
  if ("Script" in auth) return { kind: "Script", conditionRoot: String((auth as { Script: unknown }).Script) };
  if ("KeyAndScript" in auth) {
    const v = (auth as { KeyAndScript: { spend_key: unknown; condition_root: unknown } }).KeyAndScript;
    return { kind: "KeyAndScript", key: String(v.spend_key), conditionRoot: String(v.condition_root) };
  }
  return null;
}

/** `UtxoTag` is a bare u32 -- the public 4-byte hint a wallet scans for to recognize outputs
 * addressed to it, without revealing anything about the recipient. Shown as hex since it's an
 * opaque scanning value, not a meaningful quantity. */
export function formatUtxoTag(tag: number): string {
  return "0x" + (tag >>> 0).toString(16).padStart(8, "0");
}
