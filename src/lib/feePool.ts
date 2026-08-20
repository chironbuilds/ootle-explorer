// Validator fee pools: deterministic addresses derived from a validator's `fee_claim_public_key`,
// ported from `derive_fee_pool_address` in tari-ootle's `crates/common_types/src/fee_pool.rs`.
//
// A validator's accumulated (unclaimed) fees aren't held in one place -- they're split into up to
// `NUM_PRESHARDS` (256) separate `ValidatorFeePool` substates, one per shard the validator is
// responsible for, each addressed as `vnfp_<2 shard-prefix bytes><30 bytes of the claim public
// key>`. There's no hash involved, just bit-packing: the top 8 bits of the address (for 256
// preshards) encode `shard - 1`, the rest is the claim key's own tail bytes verbatim -- ported and
// verified directly against a live substate before use (see `getValidatorFeeTotal`'s own doc
// comment), not derived from docs alone.
//
// Multiple validators can (and on small networks, typically do) share the same claim key -- fees
// pool per *key*, not per validator identity, so `feeClaimGroups` groups by key rather than
// assuming a 1:1 mapping.
import { fetchSubstatesChunked } from "./indexer";

export const NUM_PRESHARDS = 256;

/** `derive_fee_pool_address(claim_public_key, NumPreshards::P256, shard)`. `shard` is 1-indexed
 * (shard 0 is reserved as "global" in the Rust source and never a valid input here). */
export function deriveFeePoolAddress(claimPublicKeyHex: string, shard: number): string {
  if (shard < 1 || shard > NUM_PRESHARDS) throw new Error(`shard must be in 1..=${NUM_PRESHARDS}, got ${shard}`);
  if (!/^[0-9a-f]{64}$/i.test(claimPublicKeyHex)) throw new Error(`claimPublicKeyHex must be 32 bytes hex, got ${claimPublicKeyHex}`);
  const pkBytes = new Uint8Array(claimPublicKeyHex.length / 2);
  for (let i = 0; i < pkBytes.length; i++) pkBytes[i] = parseInt(claimPublicKeyHex.slice(i * 2, i * 2 + 2), 16);

  const shardBits = Math.log2(NUM_PRESHARDS); // 8 for 256 preshards
  const shift = 16 - shardBits;
  const shardIndex = shard - 1;
  const prefix = (shardIndex << shift) & 0xffff;

  const address = new Uint8Array(32);
  address[0] = (prefix >> 8) & 0xff;
  address[1] = prefix & 0xff;
  address.set(pkBytes.slice(2), 2);

  let hex = "";
  for (const b of address) hex += b.toString(16).padStart(2, "0");
  return `vnfp_${hex}`;
}

interface RawValidatorFeePool {
  ValidatorFeePool: { claim_public_key: string; amount: number };
}

/** Fetches every shard's fee pool substate for `claimPublicKeyHex` (batched, up to 13 requests for
 * 256 shards) and sums whatever exists -- most shards have no pool yet (never accrued a fee) and
 * are simply absent from the batch response, not an error. Returns the total in µT. */
export async function getFeePoolTotal(claimPublicKeyHex: string): Promise<bigint> {
  const addresses = Array.from({ length: NUM_PRESHARDS }, (_, i) => deriveFeePoolAddress(claimPublicKeyHex, i + 1));
  const results = await fetchSubstatesChunked(addresses);
  let total = 0n;
  for (const entry of Object.values(results)) {
    const value = entry.substate as RawValidatorFeePool | undefined;
    if (value?.ValidatorFeePool) total += BigInt(value.ValidatorFeePool.amount);
  }
  return total;
}

export interface FeeClaimGroup {
  claimPublicKeyHex: string;
  validatorPublicKeys: string[];
}

/** Groups validators by their (possibly shared) `fee_claim_public_key`. */
export function feeClaimGroups(validators: { public_key: string; fee_claim_public_key: string }[]): FeeClaimGroup[] {
  const byKey = new Map<string, string[]>();
  for (const v of validators) {
    const list = byKey.get(v.fee_claim_public_key) ?? [];
    list.push(v.public_key);
    byKey.set(v.fee_claim_public_key, list);
  }
  return [...byKey.entries()].map(([claimPublicKeyHex, validatorPublicKeys]) => ({ claimPublicKeyHex, validatorPublicKeys }));
}
