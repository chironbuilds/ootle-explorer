// Ootle testnet faucet: sends a fixed amount of TARI to an address, at most once per 24 hours per
// client IP and per account.
//
// Runs as its own long-lived service (faucet-serve.ts) so a stuck or crashing faucet can't take the
// L1-supply API down with it. It holds the faucet account's seed on the server only.
//
// The client IP comes from `X-Real-IP`, which nginx sets from `$remote_addr` after its realip
// module has resolved Cloudflare's `CF-Connecting-IP` -- and only for connections that really come
// from Cloudflare's ranges. The service listens on loopback, so nothing but nginx can set it.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { OotleAccount, configureOotleStorage, inMemoryAdapter } from "@chironbuilder/ootle-sdk";
import { TARI_RESOURCE_ADDRESS } from "@tari-project/ootle";
import { parseOotleAddress } from "@tari-project/ootle-wasm";

const DAY_MS = 24 * 60 * 60 * 1000;
const UNIT = 1_000_000n; // TARI divisibility 6

export interface FaucetConfig {
  /** Where the faucet's 16-byte seed entropy lives (hex). Created on first start. */
  seedFile: string;
  /** Where claims are recorded, so limits survive a restart. */
  stateFile: string;
  /** µTARI per claim. */
  amount: bigint;
  /** Claims allowed across everyone per rolling 24 hours -- a ceiling on how fast it can be drained. */
  dailyCap: number;
}

export function configFromEnv(): FaucetConfig {
  const dir = process.env.FAUCET_DIR ?? "/var/lib/veil-faucet";
  return {
    seedFile: process.env.FAUCET_SEED_FILE ?? path.join(dir, "seed.hex"),
    stateFile: process.env.FAUCET_STATE_FILE ?? path.join(dir, "claims.json"),
    amount: BigInt(process.env.FAUCET_AMOUNT_TARI ?? "10") * UNIT,
    dailyCap: Number(process.env.FAUCET_DAILY_CAP ?? "300"),
  };
}

interface Claims {
  /** Last claim time (ms) per client IP. */
  ips: Record<string, number>;
  /** Last claim time (ms) per account owner key (hex). */
  accounts: Record<string, number>;
  /** Every claim time in the last 24 hours, for the daily cap. */
  recent: number[];
}

export class FaucetError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
  }
}

function loadSeed(file: string): Uint8Array {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, randomBytes(16).toString("hex") + "\n", { mode: 0o600 });
  }
  const hex = fs.readFileSync(file, "utf8").trim();
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`${file} must hold 16 bytes of hex`);
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export class Faucet {
  private readonly account: OotleAccount;
  private claims: Claims;
  /** Sends run one at a time: concurrent sends from one account race on its vault's version. */
  private queue: Promise<unknown> = Promise.resolve();
  /** IPs and accounts with a claim in flight, so a burst of parallel requests can't all pass the check. */
  private readonly pending = new Set<string>();

  constructor(private readonly config: FaucetConfig) {
    configureOotleStorage(inMemoryAdapter());
    this.account = OotleAccount.fromSeed(loadSeed(config.seedFile), 0, "esmeralda");
    this.claims = this.loadClaims();
  }

  private loadClaims(): Claims {
    try {
      const c = JSON.parse(fs.readFileSync(this.config.stateFile, "utf8")) as Claims;
      return { ips: c.ips ?? {}, accounts: c.accounts ?? {}, recent: c.recent ?? [] };
    } catch {
      return { ips: {}, accounts: {}, recent: [] };
    }
  }

  private saveClaims(now: number) {
    const keep = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).filter(([, t]) => now - t < DAY_MS));
    this.claims = {
      ips: keep(this.claims.ips),
      accounts: keep(this.claims.accounts),
      recent: this.claims.recent.filter((t) => now - t < DAY_MS),
    };
    const tmp = this.config.stateFile + ".tmp";
    fs.mkdirSync(path.dirname(this.config.stateFile), { recursive: true, mode: 0o700 });
    fs.writeFileSync(tmp, JSON.stringify(this.claims), { mode: 0o600 });
    fs.renameSync(tmp, this.config.stateFile);
  }

  async info() {
    const balances = await this.account.getBalances().catch(() => []);
    const tari = balances.find((b) => b.resourceAddress === TARI_RESOURCE_ADDRESS);
    return {
      network: "esmeralda",
      address: await this.account.getWalletAddress(),
      amount: this.config.amount.toString(),
      balance: (tari?.amount ?? 0n).toString(),
      claimsToday: this.claims.recent.filter((t) => Date.now() - t < DAY_MS).length,
      dailyCap: this.config.dailyCap,
    };
  }

  /** Validates the address and both limits, then sends. Throws `FaucetError` with an HTTP status. */
  async claim(ip: string, address: string): Promise<{ transactionId: string; amount: string }> {
    let ownerKey: string;
    try {
      const parsed = parseOotleAddress(address);
      if (parsed.network !== 0x26) throw new Error("wrong network");
      ownerKey = Buffer.from(parsed.owner_key).toString("hex");
    } catch {
      throw new FaucetError("That isn't a valid Esmeralda Ootle address (otl_esm_…).", 400);
    }
    if (ownerKey === Buffer.from(await this.account.getPublicKey()).toString("hex")) {
      throw new FaucetError("That's the faucet's own address.", 400);
    }

    const now = Date.now();
    const wait = (last: number | undefined) => (last === undefined ? 0 : Math.ceil((last + DAY_MS - now) / 1000));
    const ipKey = `ip:${ip}`;
    const acctKey = `acct:${ownerKey}`;
    if (this.pending.has(ipKey) || this.pending.has(acctKey)) {
      throw new FaucetError("A claim for this address or connection is already in progress.", 429, 30);
    }
    const ipWait = wait(this.claims.ips[ip]);
    if (ipWait > 0) throw new FaucetError("This connection already claimed in the last 24 hours.", 429, ipWait);
    const acctWait = wait(this.claims.accounts[ownerKey]);
    if (acctWait > 0) throw new FaucetError("This address already claimed in the last 24 hours.", 429, acctWait);
    const recent = this.claims.recent.filter((t) => now - t < DAY_MS);
    if (recent.length >= this.config.dailyCap) {
      throw new FaucetError("The faucet has reached its daily limit. Try again later.", 429, wait(recent[0]));
    }

    this.pending.add(ipKey);
    this.pending.add(acctKey);
    try {
      const run = this.queue.then(() => this.account.send(address, TARI_RESOURCE_ADDRESS, this.config.amount));
      this.queue = run.catch(() => undefined);
      const result = (await run) as { transactionId?: string; transaction_id?: string };
      const transactionId = result.transactionId ?? result.transaction_id ?? "";
      const at = Date.now();
      this.claims.ips[ip] = at;
      this.claims.accounts[ownerKey] = at;
      this.claims.recent.push(at);
      this.saveClaims(at);
      return { transactionId, amount: this.config.amount.toString() };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/insufficient/i.test(message)) throw new FaucetError("The faucet is empty right now. Try again later.", 503);
      throw new FaucetError(`The claim failed: ${message.slice(0, 300)}`, 502);
    } finally {
      this.pending.delete(ipKey);
      this.pending.delete(acctKey);
    }
  }
}
