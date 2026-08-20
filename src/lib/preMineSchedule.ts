// Tari L1 (Minotari) mainnet pre-mine unlock schedule, ported line-for-line from
// `get_tokenomics_pre_mine_unlock_schedule` / `create_pre_mine_output_values` in
// tari-project/tari's `base_layer/core/src/blocks/pre_mine/mod.rs`. The schedule itself is a
// fixed, protocol-defined constant -- no network call needed to compute it, only to know the
// *current height* to split it into "already unlocked" vs "still to come" (see `unlockTimeline`
// below, fed by the live tip height from `/api/l1-supply`).
//
// All µT arithmetic uses BigInt throughout, matching Rust's u64 integer (truncating) division
// exactly -- a JS `number` divide is floating-point and would silently corrupt both the
// remainder-bucket amounts and, more importantly, produce a schedule that doesn't actually match
// what's on-chain.

export const BLOCKS_PER_DAY = 720; // 24 * 60 / 2 -- one block every ~2 minutes, by protocol constant
const MICRO = 1_000_000n;
const days_per_month = 365.25 / 12;
export const BLOCKS_PER_MONTH = Math.trunc(days_per_month * BLOCKS_PER_DAY); // 21915, exact (30.4375 * 720)

export interface PreMineItem {
  valueMicroXtm: bigint;
  /** The height at which this item is actually spendable, after any early/upfront release. */
  maturity: number;
  /** The height it would have matured at under the plain monthly cadence, ignoring any early
   * release -- what "on schedule" means for this specific chunk of tokens. */
  originalMaturity: number;
  beneficiary: string;
}

type UpfrontRelease =
  | { kind: "proportional"; percentage: number; numberOfTokens: number }
  | { kind: "custom"; items: { valueMicroXtm: bigint; maturity: number }[] }
  | { kind: "fromCadence"; items: { valueMicroXtm: bigint; takenFromPeriod: number }[] };

interface ReleaseCadence {
  initialLockupDays: number;
  monthlyFractionDenominator: number;
  upfrontRelease: UpfrontRelease[];
}

interface Apportionment {
  beneficiary: string;
  percentage: number;
  tokensAmountXtm: bigint;
  schedule: ReleaseCadence | null;
}

function cadenceBlock(valueXtm: number, count: number): { valueMicroXtm: bigint; takenFromPeriod: number }[] {
  return Array.from({ length: count }, (_, i) => ({ valueMicroXtm: BigInt(valueXtm) * MICRO, takenFromPeriod: i }));
}

/** `contributors_upfront_release()` in mod.rs -- five FromCadence groups. The two 1.26M/60 and two
 * 840K/60 pairs are genuinely duplicated in the source (each pair sums when combined by period,
 * per `create_pre_mine_output_values`'s "combine all upfront FromCadence payouts" step below) --
 * preserved exactly as written upstream, not simplified. */
function contributorsUpfrontRelease(): UpfrontRelease[] {
  return [
    { kind: "fromCadence", items: cadenceBlock(809_645, 13) },
    { kind: "fromCadence", items: cadenceBlock(1_260_000, 60) },
    { kind: "fromCadence", items: cadenceBlock(1_260_000, 60) },
    { kind: "fromCadence", items: cadenceBlock(840_000, 60) },
    { kind: "fromCadence", items: cadenceBlock(840_000, 60) },
  ];
}

/** `get_tokenomics_pre_mine_unlock_schedule(Network::MainNet)`. */
export function mainnetUnlockSchedule(): Apportionment[] {
  return [
    { beneficiary: "network_rewards", percentage: 70, tokensAmountXtm: 14_700_000_000n, schedule: null },
    {
      beneficiary: "protocol",
      percentage: 9,
      tokensAmountXtm: 1_890_000_000n,
      schedule: {
        initialLockupDays: 180,
        monthlyFractionDenominator: 48,
        upfrontRelease: [
          { kind: "proportional", percentage: 40, numberOfTokens: 20 },
          {
            kind: "custom",
            items: [
              { valueMicroXtm: 1n, maturity: 0 },
              { valueMicroXtm: 1n, maturity: 0 },
              { valueMicroXtm: 1n, maturity: 129_600 },
              { valueMicroXtm: 1n, maturity: 129_600 },
            ],
          },
        ],
      },
    },
    {
      beneficiary: "community",
      percentage: 5,
      tokensAmountXtm: 1_050_000_000n,
      schedule: { initialLockupDays: 180, monthlyFractionDenominator: 12, upfrontRelease: [] },
    },
    {
      beneficiary: "contributors",
      percentage: 4,
      tokensAmountXtm: 840_000_000n,
      schedule: { initialLockupDays: 365, monthlyFractionDenominator: 60, upfrontRelease: contributorsUpfrontRelease() },
    },
    {
      beneficiary: "participants",
      percentage: 12,
      tokensAmountXtm: 2_520_000_000n,
      schedule: { initialLockupDays: 365, monthlyFractionDenominator: 24, upfrontRelease: [] },
    },
  ];
}

/** `create_pre_mine_output_values` -- expands the schedule into the actual list of (value,
 * maturity) chunks. Apportionments with no `schedule` (network_rewards, released purely via
 * mining emission, not a pre-mine unlock) are skipped -- they're not part of this timeline. */
