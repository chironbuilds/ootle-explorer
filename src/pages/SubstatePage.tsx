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
import { UtxoDetail } from "../components/UtxoDetail";

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
  coutput: "Confidential output",
};

const VERIFIED_TITLE = "Checked against the committee before being accepted as current -- Ootle can satisfy this from a previously-trusted committee state root rather than re-running a fresh proof for every request.";
const UNVERIFIED_TITLE =
  "Not checked against the committee for this request -- verification may be disabled on this indexer, no committee member could supply a proof yet (e.g. nothing committed since an epoch change), or this was a local-only lookup.";

export default function SubstatePage() {
  const { id = "" } = useParams();
  const kind = substateKind(id);

  // A substate lookup that fails (404 for something never indexed, 500 for the indexer's known
  // stealth-UTXO limitation) will fail identically on every retry -- the id doesn't change. Retrying
  // anyway isn't just pointless: TanStack Query pauses a retry's backoff timer while the tab is
  // backgrounded/unfocused (a real, documented behavior, not a bug), so a link opened in a background
  // tab that happens to hit a failing id hangs indefinitely with zero visible feedback until the user
  // actually clicks into that tab. No retry means no pause is ever possible.
  const query = useQuery({ queryKey: ["substate", id], queryFn: () => getSubstate(id), enabled: !!id, retry: false });

  return (
    <div>
      <PageHeader
        title={
          <span className="font-mono text-xl">
            <Hash value={id} full link={false} />
          </span>
        }
        sub="Substate"
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="accent">{KIND_LABEL[kind] ?? kind}</Badge>
            {query.data && (
              <Badge tone={query.data.verified ? "reveal" : "neutral"} title={query.data.verified ? VERIFIED_TITLE : UNVERIFIED_TITLE}>
                {query.data.verified ? "Committee-verified" : "Unverified"}
              </Badge>
            )}
          </div>
        }
      />

      {query.isLoading && <LoadingBlock label="Loading substate…" />}
      {query.isError &&
        (kind === "utxo" || kind === "coutput" ? (
          <Card className="px-5 py-8 text-center text-sm text-ink-dim">
            This {kind === "utxo" ? "UTXO" : "confidential output"} has most likely already been spent. The indexer only tracks current, unspent
            state — once one is consumed, a direct lookup like this one fails on its end (a bug in how it reports "gone", not something specific
            to this one) — but it's still visible in full on the transaction that spent it, and on the transaction that created it if that one's
            still cached.
          </Card>
        ) : (
          <ErrorBlock message={(query.error as Error).message} />
        ))}
      {query.data && (
        <>
          {(kind === "utxo" || kind === "coutput") && <UtxoDetail id={id} data={query.data} kind={kind} />}
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
