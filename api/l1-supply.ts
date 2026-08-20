// Vercel serverless function (Node runtime) proxying the Tari L1 base node's gRPC API as JSON.
//
// Browsers can't speak gRPC directly (it needs HTTP/2 trailers fetch/XHR don't expose), so this
// exists purely as a thin, read-only translation layer -- one live call to the public base node
// (grpc.tari.com:443, the same endpoint Tari Universe itself talks to in its default "Remote"
// node mode -- confirmed by reading a live Tari Universe install's own config_core.json) per
// request, reshaped into plain JSON. No local state, no writes, nothing cached beyond Vercel's
// own edge cache (see the Cache-Control header below).
import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { emissionAtHeight, heightAtTailEmission, type EmissionParams } from "../src/lib/emission.js";

const PROTO_PATH = path.join(process.cwd(), "api/proto/base_node.proto");
const NODE_ADDRESS = "grpc.tari.com:443";
// How many recent headers to sample for the live average block time. Large enough to smooth
// over the multi-PoW-algorithm interleaving (RandomX/Sha3x/RandomXT/Cuckaroo each contribute
// blocks independently -- see this endpoint's own `powAlgoMix` field), small enough to stay fast.
const BLOCK_TIME_SAMPLE = 200;

let cachedClient: grpc.Client | null = null;
function getClient(): grpc.Client {
  if (cachedClient) return cachedClient;
  const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.dirname(PROTO_PATH)],
  });
  const proto = grpc.loadPackageDefinition(packageDef) as unknown as {
    tari: { rpc: { BaseNode: new (address: string, creds: grpc.ChannelCredentials) => grpc.Client } };
  };
  cachedClient = new proto.tari.rpc.BaseNode(NODE_ADDRESS, grpc.credentials.createSsl());
  return cachedClient;
}

function unaryCall<T>(client: grpc.Client, method: string, request: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamically loaded gRPC client, no static types
    (client as any)[method](request, (err: grpc.ServiceError | null, res: T) => (err ? reject(err) : resolve(res)));
  });
}

function streamingCall<T>(client: grpc.Client, method: string, request: unknown): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const items: T[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamically loaded gRPC client, no static types
    const stream = (client as any)[method](request) as NodeJS.ReadableStream;
    stream.on("data", (d: T) => items.push(d));
    stream.on("end", () => resolve(items));
    stream.on("error", reject);
  });
}

interface TipInfoResponse {
  metadata: { best_block_height: string; timestamp: string };
}
interface ValueAtHeightResponse {
  circulating_supply: string;
  height: string;
  mined_rewards: string;
  spendable_rewards: string;
  spendable_pre_mine: string;
  total_spendable: string;
  total_pre_mine: string;
  time_locked_pre_mine: string;
}
interface ConsensusConstants {
  coinbase_min_maturity: string;
  emission_initial: string;
  emission_decay: string[];
  inflation_bips: string;
  pre_mine_value: string;
  tail_epoch_length: string;
}
interface BlockHeaderResponse {
  header: { height: string; timestamp: string; pow?: { pow_algo?: string } };
  reward: string;
}

export default async function handler(req: { method?: string }, res: {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader: (name: string, value: string) => void;
}) {
  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const client = getClient();

    const tip = await unaryCall<TipInfoResponse>(client, "GetTipInfo", {});
    const tipHeight = tip.metadata.best_block_height;

    const [supplyList, constants, headers] = await Promise.all([
      streamingCall<ValueAtHeightResponse>(client, "GetTokensInCirculation", { heights: [tipHeight] }),
      unaryCall<ConsensusConstants>(client, "GetConstants", { block_height: tipHeight }),
      streamingCall<BlockHeaderResponse>(client, "ListHeaders", {
        num_headers: BLOCK_TIME_SAMPLE,
        sorting: "SORTING_DESC",
      }),
    ]);
    const supply = supplyList[0];
    if (!supply) throw new Error("GetTokensInCirculation returned no entry for the current tip height");

    headers.sort((a, b) => Number(a.header.height) - Number(b.header.height));
    const first = headers[0];
    const last = headers[headers.length - 1];
    const elapsedSeconds = first && last ? Number(last.header.timestamp) - Number(first.header.timestamp) : null;
    const intervalCount = headers.length - 1;
    const avgBlockTimeSeconds = elapsedSeconds !== null && intervalCount > 0 ? elapsedSeconds / intervalCount : null;

    const powAlgoMix: Record<string, number> = {};
    for (const h of headers) {
      const algo = h.header.pow?.pow_algo ?? "unknown";
      powAlgoMix[algo] = (powAlgoMix[algo] ?? 0) + 1;
    }

    // Verified byte-for-byte against live GetTokensInCirculation output before this was wired in
    // (emissionAtHeight's cumulative supply-since-pre-mine matched mined_rewards exactly, diff 0
    // uT, at a real mainnet height) -- see this function's own doc comment / emission.ts.
    const emissionParams: EmissionParams = {
      initialMicroXtm: BigInt(constants.emission_initial),
      decay: constants.emission_decay.map(Number),
      inflationBips: BigInt(constants.inflation_bips),
      tailEpochLength: BigInt(constants.tail_epoch_length),
      initialSupplyMicroXtm: BigInt(constants.pre_mine_value),
    };
    const currentEmission = emissionAtHeight(emissionParams, BigInt(tipHeight));
    const tailCrossing = currentEmission.inTailEmission ? null : heightAtTailEmission(emissionParams, 10_000_000n);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({
      tip: { height: tipHeight, timestamp: tip.metadata.timestamp },
      supply: {
        circulatingSupply: supply.circulating_supply,
        minedRewards: supply.mined_rewards,
        spendableRewards: supply.spendable_rewards,
        spendablePreMine: supply.spendable_pre_mine,
        totalSpendable: supply.total_spendable,
        totalPreMine: supply.total_pre_mine,
        timeLockedPreMine: supply.time_locked_pre_mine,
      },
      constants: {
        coinbaseMinMaturity: constants.coinbase_min_maturity,
        emissionInitial: constants.emission_initial,
        emissionDecay: constants.emission_decay,
        inflationBips: constants.inflation_bips,
        preMineValue: constants.pre_mine_value,
        tailEpochLength: constants.tail_epoch_length,
      },
      emission: {
        currentBlockReward: currentEmission.rewardMicroXtm.toString(),
        inTailEmission: currentEmission.inTailEmission,
        tailEmissionHeight: tailCrossing?.height.toString() ?? null,
        // Supply once decay hands off to tail (inflation-based) emission -- not the same as the
        // commonly-quoted "21B design target" (6.3B pre-mine + 14.7B decay-phase mining): decay
        // doesn't converge to exactly that figure before the tail cutoff overtakes it, and supply
        // keeps growing (~inflationBips/100 %/yr, compounding) forever after this point, so there
        // is no actual hard cap. Null once already in tail emission (the crossing is in the past).
        tailEmissionSupply: tailCrossing?.supplyMicroXtm.toString() ?? null,
      },
      recentBlockTime: {
        avgSeconds: avgBlockTimeSeconds,
        sampleBlocks: headers.length,
        fromHeight: first?.header.height ?? null,
        toHeight: last?.header.height ?? null,
      },
      powAlgoMix,
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
