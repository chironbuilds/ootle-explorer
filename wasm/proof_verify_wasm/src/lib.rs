//! In-browser verification of an indexer-supplied substate proof, using the same code the indexer
//! itself runs (`CommittedBlockProof::validate` + `verify_substate_value_proof_against_root`).

use std::collections::HashSet;

use base64::Engine as _;
use ootle_network::Network;
use serde::Serialize;
use tari_common_types::types::FixedHash;
use tari_engine_types::{
    SubstateVersion,
    substate::{SubstateId, SubstateValue},
};
use tari_ootle_common_types::{Epoch, VotePower};
use tari_ootle_storage::{
    consensus_models::{CommittedBlockProof, EpochCheckpoint},
    state_store::verify_substate_value_proof_against_root,
};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Default)]
struct Report {
    /// Commit proof decoded and its QC chain carries a quorum of the supplied committee.
    commit_ok: bool,
    commit_error: Option<String>,
    committee_size: usize,
    quorum_threshold: u64,
    /// Value proof binds the supplied substate value to the quorum-signed state root.
    value_ok: bool,
    value_error: Option<String>,
    epoch: Option<u64>,
    height: Option<u64>,
    block_id: Option<String>,
    state_merkle_root: Option<String>,
}

/// `committee_hex`: hex public keys of the shard group committee at the proof's epoch (1 vote each).
/// `value_json`: the substate value exactly as the indexer served it (`substate` field).
#[wasm_bindgen]
pub fn verify_proof(
    substate_id: &str,
    version: u32,
    value_json: &str,
    commit_proof_b64: &str,
    value_proof_b64: &str,
    network_byte: u8,
    value_hash_epoch: u64,
    committee_hex: Vec<String>,
) -> Result<JsValue, JsValue> {
    let report = run(
        substate_id,
        version,
        value_json,
        commit_proof_b64,
        value_proof_b64,
        network_byte,
        value_hash_epoch,
        committee_hex,
    );
    serde_wasm_json(&report)
}

fn serde_wasm_json(r: &Report) -> Result<JsValue, JsValue> {
    let s = serde_json::to_string(r).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(JsValue::from_str(&s))
}

#[allow(clippy::too_many_arguments)]
fn run(
    substate_id: &str,
    version: u32,
    value_json: &str,
    commit_proof_b64: &str,
    value_proof_b64: &str,
    network_byte: u8,
    value_hash_epoch: u64,
    committee_hex: Vec<String>,
) -> Report {
    let mut report = Report::default();
    let b64 = base64::engine::general_purpose::STANDARD;

    let commit_bytes = match b64.decode(commit_proof_b64) {
        Ok(b) => b,
        Err(e) => {
            report.commit_error = Some(format!("commit proof is not valid base64: {e}"));
            return report;
        },
    };
    let commit_proof = match CommittedBlockProof::from_bytes(&commit_bytes) {
        Ok(p) => p,
        Err(e) => {
            report.commit_error = Some(e.to_string());
            return report;
        },
    };
    report.epoch = Some(commit_proof.epoch().as_u64());
    report.height = Some(commit_proof.height().as_u64());
    report.block_id = Some(hex::encode(commit_proof.block_id().as_slice()));
    report.state_merkle_root = Some(hex::encode(commit_proof.state_merkle_root().as_slice()));

    let committee: HashSet<Vec<u8>> = committee_hex.iter().filter_map(|h| hex::decode(h).ok()).collect();
    let n = committee.len() as u64;
    // Same rule as CommitteeInfo::quorum_threshold: n - f, where f = (n - 1) / 3.
    let threshold = if n == 0 { 0 } else { n - (n - 1) / 3 };
    report.committee_size = committee.len();
    report.quorum_threshold = threshold;

    let tip = commit_proof.validate(VotePower::of(threshold), |pk| {
        Ok(if committee.contains(pk.as_slice()) {
            VotePower::of(1)
        } else {
            VotePower::zero()
        })
    });
    let tip = match tip {
        Ok(t) => {
            report.commit_ok = true;
            t
        },
        Err(e) => {
            report.commit_error = Some(e.to_string());
            return report;
        },
    };

    let id: SubstateId = match substate_id.parse() {
        Ok(i) => i,
        Err(e) => {
            report.value_error = Some(format!("bad substate id: {e}"));
            return report;
        },
    };
    let value: SubstateValue = match serde_json::from_str(value_json) {
        Ok(v) => v,
        Err(e) => {
            report.value_error = Some(format!("could not read the substate value: {e}"));
            return report;
        },
    };
    let network = match Network::try_from(network_byte) {
        Ok(n) => n,
        Err(e) => {
            report.value_error = Some(format!("unknown network: {e}"));
            return report;
        },
    };
    let value_bytes = match b64.decode(value_proof_b64) {
        Ok(b) => b,
        Err(e) => {
            report.value_error = Some(format!("value proof is not valid base64: {e}"));
            return report;
        },
    };
    let root: FixedHash = tip.state_merkle_root;
    match verify_substate_value_proof_against_root(
        &value_bytes,
        &id,
        SubstateVersion::from(u64::from(version)),
        Some(&value),
        network,
        Epoch(value_hash_epoch),
        tip.epoch,
        root,
    ) {
        Ok(()) => report.value_ok = true,
        Err(e) => report.value_error = Some(e.to_string()),
    }
    report
}

#[derive(Serialize, Default)]
struct CheckpointReport {
    ok: bool,
    error: Option<String>,
    committee_size: usize,
    quorum_threshold: u64,
    epoch: Option<u64>,
    height: Option<u64>,
    state_merkle_root: Option<String>,
}

/// Validates an epoch checkpoint exactly as validators do when syncing (`EpochCheckpoint::validate`):
/// the end-of-epoch command is in the block, the QCs carry a quorum of the committee, the 3-chain rule
/// holds, and the shard roots hash to the header's state merkle root. `checkpoint_json` is the
/// indexer's `checkpoint` object verbatim.
#[wasm_bindgen]
pub fn verify_checkpoint(checkpoint_json: &str, committee_hex: Vec<String>) -> Result<JsValue, JsValue> {
    let mut report = CheckpointReport::default();
    let committee: HashSet<Vec<u8>> = committee_hex.iter().filter_map(|h| hex::decode(h).ok()).collect();
    let n = committee.len() as u64;
    let threshold = if n == 0 { 0 } else { n - (n - 1) / 3 };
    report.committee_size = committee.len();
    report.quorum_threshold = threshold;

    match serde_json::from_str::<EpochCheckpoint>(checkpoint_json) {
        Err(e) => report.error = Some(format!("could not read the checkpoint: {e}")),
        Ok(cp) => {
            report.epoch = Some(cp.epoch().as_u64());
            report.height = Some(cp.header().height);
            report.state_merkle_root = Some(hex::encode(cp.header().state_merkle_root.as_slice()));
            match cp.validate(cp.epoch(), VotePower::of(threshold), |pk| {
                Ok(if committee.contains(pk.as_slice()) {
                    VotePower::of(1)
                } else {
                    VotePower::zero()
                })
            }) {
                Ok(()) => report.ok = true,
                Err(e) => report.error = Some(e.to_string()),
            }
        },
    }
    let s = serde_json::to_string(&report).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(JsValue::from_str(&s))
}
