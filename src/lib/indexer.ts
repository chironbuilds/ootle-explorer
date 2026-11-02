// Client for the public Ootle indexer's REST API. Every path here was confirmed live against
// https://ootle-indexer-a.tari.com (network "esmeralda") -- see @tari-project/indexer-client's
// IndexerClient for the canonical route table this mirrors.
//
// Deeply nested, variant-heavy shapes (instructions, events, substate diffs, substate values)
// are intentionally left as `unknown` and rendered with a generic JSON tree (see
// components/JsonTree.tsx) rather than exhaustively modeled -- Ootle's instruction/substate enum
// space is large and still evolving, and a generic viewer is also just how explorers usually
// present raw call data.

import { decodeEvent, decodeExecuteResult, decodeResource, decodeSubstateValue, decodeTransactionReceipt } from "./bor";

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
  /** Before Ootle 0.48: one entry per signer. From 0.48: a bitmap (hex, least significant bit first)
   * over the committee sorted by public key, beside the signatures it selects. */
  signatures: { public_key: string }[] | { Schnorr: { signers: string; signatures: unknown[] } };
}

export interface EpochCheckpointResponse {
  checkpoint: {
    // Versioned like `TemplateDetailResponse.definition`; modeled optional so a future non-V1 proof
    // degrades to "no checkpoint shown" instead of crashing, the same failure mode `proof_elements`
    // hit above.
    proof?: {
      V1?: {
        commit_proof: {
          header: {
            epoch: number;
            height: number;
            state_merkle_root: string;
            proposed_by: string;
            shard_group: { start: number; end_inclusive: number };
          };
          // Other proof-element kinds exist (e.g. ChainLinks) alongside QuorumCertificate; only the
          // latter is rendered here, so it's modeled as optionally present rather than enumerating
          // every variant.
          proof_elements: { QuorumCertificate?: QuorumCertificate }[];
        };
      };
    };
  };
}

/** From Ootle 0.48 `checkpoint.checkpoint` is the whole `EpochCheckpoint` as base64 CBOR (beside a
 * few summary fields) instead of the checkpoint object itself. It is decoded with the proof verifier's
 * wasm, the only module here that knows the type, and the encoded form kept in `raw` for verification. */
export async function getLatestEpochCheckpoint(): Promise<EpochCheckpointResponse & { raw?: string }> {
  const data = await get<{ checkpoint: EpochCheckpointResponse["checkpoint"] & { checkpoint?: unknown } }>("/epoch-checkpoints/latest");
  const encoded = data.checkpoint?.checkpoint;
  if (typeof encoded !== "string") return data;
  const wasm = await import("./proofWasm/proof_verify_wasm.js");
  await wasm.default();
  return { checkpoint: JSON.parse(wasm.decode_checkpoint(encoded)), raw: encoded };
}

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

// From Ootle 0.48 `Finalized.execution_result` is a base64 CBOR `ExecuteResult` (it was serde JSON).
// Decoded back to the old shape here so transactionOutcome.ts and the transaction page read either.
async function normalizeResult(data: TransactionResultResponse): Promise<TransactionResultResponse> {
  const finalized = (data.result as { Finalized?: { execution_result?: unknown } } | undefined)?.Finalized;
  if (typeof finalized?.execution_result !== "string") return data;
  return { ...data, result: { ...(data.result as object), Finalized: { ...finalized, execution_result: await decodeExecuteResult(finalized.execution_result) } } };
}

export const getTransactionResult = (id: string) =>
  get<TransactionResultResponse>(`/transactions/${encodeURIComponent(id)}/result`).then(normalizeResult);

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
  /** The value exactly as the indexer served it (base64 CBOR from Ootle 0.48), kept so a proof can
   * be checked against the bytes the committee hashed rather than a JSON round trip of them. */
  raw_substate?: unknown;
  [key: string]: unknown;
}

// The proof an indexer verified a substate with (only returned when `include_proof` is set, and only
// by an indexer with proof verification on). `commit_proof` and `value_proof` are base64 CBOR blobs
// for an independent verifier; the anchor is the plain-JSON summary read out of the commit proof.
export interface SubstateProof {
  anchor: {
    epoch: number;
    shard_group: { start: number; end_inclusive: number };
    height: number;
    block_id: string;
    state_merkle_root: string;
  };
  commit_proof: string;
  value_proof: string;
  value_hash_epoch: number;
}

// Ootle 0.47 nests a substate's value + version under `state.up` (a current/up substate) or
// `state.down` (a consumed one), where earlier releases returned `{ substate, version }` at the top
// level. Flatten the new shape back to the fields every reader here already expects, so both the
// pre- and post-0.47 indexer responses render identically.
// From Ootle 0.48 the value itself (`state.up.substate`) is a base64 CBOR `SubstateValue` instead of
// serde JSON; `decodeSubstateValue` passes the old JSON form through untouched.
async function normalizeSubstate<T extends SubstateResponse>(data: T): Promise<T> {
  const state = (data as { state?: { up?: { substate?: unknown; version?: number }; down?: { substate?: unknown; version?: number } } }).state;
  const entry = state?.up ?? state?.down;
  if (entry && data.substate === undefined) {
    return { ...data, substate: await decodeSubstateValue(entry.substate), raw_substate: entry.substate, version: data.version ?? entry.version };
  }
  return data;
}

