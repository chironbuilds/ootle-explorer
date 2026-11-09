// Veil is built once per network (.env for Esmeralda, .env.mainnet for mainnet); nothing switches at runtime.
const env = import.meta.env;

export const NETWORK = env.VITE_NETWORK as "mainnet" | "esmeralda";
export const INDEXER_URL = env.VITE_INDEXER_URL as string;
export const TICKER = env.VITE_TICKER as string;
export const PUBLIC_ORIGIN = env.VITE_PUBLIC_ORIGIN as string;
export const OTHER_EXPLORER = { url: env.VITE_OTHER_EXPLORER_URL as string, label: env.VITE_OTHER_EXPLORER_LABEL as string };
// False while explorer.tari.mw still serves the testnet build: the "other" explorer would be this page.
export const HAS_OTHER_EXPLORER = OTHER_EXPLORER.url !== location.origin;
