//! In-browser verification of an indexer-supplied substate proof, using the same code the indexer
//! itself runs (`CommittedBlockProof::validate` + `verify_substate_value_proof_against_root`).

use std::collections::BTreeMap;

use base64::Engine as _;
use ootle_network::Network;
use serde::Serialize;
use tari_engine_types::{
    SubstateVersion,
    encoded::Encoded,
    substate::{SubstateId, SubstateValue},
};
use tari_ootle_common_types::{Epoch, NumPreshards, VotePower};
use tari_ootle_storage::{
    consensus_models::{CommittedBlockProof, EpochCheckpoint},
    state_store::{TrustedStateRoot, verify_substate_value_proof_against_root},
};
use tari_sidechain::SigningCommittee;

/// A committee of the supplied public keys and their vote power.
struct Committee(Vec<(Vec<u8>, u64)>);

impl Committee {
    /// `powers` runs parallel to `keys`; Ootle 0.50 weights votes by each validator's power.
    fn new(keys: &[String], powers: &[u32]) -> Self {
        // QC signer bitmaps index the committee in ascending key order, and the verifier insists on it.
        let members: BTreeMap<Vec<u8>, u64> = keys
            .iter()
            .zip(powers)
            .filter_map(|(h, p)| hex::decode(h).ok().map(|k| (k, u64::from(*p))))
            .collect();
        Self(members.into_iter().collect())
    }

    /// Same rule as `quorum_threshold_of`: n - f over total vote power, where f = (n - 1) / 3.
    fn threshold(&self) -> u64 {
        let n: u64 = self.0.iter().map(|(_, p)| *p).sum();
        n.saturating_sub(n.saturating_sub(1) / 3)
    }
}

impl SigningCommittee for Committee {
    fn len(&self) -> usize {
        self.0.len()
    }

    fn member(&self, index: usize) -> Option<(&[u8], u64)> {
        self.0.get(index).map(|(k, p)| (k.as_slice(), *p))
    }
}

/// The substate value as the indexer served it: base64 CBOR (Ootle 0.48+), or serde JSON (earlier).
fn parse_value(value: &str) -> Result<SubstateValue, String> {
    let trimmed = value.trim();
    if !trimmed.starts_with('{') && !trimmed.starts_with('"') {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(trimmed)
            .map_err(|e| format!("substate value is not valid base64: {e}"))?;
        // The engine's own CBOR codec (`tari_bor::Decode`), as the indexer encoded it.
        return Encoded::<SubstateValue>::from_bytes(bytes).decode().map_err(|e| e.to_string());
    }
    serde_json::from_str(trimmed).map_err(|e| e.to_string())
}
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

/// `committee_hex`, `committee_power`: hex public keys of the shard group committee at the proof's
/// epoch, and each one's vote power.
/// `value_json`: the substate value exactly as the indexer served it (`substate` field): base64 CBOR
/// from Ootle 0.48, serde JSON before.
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
    committee_power: Vec<u32>,
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
        committee_power,
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
    committee_power: Vec<u32>,
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

    let network = match Network::try_from(network_byte) {
        Ok(n) => n,
        Err(e) => {
            report.commit_error = Some(format!("unknown network: {e}"));
            return report;
        },
    };
    let committee = Committee::new(&committee_hex, &committee_power);
    let threshold = committee.threshold();
    report.committee_size = committee.len();
    report.quorum_threshold = threshold;

    let tip = commit_proof.validate(network, VotePower::of(threshold), &committee);
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
    let value = match parse_value(value_json) {
        Ok(v) => v,
        Err(e) => {
            report.value_error = Some(format!("could not read the substate value: {e}"));
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
    let root = TrustedStateRoot::from(tip);
    match verify_substate_value_proof_against_root(
        &value_bytes,
        &id,
        SubstateVersion::from(u64::from(version)),
        Some(&value),
        network,
        NumPreshards::P256,
        Epoch(value_hash_epoch),
        &root,
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
/// indexer's `checkpoint` field verbatim: base64 CBOR from Ootle 0.48, a JSON object before.
#[wasm_bindgen]
pub fn verify_checkpoint(
    checkpoint_json: &str,
    network_byte: u8,
    committee_hex: Vec<String>,
    committee_power: Vec<u32>,
) -> Result<JsValue, JsValue> {
    let mut report = CheckpointReport::default();
    let committee = Committee::new(&committee_hex, &committee_power);
    let threshold = committee.threshold();
    report.committee_size = committee.len();
    report.quorum_threshold = threshold;
    let Ok(network) = Network::try_from(network_byte) else {
        report.error = Some(format!("unknown network byte {network_byte}"));
        let s = serde_json::to_string(&report).map_err(|e| JsValue::from_str(&e.to_string()))?;
        return Ok(JsValue::from_str(&s));
    };

    match parse_checkpoint(checkpoint_json) {
        Err(e) => report.error = Some(format!("could not read the checkpoint: {e}")),
        Ok(cp) => {
            report.epoch = Some(cp.epoch().as_u64());
            report.height = Some(cp.header().height);
            report.state_merkle_root = Some(hex::encode(cp.header().state_merkle_root.as_slice()));
            match cp.validate(network, cp.epoch(), VotePower::of(threshold), &committee) {
                Ok(()) => report.ok = true,
                Err(e) => report.error = Some(e.to_string()),
            }
        },
    }
    let s = serde_json::to_string(&report).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(JsValue::from_str(&s))
}

/// The checkpoint as the indexer served it: base64 CBOR (Ootle 0.48+), or a serde JSON object (earlier).
fn parse_checkpoint(checkpoint: &str) -> Result<EpochCheckpoint, String> {
    let trimmed = checkpoint.trim().trim_matches('"');
    if checkpoint.trim().starts_with('{') {
        return serde_json::from_str(checkpoint).map_err(|e| e.to_string());
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(trimmed)
        .map_err(|e| format!("checkpoint is not valid base64: {e}"))?;
    Encoded::<EpochCheckpoint>::from_bytes(bytes).decode().map_err(|e| e.to_string())
}

/// Decodes a base64 CBOR epoch checkpoint (Ootle 0.48+) to the JSON shape earlier indexers served.
#[wasm_bindgen]
pub fn decode_checkpoint(checkpoint_b64: &str) -> Result<String, JsValue> {
    let cp = parse_checkpoint(checkpoint_b64).map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&cp).map_err(|e| JsValue::from_str(&e.to_string()))
}
