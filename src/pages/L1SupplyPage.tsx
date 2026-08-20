import { useQuery } from "@tanstack/react-query";
import { getL1Supply } from "../lib/l1";
import { formatMicroTari, formatNumber } from "../lib/format";
import { unlockTimeline, type UnlockTimelineEntry } from "../lib/preMineSchedule";
import { Badge, Card, ErrorBlock, KeyValueRow, LoadingBlock, PageHeader, SectionLabel, StatTile } from "../components/ui";

const TOTAL_SUPPLY_CAP_XTM = 21_000_000_000n;
const POW_ALGO_LABEL: Record<string, string> = {
  "0": "RandomX (M)",
  "1": "SHA3x",
  "2": "RandomX (T)",
  "3": "Cuckaroo",
};

const BENEFICIARY_LABEL: Record<string, string> = {
  protocol: "Protocol infrastructure & grants",
  community: "Community",
  contributors: "Contributors",
  participants: "Participants",
  network_rewards: "Network rewards (mining)",
};

function xtm(microXtm: string | bigint): string {
  return formatMicroTari(typeof microXtm === "bigint" ? microXtm.toString() : microXtm);
}

function formatEta(blocksAway: number, avgBlockSeconds: number | null): string {
  if (avgBlockSeconds === null || avgBlockSeconds <= 0) return `${formatNumber(blocksAway)} blocks away`;
  const seconds = blocksAway * avgBlockSeconds;
  const days = seconds / 86_400;
  if (days < 1) return `~${Math.round(seconds / 3600)}h`;
  if (days < 60) return `~${Math.round(days)}d`;
  return `~${(days / 30.44).toFixed(1)}mo`;
}

