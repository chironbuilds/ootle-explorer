// Client for the public Ootle indexer's REST API. Every path here was confirmed live against
// https://ootle-indexer-a.tari.com (network "esmeralda") -- see @tari-project/indexer-client's
// IndexerClient for the canonical route table this mirrors.
//
// Deeply nested, variant-heavy shapes (instructions, events, substate diffs, substate values)
// are intentionally left as `unknown` and rendered with a generic JSON tree (see
// components/JsonTree.tsx) rather than exhaustively modeled -- Ootle's instruction/substate enum
// space is large and still evolving, and a generic viewer is also just how explorers usually
// present raw call data.

export const INDEXER_URL = import.meta.env.VITE_INDEXER_URL ?? "https://ootle-indexer-a.tari.com";

export class IndexerError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(path.replace(/^\//, ""), INDEXER_URL + "/");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new IndexerError((body && (body.error ?? body.message)) || `HTTP ${res.status}`, res.status);
  }
  if (body && typeof body === "object" && "error" in body) {
    throw new IndexerError(String((body as { error: unknown }).error));
  }
  return body as T;
}

// ---- Network ----

export interface NetworkInfo {
  network: string;
  network_byte: number;
  epoch: number;
}

export interface NetworkEconomics {
  current_epoch: number;
  total_claimed: string;
  total_exhaust_burned: string;
  fee_volume: string;
  receipt_exhaust_burned: string;
  total_supply: string;
  transaction_receipt_count: number;
  target_burn_rate_bps: number;
}

export interface IdentityInfo {
  peer_id: string;
  public_key: string;
  public_addresses: string[];
}

export const getNetworkInfo = () => get<NetworkInfo>("/network");
export const getNetworkEconomics = () => get<NetworkEconomics>("/network/economics");
export const getIdentity = () => get<IdentityInfo>("/identity");

// ---- Validators ----

export interface Validator {
  public_key: string;
  peer_id: string;
  shard_group: { start: number; end_inclusive: number };
  start_epoch: number;
  end_epoch: number | null;
  fee_claim_public_key: string;
  vote_power: number;
}

export interface ValidatorsResponse {
  epoch: number;
  validators: Validator[];
}

export const listValidators = (limit = 50) => get<ValidatorsResponse>("/validators", { limit });

// ---- Transactions ----

export type TransactionOutcome = "Commit" | "Reject" | "Abort" | "Unknown" | string;

export interface RecentTransactionSummary {
  transaction_id: string;
  transaction: unknown;
  created_at?: string;
  summary?: {
    outcome?: TransactionOutcome;
    total_fees_paid?: number;
    finalized_at?: string | null;
  } | null;
  rejected_reason?: string | null;
}

export interface RecentTransactionsResponse {
  transactions: RecentTransactionSummary[];
}

export const listRecentTransactions = (limit = 25, offset = 0) =>
  get<RecentTransactionsResponse>("/transactions/recent", { limit, offset });

export interface TransactionDetailResponse {
  transaction: RecentTransactionSummary;
}

export const getTransaction = (id: string) => get<TransactionDetailResponse>(`/transactions/${encodeURIComponent(id)}`);

export interface TransactionResultResponse {
  result?: unknown;
  error?: string;
}

export const getTransactionResult = (id: string) => get<TransactionResultResponse>(`/transactions/${encodeURIComponent(id)}/result`);

// ---- Substates ----

export interface SubstateResponse {
  value?: unknown;
  substate?: unknown;
  address?: unknown;
  version?: number;
  [key: string]: unknown;
}

export const getSubstate = (id: string, version?: number) =>
  get<SubstateResponse>(`/substates/${encodeURIComponent(id)}`, version !== undefined ? { version } : undefined);

// ---- Resources ----

export interface ResourceResponse {
  resource: {
    resource_type: string;
    owner_rule: string;
    access_rules: Record<string, string>;
    metadata: Record<string, string>;
    total_supply: string | null;
    view_key: string | null;
    auth_hook: unknown;
    divisibility: number;
  };
  version: number;
  total_supply: string | null;
}

export const getResource = (address: string) => get<ResourceResponse>(`/resources/${encodeURIComponent(address)}`);
export const getTariResource = () => get<ResourceResponse>("/resources/tari");

// ---- Templates ----

export interface CachedTemplate {
  name: string;
  address: string;
  binary_sha: string;
  author_public_key: string;
  code_size: number;
  epoch: number;
}

export interface CachedTemplatesResponse {
  templates: CachedTemplate[];
}

export const listCachedTemplates = (limit = 50) => get<CachedTemplatesResponse>("/templates/cached", { limit });
export const getTemplate = (address: string) => get<unknown>(`/templates/${encodeURIComponent(address)}`);

// ---- Transaction receipts ----

export const listTransactionReceipts = (limit = 25) => get<unknown>("/transaction-receipts", { limit });
