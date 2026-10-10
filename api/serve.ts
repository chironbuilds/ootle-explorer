// Standalone HTTP wrapper around the /api/l1-supply handler.
//
// explorer.tari.mw is no longer on Vercel -- it's static files behind nginx on the self-hosted
// box (see deploy.sh / the nginx site config), and nginx has no serverless runtime. Without this,
// /api/l1-supply falls through nginx's SPA `try_files ... /index.html` and answers 200 text/html,
// which the client silently parses to null and renders as an empty page.
//
// So the same handler runs here as a plain long-lived Node service on a loopback port, with nginx
// proxying /api/ to it -- matching how the other node services on this box are wired.
//
// Note it resolves its proto files via process.cwd(), so systemd must set WorkingDirectory to the
// deploy root (the dir holding api/proto/).
import http from "node:http";
import handler from "./l1-supply.js";

const PORT = Number(process.env.PORT ?? 8792);
const HOST = process.env.HOST ?? "127.0.0.1";

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');
    return;
  }
  if (pathname !== "/api/l1-supply") {
    res.writeHead(404, { "Content-Type": "application/json" }).end('{"error":"Not found"}');
    return;
  }

  // Minimal shim over the Vercel handler contract the function was written against.
  const shim = {
    setHeader: (name: string, value: string) => void res.setHeader(name, value),
    status: (code: number) => ({
      json: (body: unknown) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.writeHead(code).end(JSON.stringify(body));
      },
    }),
  };

  // The handler resolves its own errors into a 502 body; this only catches a throw escaping it,
  // which must not take the whole process down.
  Promise.resolve(handler({ method: req.method }, shim)).catch((err: unknown) => {
    if (res.headersSent) return void res.end();
    const message = err instanceof Error ? err.message : String(err);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.writeHead(500).end(JSON.stringify({ error: message }));
  });
});

server.listen(PORT, HOST, () => console.log(`veil-api listening on http://${HOST}:${PORT}`));
