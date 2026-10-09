// Human-readable labels for addresses that are either part of the protocol itself (fixed at
// genesis on every network, same bytes everywhere -- see `crates/template_builtin/src/lib.rs` and
// `crates/template_lib_types/src/constants.rs` in tari-ootle) or otherwise well-known enough that a
// visitor benefits from seeing a name instead of a bare hex string.
//
// Keys match the exact string shape each address appears as elsewhere in this app: template
// addresses are bare 64-hex (the `/template/:address` route param, no prefix), everything else
// carries its substate-id prefix (`component_`, `resource_`, `vault_`), matching `linkForId`.
export type KnownAddressCategory = "builtin-template" | "builtin-component" | "builtin-resource" | "virtual-resource" | "community";

export interface KnownAddress {
  label: string;
  category: KnownAddressCategory;
  /** Where this one came from, for anything not implied by the protocol itself. */
  source?: string;
}

const CATEGORY_LABEL: Record<KnownAddressCategory, string> = {
  "builtin-template": "Builtin template",
  "builtin-component": "Builtin component",
  "builtin-resource": "Builtin resource",
  "virtual-resource": "Virtual resource",
  community: "Community",
};

export function categoryLabel(category: KnownAddressCategory): string {
  return CATEGORY_LABEL[category];
}

export const KNOWN_ADDRESSES: Record<string, KnownAddress> = {
  // --- Builtin templates (crates/template_builtin/src/lib.rs) ---
  "0000000000000000000000000000000000000000000000000000000000000000": { label: "Account Template", category: "builtin-template" },
  "0000000000000000000000000000000000000000000000000000000000000001": { label: "NFT Faucet Template", category: "builtin-template" },
  "0102030000000000000000000000000000000000000000000000000000000000": { label: "TARI Faucet Template", category: "builtin-template" },
  "0000000000000000000000000000000000000000000000000000000000000002": { label: "Liquidity Pool Template", category: "builtin-template" },
  "0000000000000000000000000000000000000000000000000000000000000003": { label: "Burn-Rate Governance Template", category: "builtin-template" },

  // --- Builtin components, instantiated at genesis (crates/template_lib_types/src/constants.rs) ---
  "component_0102030000000000000000000000000000000000000000000000000000000000": { label: "TARI Faucet", category: "builtin-component" },
  "component_00ff000000000000000000000000000000000000000000000000000000000000": { label: "NFT Faucet", category: "builtin-component" },
  "component_0104000000000000000000000000000000000000000000000000000000000000": { label: "Burn-Rate Governance Council", category: "builtin-component" },

  // --- Builtin / virtual resources ---
  "resource_0101010101010101010101010101010101010101010101010101010101010101": { label: "TARI", category: "builtin-resource" },
  "resource_0100000000000000000000000000000000000000000000000000000000000000": { label: "Public Identity NFT", category: "virtual-resource" },
  "resource_0100000000000000000000000000000000000000000000000000000000000001": { label: "Caller-Component Badge", category: "virtual-resource" },
  "resource_0100000000000000000000000000000000000000000000000000000000000002": { label: "Direct-Caller-Template Badge", category: "virtual-resource" },
  "resource_0102030000000000000000000000000000000000000000000000000000000002": { label: "TARI Faucet Claim-Tracker NFT", category: "builtin-resource" },
  "resource_ff00000000000000000000000000000000000000000000000000000000000001": { label: "NFT Faucet Resource", category: "builtin-resource" },

  // --- Community templates/components worth naming ---
  f6bb3aa676b41c9d5748509dda66406e759d1b7fba5a83017cda88006b610282: {
    label: "CaravelBurnWallet",
    category: "community",
    source: "https://github.com/okansaglam016161-pixel/caravel-burn-wallet",
  },
};

/** Looks up a known label for `value` as it would appear anywhere in this app (bare hex for a
 * template address, prefixed for a substate id). Case-insensitive; returns `undefined` for
 * anything not in the list above. */
export function getKnownAddress(value: string): KnownAddress | undefined {
  return KNOWN_ADDRESSES[value] ?? KNOWN_ADDRESSES[value.toLowerCase()];
}
