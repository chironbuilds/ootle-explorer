import { useQuery } from "@tanstack/react-query";
import { Badge } from "./ui";
import { getSubstate } from "../lib/indexer";
import { categoryLabel, getKnownAddress, type KnownAddress } from "../lib/knownAddresses";

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
  if (known) return <KnownBadge known={known} />;
  return address.startsWith("component_") ? <ComponentTemplateBadge address={address} /> : null;
}

/** A component instantiated from a known template (e.g. a CaravelBurnWallet instance) isn't itself
 * on the list -- every instance has its own address -- so its header's template is looked up and
 * that label is shown instead. Shares the substate query cache with the component's own page. */
function ComponentTemplateBadge({ address }: { address: string }) {
  const query = useQuery({ queryKey: ["substate", address], queryFn: () => getSubstate(address), retry: false, staleTime: 60_000 });
  const template = (query.data as { substate?: { Component?: { header?: { template_address?: string } } } } | undefined)?.substate?.Component
    ?.header?.template_address;
  const known = template ? getKnownAddress(template) : undefined;
  return known ? <KnownBadge known={known} /> : null;
}

function KnownBadge({ known }: { known: KnownAddress }) {
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
