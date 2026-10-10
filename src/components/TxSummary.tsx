import { Link } from "react-router-dom";
import { formatMicroTari } from "../lib/format";
import { summarizeTransaction, TARI_RESOURCE, type SummaryPart } from "../lib/txSummary";
import { shortHash } from "../lib/useDocumentTitle";
import type { TxBody } from "../lib/txShape";
import { TemplateNameTag } from "./TemplateNameTag";
import { Card } from "./ui";

/** `component_2e91…6029` -- keeps the kind prefix, which the generic 8-character shortener would eat. */
function shortAddress(id: string): string {
  return id.replace(/^((?:[a-z_]+_)?)([0-9a-f]{4})[0-9a-f]{8,}([0-9a-f]{4})$/i, "$1$2…$3");
}

function Part({ part }: { part: SummaryPart }) {
  if (part.kind === "text") return <>{part.text}</>;
  if (part.kind === "amount") {
    // Only TARI's divisibility is known without a lookup; anything else is shown in raw units.
    return part.resource === TARI_RESOURCE ? (
      <strong className="tabular font-semibold text-ink">{formatMicroTari(part.raw)} tTARI</strong>
    ) : (
      <strong className="tabular font-semibold text-ink" title="Raw units: this resource's decimals aren't known here">
        {part.raw} units{part.resource ? ` of ${shortHash(part.resource)}` : ""}
      </strong>
    );
  }
  const to = /^[0-9a-f]{64}$/i.test(part.id) ? `/template/${part.id}` : `/substate/${part.id}`;
  return (
    <>
      <Link to={to} className="font-mono text-[0.95em] text-accent hover:text-accent-strong">
        {shortAddress(part.id)}
      </Link>
      <span className="ml-1.5 inline-block align-middle">
        <TemplateNameTag address={part.id} />
      </span>
    </>
  );
}

/** A plain-language account of what the transaction does, built mechanically from its instructions. */
export function TxSummary({ body }: { body: TxBody }) {
  const lines = summarizeTransaction(body);
  if (lines.length === 0) return null;
  return (
    <Card className="mb-8 px-5 py-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-faint">What this transaction does</p>
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="text-[15px] leading-relaxed text-ink-dim">
            {line.map((part, j) => (
              <Part key={j} part={part} />
            ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}
