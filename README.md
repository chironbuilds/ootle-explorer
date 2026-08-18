# Veil — Tari Ootle Explorer

A block explorer for [Tari Ootle](https://github.com/tari-project/tari-ootle) (Tari's layer 2) — live transactions, substates (components, resources, vaults, non-fungibles, stealth UTXOs), templates, and validators, read straight from a public Ootle indexer.

Ootle's transfers can be confidential (stealth, Pedersen-commitment-based) or plainly revealed on-chain. Veil surfaces that distinction directly — every transaction and instruction shows whether it's **veiled** (confidential) or **revealed** (cleartext) — rather than leaving it implicit in raw JSON.

## Stack

- [Vite](https://vitejs.dev/) + React + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) (CSS-first `@theme` config, no `tailwind.config.js`)
- [TanStack Query](https://tanstack.com/query) for data fetching/caching/polling
- [React Router](https://reactrouter.com/) for client-side routing
- No backend — a pure client-side SPA. The public indexer's REST API already sends permissive CORS headers, so the browser talks to it directly.

## Data source

Reads live from the public Ootle indexer at `https://ootle-indexer-a.tari.com` (network `esmeralda`), via the REST routes documented in [`@tari-project/indexer-client`](https://www.npmjs.com/package/@tari-project/indexer-client). Override the endpoint with `VITE_INDEXER_URL` if you're running your own indexer locally.

Deeply nested, variant-heavy fields (transaction instructions, events, substate values) are rendered with a generic collapsible JSON tree (`src/components/JsonTree.tsx`) rather than exhaustively typed — Ootle's instruction/substate enum space is large and still evolving, and that's also just how most explorers present raw call data.

## Development

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
npm run preview  # preview the production build locally
```

## Independent project

Not affiliated with or endorsed by the Tari Project. Reads public data only; never asks for or handles private keys, seed phrases, or wallet credentials.
