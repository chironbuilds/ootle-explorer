import { getNetworkInfo, listValidators, type SubstateProof } from "./indexer";

export interface ProofVerification {
  commitOk: boolean;
  commitError: string | null;
  committeeSize: number;
  quorumThreshold: number;
  valueOk: boolean;
  valueError: string | null;
  epoch: number | null;
  height: number | null;
  blockId: string | null;
  stateMerkleRoot: string | null;
}

interface RawReport {
  commit_ok: boolean;
  commit_error: string | null;
  committee_size: number;
  quorum_threshold: number;
  value_ok: boolean;
  value_error: string | null;
  epoch: number | null;
  height: number | null;
  block_id: string | null;
  state_merkle_root: string | null;
}

/** Checks a substate proof in the browser with the same Rust code the indexer runs (compiled to
 * WebAssembly from tari-ootle v0.45.0, loaded only when this is called -- it's ~600 KB):
 *   1. the commit proof's quorum certificates carry a quorum of the shard group's committee, which
 *      makes `state_merkle_root` a root the committee signed; and
 *   2. the substate value, re-hashed here, is the leaf the value proof places under that root.
 * The committee's public keys come from the indexer's `/validators` list, so this proves the proof is
 * sound and signed by those keys -- not that the indexer's committee list is itself honest. */
export async function verifySubstateProof(
  substateId: string,
  version: number,
  substate: unknown,
  proof: SubstateProof,
): Promise<ProofVerification> {
  const [wasm, network, validators] = await Promise.all([
    import("./proofWasm/proof_verify_wasm.js"),
    getNetworkInfo(),
    listValidators(500),
  ]);
  await wasm.default();

  const { anchor } = proof;
  const committee = validators.validators
    .filter(
      (v) =>
        v.shard_group.start === anchor.shard_group.start &&
        v.shard_group.end_inclusive === anchor.shard_group.end_inclusive &&
        v.start_epoch <= anchor.epoch &&
        (v.end_epoch === null || v.end_epoch >= anchor.epoch),
    )
    .map((v) => v.public_key);

  const raw = JSON.parse(
    wasm.verify_proof(
      substateId,
      version,
      JSON.stringify(substate),
      proof.commit_proof,
      proof.value_proof,
      network.network_byte,
      BigInt(proof.value_hash_epoch),
      committee,
    ),
  ) as RawReport;

  return {
    commitOk: raw.commit_ok,
    commitError: raw.commit_error,
    committeeSize: raw.committee_size,
    quorumThreshold: raw.quorum_threshold,
    valueOk: raw.value_ok,
    valueError: raw.value_error,
    epoch: raw.epoch,
    height: raw.height,
    blockId: raw.block_id,
    stateMerkleRoot: raw.state_merkle_root,
  };
}
