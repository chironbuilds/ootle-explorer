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
  };
  recentBlockTime: { avgSeconds: number | null; sampleBlocks: number; fromHeight: string | null; toHeight: string | null };
  powAlgoMix: Record<string, number>;
}

export async function getL1Supply(): Promise<L1SupplyResponse> {
  const res = await fetch("/api/l1-supply");
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && body.error) || `HTTP ${res.status}`);
  return body as L1SupplyResponse;
}