function UnlockRow({ entry, currentHeight, avgBlockSeconds }: { entry: UnlockTimelineEntry; currentHeight: number; avgBlockSeconds: number | null }) {
  const beneficiaries = Object.entries(entry.byBeneficiary);
  return (
    <div className="grid grid-cols-1 gap-1.5 border-b border-border-soft px-5 py-3.5 last:border-0 sm:grid-cols-[110px_130px_minmax(0,1fr)] sm:items-center sm:gap-3">
      <span className="tabular text-sm text-ink">height {formatNumber(entry.maturity)}</span>
      <span className="tabular text-sm font-medium text-ink">{xtm(entry.totalMicroXtm)} XTM</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {entry.unlocked ? (
          <Badge tone="reveal">unlocked</Badge>
        ) : (
          <Badge tone="veil">{formatEta(entry.maturity - currentHeight, avgBlockSeconds)}</Badge>
        )}
        {beneficiaries.map(([name, value]) => (
          <span key={name} className="text-xs text-ink-faint">
            {BENEFICIARY_LABEL[name] ?? name}: {xtm(value)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function L1SupplyPage() {
  const query = useQuery({ queryKey: ["l1-supply"], queryFn: getL1Supply, refetchInterval: 60_000 });

  const supply = query.data?.supply;
  const currentHeight = query.data ? Number(query.data.tip.height) : null;
  const avgBlockSeconds = query.data?.recentBlockTime.avgSeconds ?? null;

  const timeline = currentHeight !== null ? unlockTimeline(currentHeight) : null;
  const scheduledUnlockedSoFar = timeline
    ?.filter((t) => t.unlocked)
    .reduce((acc, t) => acc + t.totalMicroXtm, 0n);
  const upcoming = timeline?.filter((t) => !t.unlocked) ?? [];
  const recentlyUnlocked = timeline
    ? [...timeline.filter((t) => t.unlocked)].reverse().slice(0, 5)
    : [];

  const totalEverMinted =
    supply !== undefined ? BigInt(supply.minedRewards) + BigInt(supply.totalPreMine) : null;

  return (
    <div>
      <PageHeader
        title="L1 Supply"
        sub={
          <>
            Tari base layer (Minotari, XTM) token supply — live from the public base node at{" "}
            <a href="https://grpc.tari.com" className="text-accent hover:text-accent-strong" target="_blank" rel="noreferrer">
              grpc.tari.com
            </a>
            . A separate chain from the Ootle L2 this explorer otherwise covers.
          </>
        }
      />

      {query.isLoading && <LoadingBlock label="Querying the base node…" />}
      {query.isError && <ErrorBlock message={(query.error as Error).message} />}

      {query.data && supply && currentHeight !== null && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Chain tip"
              value={formatNumber(currentHeight)}
              sub={avgBlockSeconds !== null ? `~${avgBlockSeconds.toFixed(0)}s / block` : undefined}
              accent="accent"
            />
            <StatTile
              label="Total minted so far"
              value={totalEverMinted !== null ? xtm(totalEverMinted) : "—"}
              sub={`of ${formatNumber(TOTAL_SUPPLY_CAP_XTM.toString())} XTM max`}
              title={totalEverMinted !== null ? `${xtm(totalEverMinted)} XTM` : undefined}
              accent="reveal"
            />
            <StatTile
              label="Circulating supply"
              value={xtm(supply.circulatingSupply)}
              sub="mined + spendable pre-mine"
              title={`${xtm(supply.circulatingSupply)} XTM`}
              accent="veil"
            />
            <StatTile
              label="Spendable now"
              value={xtm(supply.totalSpendable)}
              sub="everything currently unlocked"
              title={`${xtm(supply.totalSpendable)} XTM`}
              accent="accent"
            />
          </div>

          <SectionLabel>Supply breakdown</SectionLabel>
          <Card className="mb-8">
            <KeyValueRow label="Pre-mine total">
              <span className="tabular">{xtm(supply.totalPreMine)} XTM</span>
              <span className="ml-2 text-xs text-ink-faint">30% of the 21B max supply, per published tokenomics</span>
            </KeyValueRow>
            <KeyValueRow label="— spendable now">
              <span className="tabular text-ink">{xtm(supply.spendablePreMine)} XTM</span>
            </KeyValueRow>
            <KeyValueRow label="— still locked">
              <span className="tabular text-ink">{xtm(supply.timeLockedPreMine)} XTM</span>
            </KeyValueRow>
            <KeyValueRow label="Mined (coinbase emission)">
              <span className="tabular">{xtm(supply.minedRewards)} XTM</span>
              <span className="ml-2 text-xs text-ink-faint">70% of max supply is released this way, over time</span>
            </KeyValueRow>
            <KeyValueRow label="— spendable now">
              <span className="tabular text-ink">{xtm(supply.spendableRewards)} XTM</span>
            </KeyValueRow>
            <KeyValueRow label="— coinbase-maturity locked">
              <span className="tabular text-ink">
                {xtm((BigInt(supply.minedRewards) - BigInt(supply.spendableRewards)).toString())} XTM
              </span>
              <span
                className="ml-2 text-xs text-ink-faint"
                title="Every mined block reward is locked for this many blocks before it can be spent -- a short-lived rolling window, not a long-term lockup."
              >
                {supply.spendableRewards && `${formatNumber(query.data.constants.coinbaseMinMaturity)}-block coinbase maturity window`}
              </span>
            </KeyValueRow>
            {Object.keys(query.data.powAlgoMix).length > 0 && (
              <KeyValueRow label="Mining, recent mix">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(query.data.powAlgoMix).map(([algo, count]) => (
                    <Badge key={algo} tone="neutral">
                      {POW_ALGO_LABEL[algo] ?? `algo ${algo}`}: {count}
                    </Badge>
                  ))}
                </div>
                <span className="ml-2 text-xs text-ink-faint">last {query.data.recentBlockTime.sampleBlocks} blocks</span>
              </KeyValueRow>
            )}
          </Card>

          <SectionLabel>Pre-mine unlock schedule</SectionLabel>
          <p className="mb-3 text-xs text-ink-faint">
            Computed directly from the protocol's own release-schedule constants (
            <a
              href="https://github.com/tari-project/tari/blob/development/base_layer/core/src/blocks/pre_mine/mod.rs"
              className="text-accent hover:text-accent-strong"
              target="_blank"
              rel="noreferrer"
            >
              pre_mine/mod.rs
            </a>
            ), not fetched from anywhere — this is the original genesis release plan for the 4 scheduled apportionments
            (network rewards has no lock schedule; it's released purely through mining). It won't exactly match the live
            "spendable now" figure above: some pre-mine outputs have since been spent and restructured into new
            confidential outputs with different lock heights, which this static schedule can't see (
            {scheduledUnlockedSoFar !== undefined && (
              <>
                {" "}
                schedule says {xtm(scheduledUnlockedSoFar)} XTM unlocked by now vs {xtm(supply.spendablePreMine)} XTM
                actually spendable
              </>
            )}
            ).
          </p>
          <Card className="mb-8">
            <div className="hidden grid-cols-[110px_130px_minmax(0,1fr)] gap-3 border-b border-border-soft px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint sm:grid">
              <span>Height</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {recentlyUnlocked.map((entry) => (
              <UnlockRow key={`u-${entry.maturity}`} entry={entry} currentHeight={currentHeight} avgBlockSeconds={avgBlockSeconds} />
            ))}
            {upcoming.slice(0, 8).map((entry) => (
              <UnlockRow key={`p-${entry.maturity}`} entry={entry} currentHeight={currentHeight} avgBlockSeconds={avgBlockSeconds} />
            ))}
            {upcoming.length === 0 && recentlyUnlocked.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-ink-dim">No schedule data.</p>
            )}
          </Card>
          {upcoming.length > 8 && (
            <p className="mb-8 text-xs text-ink-faint">
              +{upcoming.length - 8} more scheduled unlock{upcoming.length - 8 === 1 ? "" : "s"} after this.
            </p>
          )}
        </>
      )}
    </div>
  );
}
