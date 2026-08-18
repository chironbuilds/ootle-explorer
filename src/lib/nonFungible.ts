// A `NonFungibleId` is one of four kinds (U256/String/Uint32/Uint64), each canonicalized to a
// `<type>_<value>` string -- `NonFungibleId::to_canonical_string` in tari-ootle's
// crates/template_lib_types/src/substates/non_fungible.rs. A full NFT substate id is then
// `nft_<resource_hex>_<canonical_id>` (`NonFungibleAddress::from_str`, same crate).
export function formatNonFungibleId(id: unknown): string | null {
  if (!id || typeof id !== "object") return null;
  const entry = Object.entries(id as Record<string, unknown>)[0];
  if (!entry) return null;
  const [kind, value] = entry;
  switch (kind) {
    case "U256":
      return `uuid_${value}`;
    case "String":
      return `str_${value}`;
    case "Uint32":
      return `u32_${value}`;
    case "Uint64":
      return `u64_${value}`;
    default:
      return null;
  }
}

/** `resourceAddress` is the full `resource_<hex>` substate id. */
export function nftSubstateId(resourceAddress: string, id: unknown): string | null {
  const canonical = formatNonFungibleId(id);
  if (!canonical) return null;
  const hex = resourceAddress.replace(/^resource_/, "");
  return `nft_${hex}_${canonical}`;
}