export const getSubstateWithProof = (id: string) =>
  get<SubstateResponse & { proof?: SubstateProof }>(`/substates/${encodeURIComponent(id)}`, { include_proof: "true" }).then(normalizeSubstate);

export const getSubstate = (id: string, version?: number) =>
  get<SubstateResponse>(`/substates/${encodeURIComponent(id)}`, version !== undefined ? { version } : undefined).then(normalizeSubstate);

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

// From Ootle 0.48 each entry is `{ version, value }` with `value` a base64 CBOR `SubstateValue`;
// earlier indexers sent `{ substate, version }`. Both are folded into the old shape here.
export const fetchSubstates = (ids: string[]) =>
  post<{ substates: Record<string, { substate?: unknown; value?: unknown; version: number }> }>("/substates/fetch", {
    requests: ids,
    cached_only: false,
  }).then(async (res): Promise<FetchSubstatesResponse> => {
    const entries = await Promise.all(
      Object.entries(res.substates).map(async ([id, e]) => [id, { substate: await decodeSubstateValue(e.value ?? e.substate), version: e.version }] as const),
    );
    return { substates: Object.fromEntries(entries) };
  });

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

export const getVault = (id: string) => get<VaultSubstateResponse & SubstateResponse>(`/substates/${encodeURIComponent(id)}`).then(normalizeSubstate) as Promise<VaultSubstateResponse>;

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

// From Ootle 0.48 `resource` is a base64 CBOR `Resource` (it was serde JSON).
const normalizeResource = async (data: ResourceResponse): Promise<ResourceResponse> => ({
  ...data,
  resource: await decodeResource<ResourceResponse["resource"]>(data.resource),
});

export const getResource = (address: string) => get<ResourceResponse>(`/resources/${encodeURIComponent(address)}`).then(normalizeResource);
export const getTariResource = () => get<ResourceResponse>("/resources/tari").then(normalizeResource);

// ---- Templates ----

// `/templates/cached` doesn't exist on the real indexer (confirmed live: it 400s, "Failed to parse
// substate key" -- the router treats anything after `/templates/` as a template address). The real
// list route is `/templates/catalogue` -- every template the indexer has discovered on the network,
// not just the handful it's configured to watch for events (that's the separate, much narrower
// `/templates/watched`). It's cursor-paginated server-side (`limit`/`after`), capped at 100 per
// request; there are well under 100 templates today, so one fetch at the cap gets the complete set.
export interface CachedTemplate {
  template_address: string;
  template_name: string;
  author_public_key: string;
  binary_hash: string;
  at_epoch: number;
}

export interface CachedTemplatesResponse {
  entries: CachedTemplate[];
}

const CATALOGUE_FETCH_LIMIT = 100;

export const listCachedTemplates = () =>
  get<CachedTemplatesResponse>("/templates/catalogue", { limit: CATALOGUE_FETCH_LIMIT });

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
  code_size: number;
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
    // Commits to every field the signers authorized (network, instructions, inputs, epoch bounds,
    // flags, blob commitments) excluding the signatures themselves -- lets anyone holding the
    // transaction link it to this receipt without the link revealing who signed it (deriving the
    // transaction id itself requires the signatures). Added in the 0.39.0 network upgrade.
    intent_commitment?: string;
  };
}

// From Ootle 0.48 `receipt` is a base64 CBOR `TransactionReceipt` (it was serde JSON).
export const getTransactionReceipt = (id: string) =>
  get<TransactionReceiptResponse>(`/transaction-receipts/${encodeURIComponent(id)}`).then(
    async (data): Promise<TransactionReceiptResponse> => ({ ...data, receipt: await decodeTransactionReceipt<TransactionReceiptResponse["receipt"]>(data.receipt) }),
  );

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
  }).then(
    // From Ootle 0.48 each event (`events[i][1]`) is a base64 CBOR `Event` (it was serde JSON).
    async (data): Promise<QueryTransactionEventsResponse> => ({
      ...data,
      events: await Promise.all(data.events.map(async ([txId, ev]) => [txId, await decodeEvent<TransactionEvent>(ev)] as [string, TransactionEvent])),
    }),
  );

// ---- Transaction receipts ----

export const listTransactionReceipts = (limit = 25) =>
  get<{ receipts?: Array<[string, unknown]> }>("/transaction-receipts", { limit }).then(async (data) =>
    data.receipts ? { ...data, receipts: await Promise.all(data.receipts.map(async ([id, r]) => [id, await decodeTransactionReceipt(r)] as [string, unknown])) } : data,
  );
