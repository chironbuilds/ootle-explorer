// Node-side twin of src/lib/bor.ts: decodes the base64 CBOR engine values the Ootle 0.48 indexer
// serves, so the link-preview cards read the same fields they did when it served serde JSON. A
// non-string passes through untouched, so an older indexer still works.
//
// The vendored decoder lives in src/lib/borWasm. The deployed bundle has no src/, so deploy-og.sh
// copies it to ./bor next to this file; in a repo checkout it falls back to the source directory.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const HERE = new URL(".", import.meta.url);
const DIR = existsSync(new URL("bor/ootle_wasm_bor_bg.wasm", HERE)) ? new URL("bor/", HERE) : new URL("../src/lib/borWasm/", HERE);

interface Bg {
  __wbg_set_wasm(exports: WebAssembly.Exports): void;
  decodeSubstateValue(encoded: string): string;
  decodeTransactionReceipt(encoded: string): string;
}

let ready: Promise<Bg> | null = null;

function init(): Promise<Bg> {
  ready ??= (async () => {
    const bg = (await import(new URL("ootle_wasm_bor_bg.js", DIR).href)) as Bg;
    const { instance } = await WebAssembly.instantiate(await readFile(new URL("ootle_wasm_bor_bg.wasm", DIR)), {
      "./ootle_wasm_bor_bg.js": bg as unknown as WebAssembly.ModuleImports,
    });
    bg.__wbg_set_wasm(instance.exports);
    (instance.exports.__wbindgen_start as () => void)();
    return bg;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

async function decodeWith(pick: (bg: Bg) => (encoded: string) => string, value: unknown): Promise<unknown> {
  if (typeof value !== "string") return value;
  const bg = await init();
  return JSON.parse(pick(bg)(value));
}

export const decodeSubstateValue = (v: unknown) => decodeWith((bg) => bg.decodeSubstateValue, v);
export const decodeTransactionReceipt = (v: unknown) => decodeWith((bg) => bg.decodeTransactionReceipt, v);
