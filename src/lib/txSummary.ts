import type { TxBody } from "./txShape";

/** One piece of a summary sentence. Rendering is left to the component (links, badges, amounts). */
export type SummaryPart =
  | { kind: "text"; text: string }
  | { kind: "address"; id: string }
  | { kind: "amount"; raw: string; resource: string | null };

export type SummaryLine = SummaryPart[];

/** The builtin TARI resource -- the only one whose divisibility and symbol are known without a lookup. */
export const TARI_RESOURCE = "resource_0101010101010101010101010101010101010101010101010101010101010101";

const text = (t: string): SummaryPart => ({ kind: "text", text: t });
const address = (id: string): SummaryPart => ({ kind: "address", id });

interface Held {
  resource: string | null;
  /** Raw (smallest-unit) amount when known; null when the whole bucket was passed along. */
  amount: string | null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function addressOf(ref: unknown): string | null {
  const a = asRecord(ref)?.Address;
  return typeof a === "string" ? a : null;
}

function workspaceId(ref: unknown): number | null {
  const w = asRecord(ref)?.Workspace;
  if (typeof w === "number") return w;
  const id = asRecord(w)?.id;
  return typeof id === "number" ? id : null;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Reads the two CBOR shapes that matter for a literal call argument: an unsigned integer (an amount)
 * and a tagged 32-byte string (an address, as `{Literal: "d883 5820 <32 bytes>"}` for a resource).
 * Anything else returns null -- a literal this doesn't understand is simply left out of the sentence. */
function readLiteral(hex: unknown): { kind: "uint"; value: string } | { kind: "resource"; id: string } | null {
  if (typeof hex !== "string") return null;
  const b = hexToBytes(hex);
  if (!b || b.length === 0) return null;
  const major = b[0]! >> 5;
  const info = b[0]! & 0x1f;
  if (major === 0) {
    if (info < 24) return b.length === 1 ? { kind: "uint", value: String(info) } : null;
    const width = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : 0;
    if (!width || b.length !== 1 + width) return null;
    let v = 0n;
    for (let i = 0; i < width; i++) v = (v << 8n) | BigInt(b[1 + i]!);
    return { kind: "uint", value: v.toString() };
  }
  // Tag (major 6) with a 1-byte tag number, then a 32-byte byte string: d8 <tag> 58 20 <32 bytes>.
  if (b[0] === 0xd8 && b.length === 2 + 2 + 32 && b[2] === 0x58 && b[3] === 0x20) {
    const hexBody = Array.from(b.slice(4), (x) => x.toString(16).padStart(2, "0")).join("");
    return { kind: "resource", id: `resource_${hexBody}` };
  }
  return null;
}

function literalOf(arg: unknown) {
  return readLiteral(asRecord(arg)?.Literal);
}

function bucketId(ref: unknown): number | null {
  const id = asRecord(ref)?.id;
  return typeof id === "number" ? id : null;
}

/**
 * Turns a transaction's instructions into plain sentences. Purely mechanical: it only states what the
 * instructions say (which component was called, which bucket of which resource moved, what amount),
 * tracking buckets through the workspace so "deposit(bucket)" can name the amount and resource that
 * went in. Anything it doesn't recognise falls back to an exact "Called <method> on <component>"
 * rather than a guess, and the raw instruction list stays on the page for checking.
 */
export function summarizeTransaction(body: TxBody): SummaryLine[] {
  const lines: SummaryLine[] = [];
  const buckets = new Map<number, Held>();
  let lastOutput: Held | null = null;

  const all: Array<{ ins: unknown; fee: boolean }> = [
    ...body.feeInstructions.map((ins) => ({ ins, fee: true })),
    ...body.instructions.map((ins) => ({ ins, fee: false })),
  ];

  for (const { ins, fee } of all) {
    const entry = asRecord(ins) ? Object.entries(ins as Record<string, unknown>)[0] : null;
    if (!entry) continue;
    const [variant, raw] = entry;
    const b = asRecord(raw) ?? {};

    switch (variant) {
      case "StealthTransfer": {
        const resource = addressOf(b.resource_address_ref);
        lastOutput = { resource, amount: null };
        // In the fee section a stealth transfer only funds the buckets used below, so its effect is told
        // by the sentences that spend them; elsewhere it is the transaction's headline action.
        if (!fee) {
          const revealed = asRecord(asRecord(asRecord(b.statement)?.outputs_statement)?.revealed_output);
          const amount = revealed && revealed.amount !== undefined ? String(revealed.amount) : "0";
          const receiver = typeof revealed?.receiver === "string" ? revealed.receiver : null;
          if (amount !== "0" && receiver) {
            lines.push([text("Transferred "), { kind: "amount", raw: amount, resource }, text(" (revealed) to "), address(receiver)]);
          } else {
            lines.push([text("Made a confidential transfer, amounts hidden")]);
          }
        }
        break;
      }
      case "PutLastInstructionOutputOnWorkspace": {
        const key = typeof b.key === "number" ? b.key : null;
        if (key !== null && lastOutput) buckets.set(key, lastOutput);
        break;
      }
      case "TakeFromBucket": {
        const from = bucketId(b.input_bucket);
        const out = typeof b.output_bucket === "number" ? b.output_bucket : null;
        const source = from !== null ? buckets.get(from) : undefined;
        if (out !== null) buckets.set(out, { resource: source?.resource ?? null, amount: b.amount !== undefined ? String(b.amount) : null });
        break;
      }
      case "CreateAccount": {
        const owner = typeof b.owner_public_key === "string" ? b.owner_public_key : null;
        lines.push(owner ? [text("Created an account owned by "), address(owner)] : [text("Created an account")]);
        break;
      }
      case "ClaimBurn": {
        lines.push([text("Claimed a burn from the base layer")]);
        break;
      }
      case "PayFeeFromBucket":
      case "PayFee":
        // Fees are shown in the fee breakdown; keeping them out keeps the headline about what the sender did.
        break;
      case "CallMethod": {
        const target = addressOf(b.call);
        const method = String(b.method ?? "?");
        const args = Array.isArray(b.args) ? b.args : [];
        let sent: Held | null = null;
        for (const arg of args) {
          const ws = workspaceId(arg);
          const held = ws !== null ? buckets.get(ws) : undefined;
          if (held) {
            sent = held;
            break;
          }
        }
        if (!target) {
          // The target is a workspace value (e.g. a freshly created account) -- name only the method.
          if (method !== "pay_fee") lines.push([text(`Called ${method}`)]);
          break;
        }
        if (method === "pay_fee") break;
        const lits = args.map(literalOf);
        const litResource = lits.find((l) => l?.kind === "resource");
        const litAmount = lits.find((l) => l?.kind === "uint");
        if (method === "withdraw" && litAmount?.kind === "uint") {
          lines.push([
            text("Withdrew "),
            { kind: "amount", raw: litAmount.value, resource: litResource?.kind === "resource" ? litResource.id : null },
            text(" from "),
            address(target),
          ]);
        } else if (method === "deposit" && sent?.amount) {
          lines.push([text("Deposited "), { kind: "amount", raw: sent.amount, resource: sent.resource }, text(" into "), address(target)]);
        } else if (method === "deposit") {
          lines.push([text("Deposited funds into "), address(target)]);
        } else if (sent?.amount) {
          lines.push([text(`Called ${method} on `), address(target), text(" with "), { kind: "amount", raw: sent.amount, resource: sent.resource }]);
        } else {
          lines.push([text(`Called ${method} on `), address(target)]);
        }
        break;
      }
      case "CallFunction": {
        const template = typeof b.address === "string" ? b.address : typeof b.template_address === "string" ? b.template_address : null;
        const fn = String(b.function ?? "?");
        lines.push(template ? [text(`Called ${fn} on template `), address(template)] : [text(`Called ${fn}`)]);
        break;
      }
      default:
        break;
    }
  }
  return lines;
}
