// Small, defensive accessors into the raw `{ V1: { body: { transaction: {...} } } }` envelope the
// indexer returns for a transaction -- kept separate from indexer.ts's types because the envelope
// is versioned (V1 today) and only a handful of fields are ever actually displayed.

interface RawEnvelope {
  V1?: {
    body?: {
      transaction?: {
        network?: number;
        fee_instructions?: unknown[];
        instructions?: unknown[];
        inputs?: Array<{ substate_id: string; version: number | null }>;
        min_epoch?: number | null;
        max_epoch?: number | null;
      };
      signatures?: unknown[];
    };
    seal_signature?: { public_key?: string };
  };
}

export interface TxBody {
  feeInstructions: unknown[];
  instructions: unknown[];
  inputs: Array<{ substate_id: string; version: number | null }>;
  network: number | null;
  minEpoch: number | null;
  maxEpoch: number | null;
  sealSignerPublicKey: string | null;
}

const EMPTY: TxBody = { feeInstructions: [], instructions: [], inputs: [], network: null, minEpoch: null, maxEpoch: null, sealSignerPublicKey: null };

export function readTxBody(envelope: unknown): TxBody {
  const v1 = (envelope as RawEnvelope | undefined)?.V1;
  const tx = v1?.body?.transaction;
  if (!tx) return EMPTY;
  return {
    feeInstructions: tx.fee_instructions ?? [],
    instructions: tx.instructions ?? [],
    inputs: tx.inputs ?? [],
    network: tx.network ?? null,
    minEpoch: tx.min_epoch ?? null,
    maxEpoch: tx.max_epoch ?? null,
    sealSignerPublicKey: v1?.seal_signature?.public_key ?? null,
  };
}

/** True when any instruction in the transaction body is a `StealthTransfer` -- the confidential
 * transfer variant this chain's whole "veil" framing is built around. */
export function isStealthTransaction(body: TxBody): boolean {
  const all = [...body.feeInstructions, ...body.instructions];
  return all.some((i) => typeof i === "object" && i !== null && "StealthTransfer" in (i as Record<string, unknown>));
}
