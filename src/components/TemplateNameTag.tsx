import { useQuery } from "@tanstack/react-query";
import { getSubstate, getTemplate } from "../lib/indexer";
import { getKnownAddress } from "../lib/knownAddresses";
import { KnownAddressBadge } from "./KnownAddressBadge";

/** Names what an address is: the verified tick when it (or its template) is on the known list,
 * otherwise a muted chip with the template's own name (e.g. "Faucet"). For a component that is its
 * template's name; for a template address, its own. Renders nothing while loading or when the
 * indexer has no definition for it, so it never blocks or misleads. */
export function TemplateNameTag({ address }: { address: string }) {
  const isTemplate = /^[0-9a-f]{64}$/i.test(address);
  const isComponent = address.startsWith("component_");

  const substate = useQuery({
    queryKey: ["substate", address],
    queryFn: () => getSubstate(address),
    enabled: isComponent && !getKnownAddress(address),
    retry: false,
    staleTime: 60_000,
  });
  const componentTemplate = (substate.data as { substate?: { Component?: { header?: { template_address?: string } } } } | undefined)?.substate
    ?.Component?.header?.template_address;
  const templateAddress = isTemplate ? address : componentTemplate;
  const known = getKnownAddress(address) ?? (templateAddress ? getKnownAddress(templateAddress) : undefined);

  const template = useQuery({
    queryKey: ["template", templateAddress],
    queryFn: () => getTemplate(templateAddress!),
    enabled: !!templateAddress && !known,
    retry: false,
    staleTime: Infinity,
  });

  if (known) return <KnownAddressBadge address={address} />;
  const name = template.data?.name;
  if (!name) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-dim" title={`Template: ${name}`}>
      {name}
    </span>
  );
}