export function createPreMineOutputValues(apportionments: Apportionment[]): PreMineItem[] {
  const items: PreMineItem[] = [];

  for (const apportionment of apportionments) {
    const schedule = apportionment.schedule;
    if (!schedule) continue;

    let tokensValue = apportionment.tokensAmountXtm * MICRO;
    const earlyPayout: { takenFromPeriod: number; valueMicroXtm: bigint }[] = [];

    for (const release of schedule.upfrontRelease) {
      if (release.kind === "proportional") {
        if (release.percentage > 100) throw new Error(`Upfront percentage must be <= 100 for ${apportionment.beneficiary}`);
        if (release.percentage > 0) {
          const upfrontTokens = (tokensValue * BigInt(release.percentage)) / 100n;
          tokensValue -= upfrontTokens;
          const valuePerRound = upfrontTokens / BigInt(release.numberOfTokens);
          let assigned = 0n;
          for (let i = 0; i < release.numberOfTokens - 1; i++) {
            items.push({ valueMicroXtm: valuePerRound, maturity: 0, originalMaturity: 0, beneficiary: apportionment.beneficiary });
            assigned += valuePerRound;
          }
          items.push({
            valueMicroXtm: upfrontTokens - assigned,
            maturity: 0,
            originalMaturity: 0,
            beneficiary: apportionment.beneficiary,
          });
        }
      } else if (release.kind === "custom") {
        for (const r of release.items) {
          tokensValue -= r.valueMicroXtm;
          items.push({
            valueMicroXtm: r.valueMicroXtm,
            maturity: r.maturity,
            originalMaturity: r.maturity,
            beneficiary: apportionment.beneficiary,
          });
        }
      } else {
        for (const r of release.items) {
          earlyPayout.push({ takenFromPeriod: r.takenFromPeriod, valueMicroXtm: r.valueMicroXtm });
          const originalMaturity = schedule.initialLockupDays * BLOCKS_PER_DAY + r.takenFromPeriod * BLOCKS_PER_MONTH;
          // FromCadence items mature immediately (release.maturity is always 0 in the mainnet
          // schedule) -- their `originalMaturity` records what the plain cadence would have been,
          // for display only; the monthly-release loop below subtracts them from that period's
          // later payout so the period's total is conserved, not double-counted.
          items.push({ valueMicroXtm: r.valueMicroXtm, maturity: 0, originalMaturity, beneficiary: apportionment.beneficiary });
        }
      }
    }

    const periods = [...new Set(earlyPayout.map((p) => p.takenFromPeriod))].sort((a, b) => a - b);
    const earlyPayoutsSummed = new Map<number, bigint>();
    for (const period of periods) {
      const sum = earlyPayout.filter((p) => p.takenFromPeriod === period).reduce((acc, p) => acc + p.valueMicroXtm, 0n);
      earlyPayoutsSummed.set(period, sum);
    }

    const monthlyTokens = tokensValue / BigInt(schedule.monthlyFractionDenominator);
    let totalTokens = 0n;
    let maturity = 0;
    for (let i = 0; i < schedule.monthlyFractionDenominator - 1; i++) {
      totalTokens += monthlyTokens;
      maturity = schedule.initialLockupDays * BLOCKS_PER_DAY + i * BLOCKS_PER_MONTH;
      const payout = earlyPayoutsSummed.get(i);
      let adjusted = monthlyTokens;
      if (payout !== undefined) {
        if (payout >= monthlyTokens) {
          throw new Error(`upfront FromCadence payout exceeds allocated monthly payout ${i} for ${apportionment.beneficiary}`);
        }
        adjusted = monthlyTokens - payout;
      }
      items.push({ valueMicroXtm: adjusted, maturity, originalMaturity: maturity, beneficiary: apportionment.beneficiary });
    }
    const lastPeriod = schedule.monthlyFractionDenominator - 1;
    const lastTokens = tokensValue - totalTokens;
    const lastPayout = earlyPayoutsSummed.get(lastPeriod);
    let adjustedLast = lastTokens;
    if (lastPayout !== undefined) {
      if (lastPayout >= lastTokens) {
        throw new Error(`upfront FromCadence payout exceeds allocated monthly payout ${lastPeriod} for ${apportionment.beneficiary}`);
      }
      adjustedLast = lastTokens - lastPayout;
    }
    maturity += BLOCKS_PER_MONTH;
    items.push({ valueMicroXtm: adjustedLast, maturity, originalMaturity: maturity, beneficiary: apportionment.beneficiary });
  }

  return items;
}

let cachedItems: PreMineItem[] | null = null;
/** Memoized -- the schedule is a pure function of fixed constants, computed once per page load. */
export function getPreMineItems(): PreMineItem[] {
  if (!cachedItems) cachedItems = createPreMineOutputValues(mainnetUnlockSchedule());
  return cachedItems;
}

export interface UnlockTimelineEntry {
  maturity: number;
  totalMicroXtm: bigint;
  unlocked: boolean;
  byBeneficiary: Record<string, bigint>;
}

/** Groups pre-mine items by maturity height and splits into already-unlocked vs still-pending,
 * given the current chain tip. Entries are sorted by maturity ascending. */
export function unlockTimeline(currentHeight: number): UnlockTimelineEntry[] {
  const byMaturity = new Map<number, Map<string, bigint>>();
  for (const item of getPreMineItems()) {
    let group = byMaturity.get(item.maturity);
    if (!group) {
      group = new Map();
      byMaturity.set(item.maturity, group);
    }
    group.set(item.beneficiary, (group.get(item.beneficiary) ?? 0n) + item.valueMicroXtm);
  }
  return [...byMaturity.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([maturity, byBeneficiary]) => ({
      maturity,
      totalMicroXtm: [...byBeneficiary.values()].reduce((acc, v) => acc + v, 0n),
      unlocked: maturity <= currentHeight,
      byBeneficiary: Object.fromEntries(byBeneficiary),
    }));
}
