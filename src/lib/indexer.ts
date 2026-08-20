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
  return handleResponse<T>(res);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(path.replace(/^\//, ""), INDEXER_URL + "/");
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

async function handleResponse<T>(res: Response): Promise<T> {
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

// ---- Epoch checkpoints ----

// The response also carries a `shard_tree_summary` -- a root hash + state version per shard
// (256 of them for this network) -- which isn't modeled here since nothing renders it; only the
// checkpoint header and the quorum certificates that committed it are narrowly typed below.
export interface QuorumCertificate {
  decision: string;
  signatures: { public_key: string }[];
}

export interface EpochCheckpointResponse {
  checkpoint: {
    proof: {
      V1: {
        commit_proof: {
          header: {
            epoch: number;
            height: number;
            state_merkle_root: string;
            proposed_by: string;
            shard_group: { start: number; end_inclusive: number };
          };
          proof_elements: { QuorumCertificate: QuorumCertificate }[];
        };
      };
    };
  };
}

export const getLatestEpochCheckpoint = () => get<EpochCheckpointResponse>("/epoch-checkpoints/latest");

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

/** `lastId` is a cursor, not an offset -- the indexer's `ListRecentTransactionsRequest` only
 * accepts `limit`/`last_id` (no numeric offset), so paging forward means passing the last
 * transaction id of the previous page. */
export const listRecentTransactions = (limit = 25, lastId?: string) =>
  get<RecentTransactionsResponse>("/transactions/recent", { limit, last_id: lastId });

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
  // True only when this value was checked against the committee before being accepted -- false for
  // local-only lookups, when verification is disabled, or when no committee member could supply a
  // proof yet (e.g. nothing committed since an epoch change). See the indexer's own
  // `/substates/{id}` handler doc comment (rest_api/handlers/substates.rs) for this exact wording --
  // it does NOT mean "freshly re-proven for this request": Ootle can satisfy the check from a
  // previously-trusted committee state root rather than re-running a fresh proof every time.
  verified?: boolean;
  [key: string]: unknown;
}

export const getSubstate = (id: string, version?: number) =>
  get<SubstateResponse>(`/substates/${encodeURIComponent(id)}`, version !== undefined ? { version } : undefined);

// POST since it takes a body, not because it mutates anything -- fetches up to 20 substates in one
// round trip instead of one request each. Each entry has the same {substate, version} shape as a
// single `/substates/{id}` fetch, but the batch endpoint never reports `verified` per item, so this
// isn't a substitute for `getSubstate` wherever that status is shown.
export interface FetchSubstatesResponse {
  substates: Record<string, { substate: unknown; version: number }>;
}

// The handler enforces a hard cap of 20 ids per request despite the request type declaring 50 --
// confirmed live (a 21st id gets rejected), so callers with more ids than that must chunk.
export const MAX_BATCH_SUBSTATES = 20;

export const fetchSubstates = (ids: string[]) =>
  post<FetchSubstatesResponse>("/substates/fetch", { requests: ids, cached_only: false });

/** Dedupes and pages through {@link fetchSubstates} in {@link MAX_BATCH_SUBSTATES}-sized batches so
 * callers can pass an arbitrarily long id list without hand-rolling chunking. For the common case
 * (a component's handful of held vaults/resources) this is a single request. */
export async function fetchSubstatesChunked(ids: string[]): Promise<FetchSubstatesResponse["substates"]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += MAX_BATCH_SUBSTATES) chunks.push(unique.slice(i, i + MAX_BATCH_SUBSTATES));
  const results = await Promise.all(chunks.map((chunk) => fetchSubstates(chunk)));
  return Object.assign({}, ...results.map((r) => r.substates));
}

// The raw substate value shapes `fetchSubstatesChunked` returns for vaults/resources -- the same
// envelope `/substates/{id}` itself returns, distinct from the specialized `/resources/{address}`
// response shape (`ResourceResponse`) which flattens `resource.*` up a level.
export type RawVaultSubstate = VaultSubstateResponse["substate"];
export interface RawResourceSubstate {
  Resource: ResourceResponse["resource"];
}

