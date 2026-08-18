/** Returns the route a hash-like string should link to, based on its recognizable prefix, or null if it's opaque data with no natural detail page. */
export function linkForId(value: string): string | null {
  if (/^(component|resource|vault|nft|utxo|template_receipt|txreceipt)_/.test(value)) return `/substate/${value}`;
  if (/^[0-9a-f]{64}$/i.test(value)) return `/tx/${value}`;
  return null;
}
