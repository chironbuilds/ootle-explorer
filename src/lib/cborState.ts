// The indexer returns component/resource state as CBOR pre-converted into a JSON "diagnostic
// notation" tree (`{"@cbor":"tag","tag":<n>,"value":...}`, `{"@cbor":"bytes","hex":"..."}`, etc.),
// not raw binary CBOR -- so finding a component's held vaults just means walking that JSON tree
// looking for tag 132 (VaultId), the same generic, structure-agnostic approach
// `iterVaultIdsInState` in the real Ootle SDK takes against the binary form. The tag numbers
// themselves are `BinaryTag` in tari-ootle's `crates/template_lib_types/src/substates/binary_tag.rs`
// -- 131 is ResourceAddress, 132 is VaultId; this only needs the latter, since fetching each vault's
// own substate already reveals its resource address directly.
const VAULT_ID_TAG = 132;

interface CborTagNode {
  "@cbor": "tag";
  tag: number;
  value?: { "@cbor": "bytes"; hex: string };
}

function isCborTagNode(value: unknown): value is CborTagNode {
  return typeof value === "object" && value !== null && (value as Record<string, unknown>)["@cbor"] === "tag";
}

function walk(value: unknown, seen: Set<string>): void {
  if (isCborTagNode(value)) {
    if (value.tag === VAULT_ID_TAG && value.value?.["@cbor"] === "bytes") {
      seen.add(`vault_${value.value.hex}`);
    }
    walk(value.value, seen);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, seen);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) walk(item, seen);
  }
}

/** Finds every distinct `vault_<hex>` id referenced anywhere in a component's decoded state. */
export function findVaultIds(value: unknown): string[] {
  const seen = new Set<string>();
  walk(value, seen);
  return [...seen];
}
