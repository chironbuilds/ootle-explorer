import { useQueries } from "@tanstack/react-query";
import { findVaultIds } from "../lib/cborState";
import { getResource, getVault, type ResourceContainer } from "../lib/indexer";
import { formatAmount } from "../lib/format";
import { Card, LoadingBlock, SectionLabel } from "./ui";
import { Hash } from "./Hash";
import { Badge } from "./ui";

function containerAmount(container: ResourceContainer): { address: string; amount: string | null; locked: string | null; partial: boolean } {
  if ("Fungible" in container) return { address: container.Fungible.address, amount: container.Fungible.amount, locked: container.Fungible.locked_amount, partial: false };
  if ("Stealth" in container) return { address: container.Stealth.address, amount: container.Stealth.revealed_amount, locked: container.Stealth.locked_amount, partial: true };
  if ("Confidential" in container)
    return { address: container.Confidential.address, amount: container.Confidential.revealed_amount, locked: container.Confidential.locked_revealed_amount, partial: true };
  return { address: container.NonFungible.address, amount: null, locked: null, partial: false };
}

/** Shows the resources a component's own vaults hold -- reads the component's raw CBOR state to
 * find vault ids (nothing in the substate response names them directly), fetches each vault, and
 * each held resource's metadata for a symbol and correct decimal formatting. Fungible balances are
 * exact; stealth/confidential balances only ever show the revealed portion -- the vault may hold
 * more value than that, hidden in commitments no explorer can see. */
export function VaultBalances({ componentState }: { componentState: unknown }) {
  const vaultIds = findVaultIds(componentState);

  const vaultQueries = useQueries({
    queries: vaultIds.map((id) => ({ queryKey: ["substate", id], queryFn: () => getVault(id) })),
  });

  const loading = vaultQueries.some((q) => q.isLoading);
  const resolved = vaultQueries
    .map((q) => q.data)
    .filter((d): d is NonNullable<typeof d> => !!d)
    .map((d) => containerAmount(d.substate.Vault.resource_container));

  const resourceAddresses = [...new Set(resolved.map((r) => r.address))];
  const resourceQueries = useQueries({
    queries: resourceAddresses.map((address) => ({ queryKey: ["resource", address], queryFn: () => getResource(address) })),
  });
  const resourceByAddress = new Map(resourceAddresses.map((address, i) => [address, resourceQueries[i]?.data]));

  if (vaultIds.length === 0) return null;

  return (
    <div className="mb-8">
      <SectionLabel>Holdings ({vaultIds.length})</SectionLabel>
      {loading && <LoadingBlock label="Loading vault balances…" />}
      {!loading && (
        <Card>
          <div className="hidden grid-cols-[minmax(0,2fr)_auto_auto] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Resource</span>
            <span className="text-right">Balance</span>
            <span></span>
          </div>
          {resolved.map((r, i) => {
            const resource = resourceByAddress.get(r.address);
            const divisibility = resource?.resource.divisibility ?? 0;
            const symbol = resource?.resource.metadata?.SYMBOL;
            return (
              <div
                key={i}
                className="grid grid-cols-1 gap-1.5 border-b border-border-soft px-5 py-3.5 last:border-0 sm:grid-cols-[minmax(0,2fr)_auto_auto] sm:items-center sm:gap-3"
              >
                <Hash value={r.address} />
                <span className="tabular text-right text-sm text-ink">
                  {r.amount === null ? "—" : formatAmount(r.amount, divisibility)}
                  {symbol ? ` ${symbol}` : ""}
                </span>
                <div className="justify-self-start sm:justify-self-end">{r.partial && <Badge tone="veil">Revealed portion only</Badge>}</div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
