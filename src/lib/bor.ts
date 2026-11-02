// Decoders for the engine values the indexer serves as base64 CBOR from Ootle 0.48 on (substate
// values, execution results, receipts, events, resources, UTXOs). Earlier indexers returned the same
// values as serde JSON, so every helper here passes a non-string through untouched -- the explorer
// reads both formats with no branching at the call sites.
//
// The decoder is `@tari-project/ootle-wasm-bor` (vendored in ./borWasm, see SOURCE.json for the exact
// version). It is vendored rather than installed because the package's own entry point is a
// bundler-target `import * as wasm from "./x.wasm"`, which Vite would need a plugin for; this loads
// the module the same way verifyProof.ts loads its wasm instead.
import wasmUrl from "./borWasm/ootle_wasm_bor_bg.wasm?url";
import * as bg from "./borWasm/ootle_wasm_bor_bg.js";

let ready: Promise<void> | null = null;

function init(): Promise<void> {
  ready ??= (async () => {
    const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl), { "./ootle_wasm_bor_bg.js": bg });
    bg.__wbg_set_wasm(instance.exports);
    (instance.exports.__wbindgen_start as () => void)();
  })().catch((e) => {
    ready = null; // let a later call retry instead of caching the failure forever
    throw e;
  });
  return ready;
}

type Decoder = (encoded: string) => string;

async function decodeWith<T>(decoder: Decoder, value: unknown): Promise<T> {
  if (typeof value !== "string") return value as T;
  await init();
  return JSON.parse(decoder(value)) as T;
}

export const decodeSubstateValue = <T = unknown>(v: unknown) => decodeWith<T>(bg.decodeSubstateValue, v);
export const decodeExecuteResult = <T = unknown>(v: unknown) => decodeWith<T>(bg.decodeExecuteResult, v);
export const decodeTransactionReceipt = <T = unknown>(v: unknown) => decodeWith<T>(bg.decodeTransactionReceipt, v);
export const decodeEvent = <T = unknown>(v: unknown) => decodeWith<T>(bg.decodeEvent, v);
export const decodeResource = <T = unknown>(v: unknown) => decodeWith<T>(bg.decodeResource, v);
export const decodeUtxo = <T = unknown>(v: unknown) => decodeWith<T>(bg.decodeUtxo, v);
