import { useQuery } from "@tanstack/react-query";
import { getResource } from "../lib/indexer";
import { parseNftSubstateId } from "../lib/nonFungible";
import { Card, KeyValueRow, Badge, SectionLabel } from "./ui";
import { Hash } from "./Hash";
import { JsonTree } from "./JsonTree";

interface NonFungibleValue {
  data?: unknown;
  mutable_data?: unknown;
}

function isEmptyCborMap(value: unknown): boolean {
  return !!value && typeof value === "object" && "entries" in value && Array.isArray((value as { entries: unknown[] }).entries) && (value as { entries: unknown[] }).entries.length === 0;
}

/** Structured view for a non-fungible token substate -- splits its id into the resource it belongs
 * to and its own token id (any of the four `NonFungibleId` kinds, already canonicalized in the id
 * itself), and separates its immutable vs. mutable data. Both are entirely template-defined CBOR
 * (`NonFungible.data`/`mutable_data` in tari-ootle's engine_types crate carry no fixed schema --
 * unlike a fungible resource's metadata, there's no protocol-level name/image/attributes contract,
 * only whatever convention the minting template chose), so they're shown via the same generic
 * JsonTree used everywhere else rather than assuming a shape that may not hold. */
export function NftDetail({ id, data }: { id: string; data: unknown }) {
  const parsed = parseNftSubstateId(id);

  const resourceQuery = useQuery({
    queryKey: ["resource", parsed?.resourceAddress],
    queryFn: () => getResource(parsed!.resourceAddress),
    enabled: !!parsed,
  });

  if (!parsed) return null;

  const nft = (data as { substate?: { NonFungible?: NonFungibleValue | null } } | undefined)?.substate?.NonFungible;
  const burnt = nft === null || nft === undefined;
  const symbol = resourceQuery.data?.resource.metadata?.SYMBOL;

  return (
    <>
      <Card className="mb-8">
        <KeyValueRow label="Resource">
          <div className="flex items-center gap-2">
            <Hash value={parsed.resourceAddress} />
            {symbol && <Badge tone="accent">{symbol}</Badge>}
          </div>
        </KeyValueRow>
        <KeyValueRow label="Token ID">
          <span className="break-all font-mono text-sm text-ink">{parsed.tokenId}</span>
        </KeyValueRow>
      </Card>

      {burnt ? (
        <Card className="mb-8 px-5 py-8 text-center text-sm text-ink-dim">No data attached to this token.</Card>
      ) : (
        <>
          {!isEmptyCborMap(nft.data) && (
            <div className="mb-8">
              <SectionLabel>Immutable data</SectionLabel>
              <Card className="px-5 py-4">
                <JsonTree data={nft.data} />
              </Card>
            </div>
          )}
          {!isEmptyCborMap(nft.mutable_data) && (
            <div className="mb-8">
              <SectionLabel>Mutable data</SectionLabel>
              <Card className="px-5 py-4">
                <JsonTree data={nft.mutable_data} />
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
