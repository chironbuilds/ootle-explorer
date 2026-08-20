// Tari L1 emission schedule, ported line-for-line from `EmissionSchedule`/`Emission` in
// tari-project/tari's `base_layer/transaction_components/src/consensus/emission.rs`. Computed
// entirely from live consensus constants (initial reward, decay coefficients, tail inflation
// bips, tail epoch length, pre-mine value) -- no hardcoded schedule, so this tracks whatever the
// live network is actually configured with rather than a snapshot.
//
// The decay phase has no closed form (each block's reward is an integer-truncated function of
// the previous one), so this genuinely iterates block-by-block from genesis. At mainnet's current
// height (~330K) that's a few hundred thousand cheap bigint ops -- well under the request budget
// for the one place this runs (the l1-supply serverless function), not something to call per
// render in the browser.

export interface EmissionParams {
  initialMicroXtm: bigint;
  decay: number[];
  inflationBips: bigint;
  tailEpochLength: bigint;
  initialSupplyMicroXtm: bigint;
}

export interface EmissionAtHeight {
  rewardMicroXtm: bigint;
  supplyMicroXtm: bigint;
  /** True once the schedule has crossed into tail (inflation-based) emission. */
  inTailEmission: boolean;
}

function newTailEmission(supply: bigint, inflationBips: bigint, tailEpochLength: bigint): bigint {
  const epochIssuance = (supply * inflationBips) / 10_000n;
  const reward = epochIssuance / tailEpochLength;
  return (reward / 1_000_000n) * 1_000_000n; // truncate to the nearest whole XTM
}

function nextDecayReward(reward: bigint, decay: number[]): bigint {
  let sum = reward;
  for (const k of decay) sum -= reward >> BigInt(k);
  return sum;
}

/** `EmissionSchedule::block_reward`/`supply_at_block`, combined into one pass since callers here
 * always want both. Iterates from genesis (block 1) to `targetHeight` inclusive. */
export function emissionAtHeight(params: EmissionParams, targetHeight: bigint): EmissionAtHeight {
  let supply = params.initialSupplyMicroXtm;
  let reward = 0n;
  let epoch = 0n; // 0 = decay phase, >0 = tail/inflation phase, counts epochs since entering it
  let epochCounter = 0n;

  for (let blockNum = 1n; blockNum <= targetHeight; blockNum++) {
    if (blockNum === 1n) {
      reward = params.initialMicroXtm;
    } else if (epoch > 0n) {
      epochCounter += 1n;
      if (epochCounter >= params.tailEpochLength) {
        epochCounter = 0n;
        epoch += 1n;
        reward = newTailEmission(supply, params.inflationBips, params.tailEpochLength);
      }
      // else: reward stays whatever it was set to at the start of this tail epoch
    } else {
      const cutoff = newTailEmission(supply, params.inflationBips, params.tailEpochLength);
      const decayed = nextDecayReward(reward, params.decay);
      if (decayed > cutoff) {
        reward = decayed;
      } else {
        epoch = 1n;
        reward = cutoff;
      }
    }
    supply += reward;
  }

  return { rewardMicroXtm: reward, supplyMicroXtm: supply, inTailEmission: epoch > 0n };
}

export interface TailEmissionCrossing {
  height: bigint;
  /** Total supply once this block's (first tail-rate) reward is included -- matches what
   * `emissionAtHeight(params, height)` would report, verified by construction: same
   * crossing-detection branch, same `supply += reward` order. */
  supplyMicroXtm: bigint;
}

/** Finds the first height at or after genesis where the schedule enters tail emission, by
 * continuing the same iteration (reusing no state from a prior `emissionAtHeight` call, since the
 * per-block state -- reward/epoch/epochCounter -- isn't exposed). Capped at `maxHeight` so a
 * pathological parameter set can't hang the request. Returns the supply at that height too, in
 * the same pass, since computing it via a second `emissionAtHeight` call would redo the same
 * multi-million-iteration walk from genesis. */
export function heightAtTailEmission(params: EmissionParams, maxHeight: bigint): TailEmissionCrossing | null {
  let supply = params.initialSupplyMicroXtm;
  let reward = 0n;

  for (let blockNum = 1n; blockNum <= maxHeight; blockNum++) {
    if (blockNum === 1n) {
      reward = params.initialMicroXtm;
    } else {
      const cutoff = newTailEmission(supply, params.inflationBips, params.tailEpochLength);
      const decayed = nextDecayReward(reward, params.decay);
      if (decayed > cutoff) {
        reward = decayed;
      } else {
        supply += cutoff;
        return { height: blockNum, supplyMicroXtm: supply };
      }
    }
    supply += reward;
  }
  return null;
}
