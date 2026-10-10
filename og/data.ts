// Fetches what a link-preview card needs from the public indexer and reduces it to plain strings.
// Everything here is read-only and resolves to a small "card model"; failures resolve to a generic
// fallback model so a crawler always gets a valid preview rather than an error page.
import { formatMicroTari } from "../src/lib/format.js";
import { getKnownAddress } from "../src/lib/knownAddresses.js";
import { calledComponents, claimsBurn, isStealthTransaction, readTxBody } from "../src/lib/txShape.js";
import { summarizeTransaction, TARI_RESOURCE, type SummaryPart } from "../src/lib/txSummary.js";

const INDEXER = process.env.INDEXER_URL ?? "https://ootle-indexer-a.tari.com";
const TIMEOUT_MS = 8_000;
const ACCOUNT_TEMPLATE = "0".repeat(64);

export interface CardModel {
  kind: "tx" | "substate" | "generic";
  /** Large headline text. */
  title: string;
  /** Smaller line under the headline. */
  subtitle: string;
  /** Short monospace identifier shown at the foot of the card. */
  ident: string;
  /** Pills shown above the headline. */
  badges: Array<{ text: string; tone: "good" | "bad" | "neutral" | "accent" | "burn" | "veil" | "reveal" }>;
  /** A verified-project label to show with the blue tick, when the subject is on the known list. */
  verifiedLabel?: string;
  /** Text for the page `<meta>` description. */
  description: string;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${INDEXER}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export function shortId(id: string): string {
  return id.replace(/^((?:[a-z_]+_)?)([0-9a-f]{4,6})[0-9a-f]{8,}([0-9a-f]{4,6})$/i, "$1$2…$3");
}

interface SubstateLike {
  substate?: { Component?: { header?: { template_address?: string } } };
}

/** Label for an address: the known-list name, else the name of the template it was created from, else a short id. */
async function labelFor(id: string, cache: Map<string, string>): Promise<{ label: string; verified: boolean }> {
  const known = getKnownAddress(id);
  if (known) return { label: known.label, verified: known.category === "community" };
  const isTemplate = /^[0-9a-f]{64}$/i.test(id);
  let templateAddress: string | undefined = isTemplate ? id : undefined;
  if (!isTemplate && id.startsWith("component_")) {
    const sub = await getJson<SubstateLike>(`/substates/${encodeURIComponent(id)}`);
    templateAddress = sub?.substate?.Component?.header?.template_address;
  }
  if (!templateAddress) return { label: shortId(id), verified: false };
  // Every ordinary wallet is an instance of the builtin Account template -- call it what it is, and
  // keep the "verified on Veil" claim for community projects rather than for plain accounts.
  if (templateAddress === ACCOUNT_TEMPLATE) return { label: "an account", verified: false };
  const tplKnown = getKnownAddress(templateAddress);
  if (tplKnown) return { label: tplKnown.label, verified: tplKnown.category === "community" };
  const cached = cache.get(templateAddress);
  if (cached) return { label: cached, verified: false };
  const tpl = await getJson<{ name?: string }>(`/templates/${templateAddress}`);
  const name = tpl?.name;
  if (name) cache.set(templateAddress, name);
  return { label: name ?? shortId(id), verified: false };
}

async function partsToText(parts: SummaryPart[], names: Map<string, string>): Promise<{ text: string; verified?: string }> {
  let text = "";
  let verified: string | undefined;
  for (const part of parts) {
    if (part.kind === "text") text += part.text;
    else if (part.kind === "amount") {
      text += part.resource === TARI_RESOURCE ? `${formatMicroTari(part.raw)} tTARI` : `${part.raw} units`;
    } else {
      const { label, verified: v } = await labelFor(part.id, names);
      text += label;
      if (v && !verified) verified = label;
    }
  }
  return { text, verified };
}

export function genericModel(): CardModel {
  return {
    kind: "generic",
    title: "Tari Ootle, laid bare.",
    subtitle: "Live transactions, substates and templates, including which transfers stay confidential.",
    ident: "explorer.tari.mw",
    badges: [],
    description: "Veil: an explorer for the Tari Ootle layer 2.",
  };
}

interface TxResponse {
  transaction?: { transaction?: unknown; summary?: { outcome?: string } | null };
}

export async function txModel(id: string): Promise<CardModel> {
  const res = await getJson<TxResponse>(`/transactions/${id}`);
  const tx = res?.transaction;
  if (!tx) {
    return { ...genericModel(), kind: "tx", title: "Transaction", ident: shortId(id), subtitle: "Open it on Veil to see the details." };
  }
  const body = readTxBody(tx.transaction);
  const names = new Map<string, string>();

  // Outcome: the receipt is the authoritative record and outlives the live result.
  const receipt = await getJson<{ receipt?: { outcome?: string } }>(`/transaction-receipts/${id}`);
  const outcome = tx.summary?.outcome ?? receipt?.receipt?.outcome ?? null;

  // Burn: an explicit claim, or a call into a component whose template is flagged as a burn target.
  let burn = claimsBurn(body);
  if (!burn) {
    for (const component of calledComponents(body).slice(0, 4)) {
      const sub = await getJson<SubstateLike>(`/substates/${encodeURIComponent(component)}`);
      const template = sub?.substate?.Component?.header?.template_address;
      if (template && getKnownAddress(template)?.burn) {
        burn = true;
        break;
      }
    }
  }

  const lines = summarizeTransaction(body);
  let title = `Transaction ${shortId(id)}`;
  let verifiedLabel: string | undefined;
  if (lines.length > 0) {
    const first = await partsToText(lines[0]!, names);
    title = first.text;
    verifiedLabel = first.verified;
    if (lines.length > 1) title += ` (+${lines.length - 1} more)`;
  }

  const badges: CardModel["badges"] = [];
  if (outcome === "Commit") badges.push({ text: "Committed", tone: "good" });
  else if (outcome) badges.push({ text: outcome === "Reject" ? "Rejected" : outcome, tone: "bad" });
  if (burn) badges.push({ text: "Burn", tone: "burn" });
  badges.push(isStealthTransaction(body) ? { text: "Veiled", tone: "veil" } : { text: "Revealed", tone: "reveal" });

  return {
    kind: "tx",
    title,
    subtitle: "Tari Ootle transaction",
    ident: shortId(id),
    badges,
    verifiedLabel,
    description: `${title}. ${outcome === "Commit" ? "Committed" : (outcome ?? "Transaction")} on the Tari Ootle layer 2, viewed on Veil.`,
  };
}

const KIND_LABEL: Record<string, string> = {
  component: "Component",
  resource: "Resource",
  vault: "Vault",
  nft: "NFT",
  utxo: "UTXO",
  coutput: "Confidential output",
  txreceipt: "Transaction receipt",
  template_receipt: "Template receipt",
};

export async function substateModel(id: string): Promise<CardModel> {
  const kind = id.split("_")[0] ?? "";
  const kindLabel = KIND_LABEL[kind] ?? "Substate";
  const sub = await getJson<{ verified?: boolean } & SubstateLike & { substate?: { Resource?: { metadata?: Record<string, string> } } }>(
    `/substates/${encodeURIComponent(id)}`,
  );
  if (!sub) {
    return { ...genericModel(), kind: "substate", title: kindLabel, ident: shortId(id), subtitle: "Open it on Veil to see the details." };
  }
  const names = new Map<string, string>();
  const { label, verified } = await labelFor(id, names);
  const symbol = sub.substate?.Resource?.metadata?.SYMBOL;

  const badges: CardModel["badges"] = [{ text: kindLabel, tone: "accent" }];
  badges.push(sub.verified ? { text: "Committee-verified", tone: "reveal" } : { text: "Unverified", tone: "neutral" });

  const named = symbol ?? (label === shortId(id) ? null : label);
  return {
    kind: "substate",
    title: named ? `${kindLabel}: ${named}` : kindLabel,
    subtitle: "Tari Ootle substate",
    ident: shortId(id),
    badges,
    verifiedLabel: verified ? label : undefined,
    description: `${named ? `${kindLabel} ${named}` : kindLabel} on the Tari Ootle layer 2, viewed on Veil.`,
  };
}
