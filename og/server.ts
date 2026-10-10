// Link-preview service for Veil. nginx sends link-unfurling crawlers (Twitterbot and friends) for
// /tx/* and /substate/* to /unfurl/..., which returns a page of <meta> tags pointing at /og/....png.
// Everyone else gets the normal single-page app and never touches this service.
import http from "node:http";
import { renderCard } from "./card.js";
import { genericModel, substateModel, txModel, type CardModel } from "./data.js";

const PORT = Number(process.env.PORT ?? 8793);
const HOST = process.env.HOST ?? "127.0.0.1";
const ORIGIN = process.env.PUBLIC_ORIGIN ?? "https://explorer.tari.mw";

const TX_RE = /^[0-9a-f]{64}$/i;
// Substate ids are `<kind>_<hex...>` (NFT ids carry extra segments); only these characters, bounded.
const SUBSTATE_RE = /^(component|resource|vault|nft|utxo|coutput|txreceipt|template_receipt)_[A-Za-z0-9_]{8,200}$/;

const MODEL_TTL_MS = 10 * 60_000;
const MAX_CACHE = 300;
const MAX_CONCURRENT_RENDERS = 2;

class TtlCache<V> {
  private readonly map = new Map<string, { value: V; expires: number }>();
  constructor(private readonly ttl: number) {}
  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key: string, value: V) {
    if (this.map.size >= MAX_CACHE) this.map.delete(this.map.keys().next().value as string);
    this.map.set(key, { value, expires: Date.now() + this.ttl });
  }
}

const models = new TtlCache<CardModel>(MODEL_TTL_MS);
const images = new TtlCache<Buffer>(MODEL_TTL_MS);
let activeRenders = 0;

async function modelFor(kind: "tx" | "substate", id: string): Promise<CardModel> {
  const key = `${kind}:${id}`;
  const cached = models.get(key);
  if (cached) return cached;
  const model = kind === "tx" ? await txModel(id) : await substateModel(id);
  models.set(key, model);
  return model;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function unfurlHtml(pagePath: string, imagePath: string, model: CardModel): string {
  const title = `${model.title} · Veil`;
  const url = `${ORIGIN}${pagePath}`;
  const image = `${ORIGIN}${imagePath}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(model.description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Veil">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(model.description)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(model.description)}"><meta name="twitter:image" content="${esc(image)}">
</head><body><p><a href="${esc(url)}">${esc(title)}</a></p></body></html>`;
}

/** Splits `/tx/<id>` or `/substate/<id>` (with an optional trailing `.png`) into a validated kind and id. */
function parse(rest: string): { kind: "tx" | "substate"; id: string } | null {
  const m = /^\/(tx|substate)\/([^/]+?)(?:\.png)?$/.exec(rest);
  if (!m) return null;
  const kind = m[1] as "tx" | "substate";
  let id: string;
  try {
    id = decodeURIComponent(m[2]!);
  } catch {
    return null;
  }
  const ok = kind === "tx" ? TX_RE.test(id) : SUBSTATE_RE.test(id);
  return ok ? { kind, id } : null;
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (pathname === "/healthz") return void res.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');
  if (req.method !== "GET" && req.method !== "HEAD") return void res.writeHead(405).end();

  if (pathname.startsWith("/unfurl/")) {
    const target = parse(pathname.slice("/unfurl".length));
    const rest = pathname.slice("/unfurl".length);
    const model = target ? await modelFor(target.kind, target.id) : genericModel();
    const imagePath = target ? `/og/${target.kind}/${encodeURIComponent(target.id)}.png` : "/og/default.png";
    // `private` + `Vary`: this HTML is only for crawlers, so a shared cache (Cloudflare) must never hand it to a person
    // who opens the same URL -- they get the single-page app.
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=300", Vary: "User-Agent" });
    return void res.end(unfurlHtml(target ? rest : "/", imagePath, model));
  }

  if (pathname.startsWith("/og/")) {
    const rest = pathname.slice("/og".length);
    const target = rest === "/default.png" ? null : parse(rest);
    if (rest !== "/default.png" && !target) return void res.writeHead(404).end();
    const key = target ? `${target.kind}:${target.id}` : "default";
    let png = images.get(key);
    if (!png) {
      if (activeRenders >= MAX_CONCURRENT_RENDERS) return void res.writeHead(503, { "Retry-After": "2" }).end();
      activeRenders++;
      try {
        const model = target ? await modelFor(target.kind, target.id) : genericModel();
        png = await renderCard(model);
        images.set(key, png);
      } finally {
        activeRenders--;
      }
    }
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=600", "Content-Length": png.length });
    return void res.end(req.method === "HEAD" ? undefined : png);
  }

  res.writeHead(404, { "Content-Type": "application/json" }).end('{"error":"Not found"}');
}

http
  .createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      console.error("veil-og error:", err instanceof Error ? err.message : err);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
      res.end('{"error":"Internal error"}');
    });
  })
  .listen(PORT, HOST, () => console.log(`veil-og listening on http://${HOST}:${PORT}`));
