// Renders a CardModel to a 1200x630 PNG: satori lays the card out as SVG, resvg rasterizes it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { CardModel } from "./data.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const font = (file: string) => readFileSync(path.join(dir, "fonts", file));

const FONTS = [
  { name: "Plex Sans", data: font("ibm-plex-sans-latin-400-normal.woff"), weight: 400 as const, style: "normal" as const },
  { name: "Plex Sans", data: font("ibm-plex-sans-latin-600-normal.woff"), weight: 600 as const, style: "normal" as const },
  { name: "Plex Sans", data: font("ibm-plex-sans-latin-700-normal.woff"), weight: 700 as const, style: "normal" as const },
  { name: "Plex Mono", data: font("ibm-plex-mono-latin-500-normal.woff"), weight: 500 as const, style: "normal" as const },
];

const FLAME = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 30"><defs>
<linearGradient id="o" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#b3120a"/><stop offset=".55" stop-color="#f2461a"/><stop offset="1" stop-color="#ff8a1f"/></linearGradient>
<linearGradient id="m" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7a12"/><stop offset="1" stop-color="#ffc233"/></linearGradient>
<linearGradient id="c" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#fffbe0"/></linearGradient></defs>
<path fill="url(#o)" d="M12 0.5C12.4 5 16 7.6 18.6 11.6C21.4 15.8 21.6 21.4 18 25.6C16.2 27.7 14.1 28.8 12 28.8C9.9 28.8 7.8 27.7 6 25.6C2.4 21.4 2.6 15.8 5.4 11.6C6.6 9.8 7.7 10.2 8.4 11.6C9.2 8.2 10.9 4.6 12 0.5Z"/>
<path fill="url(#m)" d="M12 10C12.3 13.2 15 15.2 16.4 18C17.8 20.8 17.4 24 15.6 26C14.6 27.1 13.3 27.8 12 27.8C10.7 27.8 9.4 27.1 8.4 26C6.6 24 6.2 20.8 7.6 18C8.5 16.2 9.2 15.4 9.6 13.8C10.4 12.6 11.4 11.6 12 10Z"/>
<path fill="url(#c)" d="M12 17.6C12.2 19.6 14.2 21.2 14.2 23.8C14.2 26 13.2 27.3 12 27.3C10.8 27.3 9.8 26 9.8 23.8C9.8 21.2 11.8 19.6 12 17.6Z"/></svg>`;
const TICK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#1d9bf0"/><path d="M4.8 8.2l2 2 4.4-4.8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const TONES: Record<CardModel["badges"][number]["tone"], { bg: string; fg: string }> = {
  good: { bg: "rgba(76,195,138,0.14)", fg: "#4cc38a" },
  bad: { bg: "rgba(224,99,122,0.14)", fg: "#e0637a" },
  neutral: { bg: "rgba(154,161,172,0.14)", fg: "#9aa1ac" },
  accent: { bg: "rgba(53,201,176,0.14)", fg: "#35c9b0" },
  burn: { bg: "rgba(255,122,18,0.16)", fg: "#ff9a3c" },
  veil: { bg: "rgba(155,138,251,0.16)", fg: "#9b8afb" },
  reveal: { bg: "rgba(228,185,121,0.14)", fg: "#e4b979" },
};

type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown; [k: string]: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

function badge(b: CardModel["badges"][number]): Node {
  const t = TONES[b.tone];
  const kids: unknown[] = [];
  if (b.tone === "burn") kids.push(h("img", { width: 22, height: 28, marginRight: 10 }, undefined, { src: dataUri(FLAME), width: 22, height: 28 }));
  kids.push(b.text);
  return h(
    "div",
    { display: "flex", alignItems: "center", padding: "10px 22px", borderRadius: 999, background: t.bg, color: t.fg, fontSize: 26, fontWeight: 600 },
    kids,
  );
}

/** Headline size steps down with length so a long summary still fits on the card. */
function titleSize(title: string): number {
  if (title.length <= 36) return 76;
  if (title.length <= 64) return 62;
  if (title.length <= 100) return 50;
  return 42;
}

export async function renderCard(model: CardModel): Promise<Buffer> {
  const title = model.title.length > 150 ? `${model.title.slice(0, 147)}…` : model.title;
  const tree = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      width: 1200,
      height: 630,
      padding: "56px 72px",
      background: "#0b0d10",
      backgroundImage: "radial-gradient(circle at 92% 8%, rgba(255,110,20,0.20), rgba(11,13,16,0) 45%), radial-gradient(circle at 0% 0%, rgba(53,201,176,0.14), rgba(11,13,16,0) 40%)",
      color: "#e9ebee",
      fontFamily: "Plex Sans",
    },
    [
      h("div", { display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700, color: "#35c9b0" }, [
        h("div", { width: 14, height: 14, borderRadius: 7, background: "#35c9b0", marginRight: 14 }),
        "Veil",
        h("div", { color: "#5b6270", fontWeight: 400, marginLeft: 14 }, "Tari Ootle explorer"),
      ]),
      h("div", { display: "flex", flexDirection: "column" }, [
        model.badges.length
          ? h("div", { display: "flex", marginBottom: 28 }, model.badges.map((b, i) => h("div", { display: "flex", marginRight: i === model.badges.length - 1 ? 0 : 14 }, [badge(b)])))
          : h("div", { display: "flex" }),
        h("div", { display: "flex", fontSize: titleSize(title), fontWeight: 700, lineHeight: 1.12, letterSpacing: -1 }, title),
        model.verifiedLabel
          ? h("div", { display: "flex", alignItems: "center", marginTop: 26, fontSize: 30, fontWeight: 600, color: "#35c9b0" }, [
              h("img", { marginRight: 12 }, undefined, { src: dataUri(TICK), width: 34, height: 34 }),
              `${model.verifiedLabel} · verified on Veil`,
            ])
          : h("div", { display: "flex", marginTop: 26, fontSize: 30, color: "#9aa1ac" }, model.subtitle),
      ]),
      h("div", { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28, color: "#5b6270" }, [
        h("div", { display: "flex", fontFamily: "Plex Mono", fontWeight: 500 }, model.ident),
        h("div", { display: "flex" }, "explorer.tari.mw"),
      ]),
    ],
  );

  const svg = await satori(tree as never, { width: 1200, height: 630, fonts: FONTS });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng());
}