// A vault's held value is one of four shapes (`ResourceContainer` in tari-ootle's
// `crates/engine_types/src/resource_container.rs`). Only `Fungible.amount` is a complete, exact
// balance; `Confidential`/`Stealth` publish `revealed_amount` only -- the vault may hold additional
// value hidden in commitments that no explorer can see. `NonFungible` holds token ids, not an amount.
export type ResourceContainer =
  | { Fungible: { address: string; amount: string; locked_amount: string } }
  | { NonFungible: { address: string; token_ids: unknown[]; locked_token_ids: unknown[] } }
  | { Confidential: { address: string; revealed_amount: string; locked_revealed_amount: string } }
  | { Stealth: { address: string; revealed_amount: string; locked_amount: string } };

export interface VaultSubstateResponse {
  version: number;
  substate: { Vault: { resource_container: ResourceContainer; freeze_flags: number } };
}

export const getVault = (id: string) => get<VaultSubstateResponse>(`/substates/${encodeURIComponent(id)}`);

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

// A template's function signature ("ABI"). `arg_type`/`output` are a recursive tagged shape:
// a bare string for a builtin (`"U8"`, `"Unit"`, ...), `{Other:{name}}` for a named type,
// `{Option:T}`/`{Vec:T}` wrapping another shape -- see `templateAbi.ts`'s `formatArgType`.
export interface TemplateFunctionArg {
  name: string;
  arg_type: unknown;
}

export interface TemplateFunction {
  name: string;
  arguments: TemplateFunctionArg[];
  output: unknown;
  is_mut: boolean;
}

export interface TemplateDetailResponse {
  name: string;
  definition?: { V1?: { template_name: string; abi_version: number; functions: TemplateFunction[] } };
}

export const getTemplate = (address: string) => get<TemplateDetailResponse>(`/templates/${encodeURIComponent(address)}`);

// ---- Transaction events ----

export interface TransactionEvent {
  substate_id: string | null;
  template_address: string;
  topic: string;
  payload: Record<string, unknown>;
}

export interface QueryTransactionEventsResponse {
  events: Array<[string, TransactionEvent]>;
}

// ---- Transaction receipts ----

// A transaction's own `txreceipt_<id>` substate -- unlike `/transactions/{id}/result`, which the
// indexer only caches for a limited time, a receipt is a permanent on-chain substate, so it's a
// reliable events fallback once the live result cache has expired. `diff_summary.upped` only
// gives created substates as `{substate_id, version, value_hash}` (a hash, not the full value) and
// carries no destroyed-substate list at all -- see `TransactionReceipt`/`DiffSummary` in
// tari-ootle's engine_types crate -- so this can recover events fully but not a full substate diff.
export interface TransactionReceiptResponse {
  receipt: {
    outcome: string;
    diff_summary: { upped: { substate_id: string; version: number; value_hash: string }[] };
    events: TransactionEvent[];
  };
}

export const getTransactionReceipt = (id: string) => get<TransactionReceiptResponse>(`/transaction-receipts/${encodeURIComponent(id)}`);

/** `resource_address` matches an event either by substate id (std.resource.* events, e.g. mint/burn,
 * where the resource itself is the event's subject) or by a `resource_address` field in the payload
 * (std.vault.deposit/withdraw, where a vault moved that resource) -- see the indexer's own
 * `QueryTransactionEventsRequest` doc. `substate_id` is the more general, exact-match filter it also
 * accepts -- any substate (component, vault, ...) as the event's own subject, e.g.
 * `std.component.created`/`updated` plus whatever custom events a component's own template emits.
 * Unlike `/transactions/recent`, `offset` here is a real, confirmed-working offset, not a no-op. */
export const queryTransactionEvents = (params: {
  resourceAddress?: string;
  substateId?: string;
  topic?: string;
  limit?: number;
  offset?: number;
}) =>
  get<QueryTransactionEventsResponse>("/transactions/events", {
    resource_address: params.resourceAddress,
    substate_id: params.substateId,
    topic: params.topic,
    limit: params.limit ?? 25,
    offset: params.offset ?? 0,
  });

// ---- Transaction receipts ----

export const listTransactionReceipts = (limit = 25) => get<unknown>("/transaction-receipts", { limit });
