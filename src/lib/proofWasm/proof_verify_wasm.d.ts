/* tslint:disable */
/* eslint-disable */

/**
 * Decodes a base64 CBOR epoch checkpoint (Ootle 0.48+) to the JSON shape earlier indexers served.
 */
export function decode_checkpoint(checkpoint_b64: string): string;

/**
 * Validates an epoch checkpoint exactly as validators do when syncing (`EpochCheckpoint::validate`):
 * the end-of-epoch command is in the block, the QCs carry a quorum of the committee, the 3-chain rule
 * holds, and the shard roots hash to the header's state merkle root. `checkpoint_json` is the
 * indexer's `checkpoint` field verbatim: base64 CBOR from Ootle 0.48, a JSON object before.
 */
export function verify_checkpoint(checkpoint_json: string, network_byte: number, committee_hex: string[]): any;

/**
 * `committee_hex`: hex public keys of the shard group committee at the proof's epoch (1 vote each).
 * `value_json`: the substate value exactly as the indexer served it (`substate` field): base64 CBOR
 * from Ootle 0.48, serde JSON before.
 */
export function verify_proof(substate_id: string, version: number, value_json: string, commit_proof_b64: string, value_proof_b64: string, network_byte: number, value_hash_epoch: bigint, committee_hex: string[]): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly decode_checkpoint: (a: number, b: number) => [number, number, number, number];
    readonly verify_checkpoint: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly verify_proof: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: bigint, l: number, m: number) => [number, number, number];
    readonly tari_free: (a: number) => void;
    readonly tari_alloc: (a: number) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
