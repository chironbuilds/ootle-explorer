import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getSubstate } from "../lib/indexer";
import { substateKind } from "../lib/format";
import { Badge, Card, ErrorBlock, LoadingBlock, PageHeader } from "../components/ui";
import { Hash } from "../components/Hash";
import { JsonTree } from "../components/JsonTree";

const KIND_LABEL: Record<string, string> = {
  component: "Component",
  resource: "Resource",
  vault: "Vault",
  nft: "Non-fungible token",
  template: "Template",
  utxo: "Stealth UTXO",
};

export default function SubstatePage() {
  const { id = "" } = useParams();
  const kind = substateKind(id);

  const query = useQuery({ queryKey: ["substate", id], queryFn: () => getSubstate(id), enabled: !!id });

  return (
    <div>
      <PageHeader
        title={
          <span className="font-mono text-xl">
            <Hash value={id} full link={false} />
          </span>
        }
        sub="Substate"
        actions={<Badge tone="accent">{KIND_LABEL[kind] ?? kind}</Badge>}
      />

      {query.isLoading && <LoadingBlock label="Loading substate…" />}
      {query.isError &&
        (kind === "utxo" ? (
          <Card className="px-5 py-8 text-center text-sm text-ink-dim">
            This indexer can't look up stealth UTXO substates directly by address (a known limitation on its end, not this transaction) — try
            opening it from the transaction that spent or created it instead.
          </Card>
        ) : (
          <ErrorBlock message={(query.error as Error).message} />
        ))}
      {query.data && (
        <Card className="px-5 py-4">
          <JsonTree data={query.data} />
        </Card>
      )}
    </div>
  );
}
