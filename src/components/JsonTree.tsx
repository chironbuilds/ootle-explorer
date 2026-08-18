import { useState } from "react";
import { Hash } from "./Hash";
import { linkForId } from "../lib/links";

const IDLIKE = /^(component|resource|vault|nft|utxo|template|txreceipt)_[0-9a-f_]+$/i;
// Bare (unprefixed) 64-hex values are ambiguous -- a public key, mask, commitment, signature, or
// content hash is exactly as hex-shaped as a transaction id, and far more common in this data. Only
// treat one as a transaction id when its own JSON key says so, never from shape alone.
const TX_REF_KEY = /^(transaction_id|transaction_hash|last_id|tx_id)$/i;

function isSubstateId(value: string): boolean {
  return IDLIKE.test(value);
}

function Primitive({ label, value }: { label?: string; value: string | number | boolean | null }) {
  if (value === null) return <span className="text-ink-faint">null</span>;
  if (typeof value === "boolean") return <span className="text-veil">{String(value)}</span>;
  if (typeof value === "number") return <span className="tabular text-reveal">{value}</span>;
  if (typeof value === "string") {
    if (isSubstateId(value)) return <Hash value={value} />;
    if (label && TX_REF_KEY.test(label) && linkForId(value) !== null) return <Hash value={value} />;
    if (/^\d+$/.test(value) && value.length > 4) return <span className="tabular text-reveal">"{value}"</span>;
    return <span className="text-ink">"{value}"</span>;
  }
  return null;
}

function Node({ label, value, depth }: { label?: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 2);

  if (value === null || typeof value !== "object") {
    return (
      <div className="py-0.5 pl-4" style={{ marginLeft: depth === 0 ? 0 : 12 }}>
        {label !== undefined && <span className="text-ink-dim">{label}: </span>}
        <Primitive label={label} value={value as string | number | boolean | null} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
  const empty = entries.length === 0;
  const summary = isArray ? `Array(${entries.length})` : `Object(${entries.length})`;

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 12 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={empty}
        className="flex items-center gap-1 py-0.5 text-left disabled:cursor-default"
      >
        {!empty && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}>
            <path d="M3 1.5l4 3.5-4 3.5" stroke="var(--ink-faint)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {empty && <span className="w-[9px]" />}
        {label !== undefined && <span className="text-ink-dim">{label}: </span>}
        <span className="text-ink-faint text-xs">{empty ? (isArray ? "[]" : "{}") : summary}</span>
      </button>
      {open && !empty && (
        <div className="border-l border-border-soft pl-2">
          {entries.map(([k, v]) => (
            <Node key={k} label={isArray ? undefined : k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Generic collapsible renderer for Ootle's raw instruction/event/substate JSON -- the enum space
 * (instruction variants, substate value shapes, event payloads) is large and evolving, so this
 * renders any of it structurally instead of requiring an exhaustive type for each variant.
 * Recognizes substate-id-shaped and 64-hex strings and links them to their detail page. */
export function JsonTree({ data }: { data: unknown }) {
  return (
    <div className="font-mono text-[13px] leading-relaxed">
      <Node value={data} depth={0} />
    </div>
  );
}
