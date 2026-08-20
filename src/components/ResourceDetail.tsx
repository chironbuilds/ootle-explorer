import { formatAmount } from "../lib/format";
import { Card, KeyValueRow, Badge, SectionLabel } from "./ui";
import { Hash } from "./Hash";
import { AccessRuleLabel, UpdateRuleLabel } from "./AccessRuleLabel";

interface RawResource {
  resource_type?: string;
  owner_rule?: unknown;
  access_rules?: Record<string, unknown>;
  metadata?: Record<string, string>;
  total_supply?: string | number | null;
  view_key?: string | null;
  auth_hook?: { component_address?: string; method?: string } | null;
  divisibility?: number;
}

const ACTIONS: { field: string; updater: string; label: string }[] = [
  { field: "mint", updater: "mint_updater", label: "Mint" },
  { field: "burn", updater: "burn_updater", label: "Burn" },
  { field: "recall", updater: "recall_updater", label: "Recall" },
  { field: "withdraw", updater: "withdraw_updater", label: "Withdraw" },
  { field: "deposit", updater: "deposit_updater", label: "Deposit" },
  { field: "update_nft_data", updater: "nft_data_updater", label: "Update NFT data" },
  { field: "freeze", updater: "freeze_updater", label: "Freeze" },
  { field: "update_metadata", updater: "metadata_updater", label: "Update metadata" },
];

function OwnerRuleLabel({ rule }: { rule: unknown }) {
  if (rule === "None") return <span className="text-xs text-ink-faint">No owner — access rules only</span>;
  if (rule && typeof rule === "object" && "ByPublicKey" in rule) {
    return <Hash value={String((rule as { ByPublicKey: unknown }).ByPublicKey)} link={false} className="text-xs" />;
  }
  if (rule && typeof rule === "object" && "ByAccessRule" in rule) {
    return <AccessRuleLabel rule={(rule as { ByAccessRule: unknown }).ByAccessRule} />;
  }
  return <span className="text-xs text-ink-faint">Unknown</span>;
}

/** Structured view of a `resource_` substate's permission model -- who may mint/burn/recall/etc, who
 * may change each of those rules, plus owner, total-supply tracking, and (for confidential/stealth
 * resources) an optional view key. Everything here is normally invisible, buried in the raw substate
 * JSON at the bottom of the page -- for a resource whose creator disabled the wrong permission, this
 * is the only place a holder can check before relying on it. */
export function ResourceDetail({ resource: rawResource, divisibility }: { resource: unknown; divisibility: number }) {
  const resource = rawResource as RawResource;
  const symbol = resource.metadata?.SYMBOL;
  const otherMetadata = Object.entries(resource.metadata ?? {}).filter(([k]) => k !== "SYMBOL");

  return (
    <div className="mb-8">
      <Card className="mb-4">
        <KeyValueRow label="Type">
          <Badge tone="accent">{resource.resource_type ?? "Unknown"}</Badge>
        </KeyValueRow>
        <KeyValueRow label="Divisibility">
          <span className="tabular text-sm text-ink">{divisibility}</span>
        </KeyValueRow>
        <KeyValueRow label="Total supply">
          {resource.total_supply != null ? (
            <span className="tabular text-sm text-ink">
              {formatAmount(resource.total_supply, divisibility)}
              {symbol ? ` ${symbol}` : ""}
            </span>
          ) : (
            <span className="text-xs text-ink-faint" title="Supply tracking was disabled when this resource was created -- this is common for privacy-preserving resource types, where an on-chain running total would itself leak information.">
              Not tracked
            </span>
          )}
        </KeyValueRow>
        <KeyValueRow label="Owner">
          <OwnerRuleLabel rule={resource.owner_rule} />
        </KeyValueRow>
        {resource.view_key && (
          <KeyValueRow label="View key">
            <div className="flex items-center gap-2">
              <Hash value={resource.view_key} link={false} className="text-xs" />
              <span className="text-xs text-ink-faint" title="Holders of the matching private key can decrypt this resource's confidential/stealth amounts for auditing -- everyone else still sees only what's disclosed on-chain.">
                selective disclosure
              </span>
            </div>
          </KeyValueRow>
        )}
        {resource.auth_hook && (
          <KeyValueRow label="Auth hook">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-ink-faint">calls</span>
              {resource.auth_hook.component_address && <Hash value={resource.auth_hook.component_address} className="text-xs" />}
              <span className="font-mono text-ink-dim">{resource.auth_hook.method}</span>
              <span className="text-ink-faint">on every action -- can add checks beyond the rules below</span>
            </div>
          </KeyValueRow>
        )}
        {otherMetadata.length > 0 && (
          <KeyValueRow label="Metadata">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {otherMetadata.map(([k, v]) => (
                <span key={k} className="text-ink-dim">
                  <span className="text-ink-faint">{k}:</span> {v}
                </span>
              ))}
            </div>
          </KeyValueRow>
        )}
      </Card>

      <SectionLabel>Permissions</SectionLabel>
      <Card>
        <div className="hidden grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
          <span>Action</span>
          <span>Rule</span>
          <span>Who can change it</span>
        </div>
        {ACTIONS.map(({ field, updater, label }) => (
          <div
            key={field}
            className="grid grid-cols-1 gap-1.5 border-b border-border-soft px-5 py-3 last:border-0 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-3"
          >
            <span className="text-sm text-ink">{label}</span>
            <AccessRuleLabel rule={resource.access_rules?.[field]} />
            <UpdateRuleLabel rule={resource.access_rules?.[updater]} />
          </div>
        ))}
      </Card>
    </div>
  );
}
