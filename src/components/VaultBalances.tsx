import { useQuery } from "@tanstack/react-query";
import { findVaultIds } from "../lib/cborState";
import { fetchSubstatesChunked, type RawResourceSubstate, type RawVaultSubstate, type ResourceContainer } from "../lib/indexer";
import { formatAmount } from "../lib/format";
import { nftSubstateId } from "../lib/nonFungible";
import { Card, LoadingBlock, SectionLabel } from "./ui";
import { Hash } from "./Hash";
import { Badge } from "./ui";

const MAX_TOKENS_SHOWN = 12;

interface Holding {
  address: string;
  amount: string | null;
  locked: string | null;
  partial: boolean;
  tokenIds: unknown[] | null;
}

function containerAmount(container: ResourceContainer): Holding {
  if ("Fungible" in container)
    return { address: container.Fungible.address, amount: container.Fungible.amount, locked: container.Fungible.locked_amount, partial: false, tokenIds: null };
  if ("Stealth" in container)
    return {
      address: container.Stealth.address,
      amount: container.Stealth.revealed_amount,
      locked: container.Stealth.locked_amount,
      partial: true,
      tokenIds: null,
    };
  if ("Confidential" in container)
    return {
      address: container.Confidential.address,
      amount: container.Confidential.revealed_amount,
      locked: container.Confidential.locked_revealed_amount,
      partial: true,
      tokenIds: null,
    };
  return { address: container.NonFungible.address, amount: null, locked: null, partial: false, tokenIds: [...container.NonFungible.token_ids] };
}

/** Shows the resources a component's own vaults hold -- reads the component's raw CBOR state to
 * find vault ids (nothing in the substate response names them directly), fetches each vault, and
 * each held resource's metadata for a symbol and correct decimal formatting. Fungible balances are
 * exact; stealth/confidential balances only ever show the revealed portion -- the vault may hold
 * more value than that, hidden in commitments no explorer can see. Non-fungible holdings show a
 * token count with each token id linked to its own substate, rather than a balance. */
export function VaultBalances({ componentState }: { componentState: unknown }) {
  const vaultIds = findVaultIds(componentState);

  const vaultsQuery = useQuery({
    queryKey: ["substates-batch", "vaults", vaultIds],
    queryFn: () => fetchSubstatesChunked(vaultIds),
    enabled: vaultIds.length > 0,
  });

  const resolved = vaultIds
    .map((id) => vaultsQuery.data?.[id]?.substate as RawVaultSubstate | undefined)
    .filter((v): v is RawVaultSubstate => !!v)
    .map((v) => containerAmount(v.Vault.resource_container));

  const resourceAddresses = [...new Set(resolved.map((r) => r.address))];
  const resourcesQuery = useQuery({
    queryKey: ["substates-batch", "resources", resourceAddresses],
    queryFn: () => fetchSubstatesChunked(resourceAddresses),
    enabled: resourceAddresses.length > 0,
  });
  const resourceByAddress = new Map(
    resourceAddresses.map((address) => [address, (resourcesQuery.data?.[address]?.substate as RawResourceSubstate | undefined)?.Resource]),
  );

  const loading = vaultsQuery.isLoading || (resourceAddresses.length > 0 && resourcesQuery.isLoading);

  if (vaultIds.length === 0) return null;

  return (
    <div className="mb-8">
      <SectionLabel>Holdings ({vaultIds.length})</SectionLabel>
      {loading && <LoadingBlock label="Loading vault balances…" />}
      {!loading && (
        <Card>
          <div className="hidden grid-cols-[minmax(0,2fr)_160px_180px] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Resource</span>
            <span className="text-right">Balance</span>
            <span></span>
          </div>
          {resolved.map((r, i) => {
            const resource = resourceByAddress.get(r.address);
            const divisibility = resource?.divisibility ?? 0;
            const symbol = resource?.metadata?.SYMBOL;
            const shown = r.tokenIds?.slice(0, MAX_TOKENS_SHOWN) ?? [];
            const hidden = (r.tokenIds?.length ?? 0) - shown.length;
            return (
              <div key={i} className="border-b border-border-soft px-5 py-3.5 last:border-0">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,2fr)_160px_180px] sm:items-center sm:gap-3">
                  <Hash value={r.address} />
                  <span className="tabular text-right text-sm text-ink">
                    {r.tokenIds !== null
                      ? `${r.tokenIds.length} token${r.tokenIds.length === 1 ? "" : "s"}`
                      : r.amount === null
                        ? "—"
                        : `${formatAmount(r.amount, divisibility)}${symbol ? ` ${symbol}` : ""}`}
                  </span>
                  <div className="justify-self-start sm:justify-self-end">{r.partial && <Badge tone="veil">Revealed portion only</Badge>}</div>
                </div>
                {shown.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {shown.map((id, j) => {
                      const substateId = nftSubstateId(r.address, id);
                      return substateId ? <Hash key={j} value={substateId} className="text-xs" /> : null;
                    })}
                    {hidden > 0 && <span className="text-xs text-ink-faint">+{hidden} more</span>}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
