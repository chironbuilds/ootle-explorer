// Derives a component (account) substate address from an `otl_...` bech32m wallet address, so the
// explorer can accept the address form people actually hand each other, not just raw substate ids.
//
// The wallet address bech32m-encodes `account_key (32 bytes) || view_only_key (32 bytes) || optional
// pay_ref` under a network-specific HRP ("otl_" mainnet, "otl_esm_" Esmeralda, ...) -- see
// `OotleAddress::decode_bech32`/`encode_bech32_to_fmt` in tari-ootle's
// `crates/ootle_address/src/ootle_address.rs`. The network itself is carried entirely by the HRP
// choice, not a payload byte -- decoding only needs "starts with otl_", not an exact network match,
// since the derivation below is network-agnostic anyway.
//
// The resulting on-chain component address is `derive_component_address_from_public_key`
// (`crates/engine_types/src/component.rs`): Blake2b-256 of a domain-separation tag, the builtin
// Account template's address (32 zero bytes), and the account key -- ported byte-for-byte from
// `tari-wallet-extension/src/lib/componentAddress.ts`'s `deriveAccountComponentAddress`, already
// verified there against tari-ootle's own committed golden vectors.
import { bech32m } from "bech32";
import { blake2b } from "@noble/hashes/blake2.js";
import { concatBytes, utf8ToBytes } from "@noble/hashes/utils.js";

const PUBLIC_KEY_BYTES = 32;
// bech32m's default 90-char limit is a Bitcoin-address convention, not part of the checksum
// algorithm itself -- Tari's addresses run to ~118 chars (two 32-byte keys, longer with a pay ref).
const MAX_BECH32M_LENGTH = 300;

function deriveComponentAddress(templateAddress: Uint8Array, publicKey: Uint8Array): string {
  const tag = utf8ToBytes("com.tari.ootle.engine.v0.ComponentAddress");
  const digest = blake2b(concatBytes(u64le(tag.length), tag, templateAddress, u32le(publicKey.length), publicKey), { dkLen: 32 });
  return `component_${bytesToHex(digest)}`;
}

const ACCOUNT_TEMPLATE_ADDRESS = new Uint8Array(32);

/** Returns the `component_<hex>` address for an `otl_...` wallet address's account key, or null if
 * `value` isn't a valid Ootle bech32m address at all. */
export function componentAddressFromOtlAddress(value: string): string | null {
  if (!value.startsWith("otl_")) return null;
  try {
    const { words } = bech32m.decode(value, MAX_BECH32M_LENGTH);
    const bytes = new Uint8Array(bech32m.fromWords(words));
    if (bytes.length < PUBLIC_KEY_BYTES * 2) return null;
    const accountKey = bytes.slice(0, PUBLIC_KEY_BYTES);
    return deriveComponentAddress(ACCOUNT_TEMPLATE_ADDRESS, accountKey);
  } catch {
    return null;
  }
}

function u32le(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

function u64le(n: number): Uint8Array {
  const b = new Uint8Array(8);
  let v = BigInt(n);
  for (let i = 0; i < 8; i++) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return b;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}
