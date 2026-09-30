// Client for this app's own /api/l1-supply serverless function -- a thin JSON proxy over the Tari
// L1 (Minotari) base node's gRPC API (grpc.tari.com:443), since browsers can't speak gRPC
// directly. See api/l1-supply.ts for what it actually calls.

export interface L1SupplyResponse {
  tip: { height: string; timestamp: string };
  supply: {
    circulatingSupply: string;
    minedRewards: string;
    spendableRewards: string;
    spendablePreMine: string;
    totalSpendable: string;
    totalPreMine: string;
    timeLockedPreMine: string;
  };
  constants: {
    coinbaseMinMaturity: string;
    emissionInitial: string;
    emissionDecay: string[];
    inflationBips: string;
    preMineValue: string;
    tailEpochLength: string;
  };
  emission: {
    currentBlockReward: string;
    inTailEmission: boolean;
    tailEmissionHeight: string | null;
    tailEmissionSupply: string | null;
  };
  recentBlockTime: { avgSeconds: number | null; sampleBlocks: number; fromHeight: string | null; toHeight: string | null };
  powAlgoMix: Record<string, number>;
}

export async function getL1Supply(): Promise<L1SupplyResponse> {
  const res = await fetch("/api/l1-supply");

  // Read as text first. If the API service is down or unproxied, nginx's SPA fallback answers
  // this with 200 text/html (index.html), and parsing that straight to null used to hand the
  // page a "successful" empty result -- which rendered as a blank page with no error at all.
  const raw = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    throw new Error("The L1 supply API returned a non-JSON response -- the base node proxy is probably not reachable.");
  }

  const errorMessage = typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string"
    ? (body as { error: string }).error
    : null;
  if (!res.ok) throw new Error(errorMessage ?? `HTTP ${res.status}`);
  if (errorMessage) throw new Error(errorMessage);
  if (typeof body !== "object" || body === null) throw new Error("The L1 supply API returned an unexpected payload.");

  return body as L1SupplyResponse;
}
