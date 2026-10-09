import { Badge } from "./ui";
import { categoryLabel, getKnownAddress } from "../lib/knownAddresses";

/** Filled-circle checkmark, the familiar "verified identity" mark -- blue regardless of the
 * badge's own tone, so it reads as a platform-level verification rather than a category color. */
function VerifiedTick() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="#1d9bf0" />
      <path d="M4.8 8.2l2 2 4.4-4.8" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A small pill naming a known address (a builtin template/component/resource, or a notable
 * community one) next to its raw hash, with a verified tick -- this label is curated by Veil, not
 * inferred or self-reported by the address's own owner. Renders nothing for an address not on the
 * list, so it's safe to drop next to any `<Hash>` call for a template, component, resource or
 * vault address. */
export function KnownAddressBadge({ address }: { address: string }) {
  const known = getKnownAddress(address);
  if (!known) return null;
  const tone = known.category === "community" ? "accent" : "reveal";
  const title = known.source
    ? `Verified by Veil as ${categoryLabel(known.category)} — ${known.source}`
    : `Verified by Veil as ${categoryLabel(known.category)}`;
  return (
    <Badge tone={tone} title={title}>
      <span className="inline-flex items-center gap-1">
        <VerifiedTick />
        {known.label}
      </span>
    </Badge>
  );
}
