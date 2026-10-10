# proof_verify_wasm

Exports `verify_proof` (substate and transaction-receipt proofs) and `verify_checkpoint` (epoch checkpoints).

Source of the WebAssembly module in `src/lib/proofWasm/` that powers the "Verify proof" button on the
substate page. It wraps the indexer's own verification code from
[tari-ootle](https://github.com/tari-project/tari-ootle) so the browser runs the same checks.

Built from tari-ootle **v0.45.0** (the version the live indexer reports):

1. Extract the v0.45.0 source and drop this directory in as `crates/proof_verify_wasm`, adding it to the
   workspace `members` in the root `Cargo.toml`.
2. In `crates/storage/src/lib.rs` change `mod state_store;` to `pub mod state_store;` (the verifier
   function is not otherwise exported).
3. `cd crates/proof_verify_wasm && wasm-pack build --release --target web`
4. Copy the generated `proof_verify_wasm*.{js,d.ts,wasm}` files into `src/lib/proofWasm/`.

Rebuild against the matching tag whenever the indexer's protocol version changes.
