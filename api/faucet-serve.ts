// HTTP wrapper for the Ootle testnet faucet (faucet.ts), run as its own service on a loopback port
// behind nginx: GET /api/faucet (status), POST /api/faucet { address } (claim).
//
// Node 22 needs --experimental-wasm-modules to load ootle-wasm's bundler-target build.
import http from "node:http";
import { Faucet, FaucetError, configFromEnv } from "./faucet.js";

const PORT = Number(process.env.PORT ?? 8793);
const HOST = process.env.HOST ?? "127.0.0.1";
const MAX_BODY = 2048;

const faucet = new Faucet(configFromEnv());

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new FaucetError("Request too large.", 413));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname === "/healthz") return json(res, 200, { ok: true });
  if (pathname !== "/api/faucet") return json(res, 404, { error: "Not found" });

  try {
    if (req.method === "GET") return json(res, 200, await faucet.info());
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" }, { Allow: "GET, POST" });

    // Set by nginx from the realip-resolved client address; the service only listens on loopback.
    const ip = String(req.headers["x-real-ip"] ?? "").trim();
    if (!ip) return json(res, 400, { error: "Missing client address." });
    if (!/^application\/json\b/i.test(String(req.headers["content-type"] ?? ""))) {
      return json(res, 415, { error: "Expected a JSON body." });
    }
    let address: unknown;
    try {
      address = (JSON.parse(await readBody(req)) as { address?: unknown }).address;
    } catch (e) {
      if (e instanceof FaucetError) throw e;
      return json(res, 400, { error: "Malformed JSON." });
    }
    if (typeof address !== "string" || !address.trim()) return json(res, 400, { error: "An address is required." });

    const result = await faucet.claim(ip, address.trim());
    console.log(`claim ok ip=${ip} tx=${result.transactionId}`);
    return json(res, 200, result);
  } catch (e) {
    if (e instanceof FaucetError) {
      const headers: Record<string, string> = e.retryAfterSeconds ? { "Retry-After": String(e.retryAfterSeconds) } : {};
      return json(res, e.status, { error: e.message, retryAfterSeconds: e.retryAfterSeconds ?? null }, headers);
    }
    console.error("faucet error:", e);
    return json(res, 500, { error: "Internal error." });
  }
});

server.listen(PORT, HOST, () => console.log(`veil-faucet listening on http://${HOST}:${PORT}`));
