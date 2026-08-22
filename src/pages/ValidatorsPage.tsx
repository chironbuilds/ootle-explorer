import { useQueries, useQuery } from "@tanstack/react-query";
import { listValidators, type Validator } from "../lib/indexer";
import { feeClaimGroups, getFeePoolTotal } from "../lib/feePool";
import { formatMicroTari } from "../lib/format";
import { Badge, Card, ErrorBlock, KeyValueRow, LoadingBlock, PageHeader, SectionLabel, Spinner, StatTile } from "../components/ui";
import { Hash } from "../components/Hash";
import { Disclosure } from "../components/Disclosure";
import { useDocumentTitle } from "../lib/useDocumentTitle";

/** One segment per validator, sized by its share of total vote power -- a consensus set this small
   is legible directly as a stacked bar, no chart library needed. Colors cycle through the app's
   semantic palette; hover identifies each slice. */
const SEGMENT_COLORS = ["var(--accent)", "var(--veil)", "var(--reveal)", "var(--accent-dim)", "var(--success)", "var(--pending)"];

function VotePowerDistribution({ validators }: { validators: Validator[] }) {
  const total = validators.reduce((sum, v) => sum + v.vote_power, 0);
  if (validators.length === 0 || total === 0) return null;
  const even = validators.every((v) => v.vote_power === validators[0]!.vote_power);

  return (
    <Card className="mb-8 px-5 py-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium uppercase tracking-wide text-ink-dim">Vote power distribution</span>
        <span className="tabular text-ink-faint">
          {validators.length} validator{validators.length === 1 ? "" : "s"} · {total.toLocaleString()} total{even ? " · evenly split" : ""}
        </span>
      </div>
      <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-surface-2">
        {validators.map((v, i) => (
          <div
            key={v.public_key}
            style={{ width: `${(v.vote_power / total) * 100}%`, backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
            title={`${v.public_key.slice(0, 16)}… — ${v.vote_power.toLocaleString()} vote power (${((v.vote_power / total) * 100).toFixed(1)}%)`}
            className="transition-opacity hover:opacity-80"
          />
        ))}
      </div>
    </Card>
  );
}

export default function ValidatorsPage() {
  useDocumentTitle("Validators");
  const query = useQuery({ queryKey: ["validators"], queryFn: () => listValidators(100) });
  const validators = query.data?.validators ?? [];
  const groups = feeClaimGroups(validators);

  const feeQueries = useQueries({
    queries: groups.map((g) => ({
      queryKey: ["fee-pool-total", g.claimPublicKeyHex],
      queryFn: () => getFeePoolTotal(g.claimPublicKeyHex),
      enabled: validators.length > 0,
      staleTime: 30_000,
    })),
  });
  const feeByClaimKey = new Map(groups.map((g, i) => [g.claimPublicKeyHex, feeQueries[i]]));

  const totalVotePower = validators.reduce((sum, v) => sum + v.vote_power, 0);

  return (
    <div>
      <PageHeader title="Validators" sub={query.data ? `Active at epoch ${query.data.epoch.toLocaleString()}` : "Active validator set"} />

      {query.data && (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatTile label="Validators" value={validators.length} sub={`epoch ${query.data.epoch.toLocaleString()}`} accent="accent" />
          <StatTile label="Total vote power" value={totalVotePower.toLocaleString()} accent="veil" />
          <StatTile label="Fee claim pools" value={groups.length} sub="across all shards" accent="reveal" />
        </div>
      )}

      {query.data && <VotePowerDistribution validators={validators} />}

      {query.isLoading && <LoadingBlock label="Loading validators…" />}
      {query.isError && <ErrorBlock message={(query.error as Error).message} />}
      {query.data && (
        <Card className="mb-8">
          <div className="hidden grid-cols-[minmax(0,2fr)_140px_120px_110px] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
            <span>Public key</span>
            <span>Shard group</span>
            <span>Since epoch</span>
            <span className="text-right">Vote power</span>
          </div>
          {query.data.validators.map((v) => (
            <Disclosure
              key={v.public_key}
              className="border-b border-border-soft last:border-0"
              summary={
                <div className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,2fr)_140px_120px_110px] sm:items-center sm:gap-3">
                  <Hash value={v.public_key} link={false} />
                  <span className="tabular text-xs text-ink-dim">
                    {v.shard_group.start}–{v.shard_group.end_inclusive}
                  </span>
                  <span className="tabular text-xs text-ink-faint">{v.start_epoch}</span>
                  <span className="tabular text-right text-xs text-ink-dim">{v.vote_power}</span>
                </div>
              }
            >
              <div className="rounded-lg border border-border-soft">
                <KeyValueRow label="Peer ID">
                  <span className="font-mono text-xs text-ink">{v.peer_id}</span>
                </KeyValueRow>
                <KeyValueRow label="Fee claim public key">
                  <Hash value={v.fee_claim_public_key} link={false} />
                </KeyValueRow>
                <KeyValueRow label="Unclaimed fee pool">
                  {(() => {
                    const feeQuery = feeByClaimKey.get(v.fee_claim_public_key);
                    const group = groups.find((g) => g.claimPublicKeyHex === v.fee_claim_public_key);
                    if (!feeQuery || feeQuery.isLoading) return <Spinner className="h-3.5 w-3.5" />;
                    if (feeQuery.isError) return <span className="text-ink-faint">—</span>;
                    return (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="tabular text-ink">{formatMicroTari(feeQuery.data!.toString())} tTARI</span>
                        {group && group.validatorPublicKeys.length > 1 && (
                          <Badge tone="neutral" title="This claim key is shared by more than one validator -- the pool is per key, not per validator identity.">
                            shared with {group.validatorPublicKeys.length - 1} other{group.validatorPublicKeys.length - 1 === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </span>
                    );
                  })()}
                </KeyValueRow>
                <KeyValueRow label="Active until">{v.end_epoch === null ? "still active" : `epoch ${v.end_epoch}`}</KeyValueRow>
              </div>
            </Disclosure>
          ))}
        </Card>
      )}

      {query.data && groups.length > 0 && (
        <>
          <SectionLabel>Fee pools</SectionLabel>
          <p className="mb-3 text-xs text-ink-faint">
            Each total is summed live across every shard's own <code className="text-ink-dim">ValidatorFeePool</code> substate for
            that claim key (up to 256 per key) — not a single balance, and not fetched from any one place. Fees this
            validator set has earned but not yet withdrawn via a <code className="text-ink-dim">ClaimValidatorFees</code>{" "}
            instruction. Grouped by claim key, since a key — not a validator identity — is what a pool actually belongs to.
          </p>
          <Card>
            <div className="hidden grid-cols-[minmax(0,2fr)_140px_minmax(0,1fr)] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
              <span>Claim public key</span>
              <span className="text-right">Unclaimed total</span>
              <span>Used by</span>
            </div>
            {groups.map((g) => {
              const feeQuery = feeByClaimKey.get(g.claimPublicKeyHex);
              return (
                <div
                  key={g.claimPublicKeyHex}
                  className="grid grid-cols-1 gap-1.5 border-b border-border-soft px-5 py-3.5 last:border-0 sm:grid-cols-[minmax(0,2fr)_140px_minmax(0,1fr)] sm:items-center sm:gap-3"
                >
                  <Hash value={g.claimPublicKeyHex} link={false} />
                  <span className="tabular text-right text-sm text-ink">
                    {feeQuery?.isLoading ? (
                      <Spinner className="ml-auto h-3.5 w-3.5" />
                    ) : feeQuery?.isError ? (
                      "—"
                    ) : (
                      `${formatMicroTari(feeQuery!.data!.toString())} tTARI`
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {g.validatorPublicKeys.map((pk) => (
                      <Hash key={pk} value={pk} link={false} className="text-xs" />
                    ))}
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}
