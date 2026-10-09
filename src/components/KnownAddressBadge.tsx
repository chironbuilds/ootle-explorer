import { Badge } from "./ui";
import { categoryLabel, getKnownAddress } from "../lib/knownAddresses";

/** A small pill naming a known address (a builtin template/component/resource, or a notable
 * community one) next to its raw hash. Renders nothing for an address not on the list, so it's
 * safe to drop next to any `<Hash>` call for a template, component, resource or vault address. */
export function KnownAddressBadge({ address }: { address: string }) {
  const known = getKnownAddress(address);
  if (!known) return null;
  const tone = known.category === "community" ? "accent" : "reveal";
  const title = known.source ? `${categoryLabel(known.category)} — ${known.source}` : categoryLabel(known.category);
  return <Badge tone={tone} title={title}>{known.label}</Badge>;
}
