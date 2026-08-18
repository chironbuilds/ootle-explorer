import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getSubstate } from "../lib/indexer";
import { substateKind } from "../lib/format";
import { Badge, Card, ErrorBlock, KeyValueRow, LoadingBlock, PageHeader } from "../components/ui";
import { Hash } from "../components/Hash";
import { JsonTree } from "../components/JsonTree";
import { VaultBalances } from "../components/VaultBalances";
import { ResourceActivity } from "../components/ResourceActivity";
import { ComponentActivity } from "../components/ComponentActivity";

interface ComponentSubstate {
  header?: { template_address?: string; owner_rule?: { ByPublicKey?: string } };
  body?: { state?: unknown };
}

/** Safely reaches into a component substate's raw CBOR state, or undefined for any other kind. */
function readComponentState(data: unknown): unknown {
  const substate = (data as { substate?: { Component?: ComponentSubstate } } | undefined)?.substate;
  return substate?.Component?.body?.state;
}

/** The owner public key and originating template -- both live in the component's header, entirely
 * separate from its CBOR state, so they're read independently rather than folded into VaultBalances. */
function readComponentHeader(data: unknown): { ownerPublicKey?: string; templateAddress?: string } {
  const header = (data as { substate?: { Component?: ComponentSubstate } } | undefined)?.substate?.Component?.header;
  return { ownerPublicKey: header?.owner_rule?.ByPublicKey, templateAddress: header?.template_address };
}

interface ResourceInfo {
  resourceType: string;
  divisibility: number;
  symbol?: string;
}

function readResourceInfo(data: unknown): ResourceInfo | null {
  const resource = (
    data as
      | { substate?: { Resource?: { resource_type?: string; divisibility?: number; metadata?: Record<string, string> } } }
      | undefined
  )?.substate?.Resource;
  if (!resource?.resource_type) return null;
  return { resourceType: resource.resource_type, divisibility: resource.divisibility ?? 0, symbol: resource.metadata?.SYMBOL };
}

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
        <>
          {kind === "component" &&
            (() => {
              const { ownerPublicKey, templateAddress } = readComponentHeader(query.data);
              return (ownerPublicKey || templateAddress) ? (
                <Card className="mb-8">
                  {ownerPublicKey && (
                    <KeyValueRow label="Owner public key">
                      <Hash value={ownerPublicKey} link={false} />
                    </KeyValueRow>
                  )}
                  {templateAddress && (
                    <KeyValueRow label="Template">
                      <Hash value={templateAddress} linkOverride={`/template/${templateAddress}`} />
                    </KeyValueRow>
                  )}
                </Card>
              ) : null;
            })()}
          {kind === "component" && <VaultBalances componentState={readComponentState(query.data)} />}
          {kind === "component" && <ComponentActivity componentAddress={id} componentState={readComponentState(query.data)} />}
          {kind === "resource" &&
            (() => {
              const info = readResourceInfo(query.data);
              return info ? (
                <ResourceActivity
                  resourceAddress={id}
                  divisibility={info.divisibility}
                  symbol={info.symbol}
                  isConfidential={info.resourceType === "Stealth" || info.resourceType === "Confidential"}
                />
              ) : null;
            })()}
          <Card className="px-5 py-4">
            <JsonTree data={query.data} />
          </Card>
        </>
      )}
    </div>
  );
}
