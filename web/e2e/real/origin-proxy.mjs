/**
 * Production smoke helper: a pass-through HTTP proxy that presents the web origin the API trusts.
 *   node e2e/real/origin-proxy.mjs [listenPort=3002] [target=http://localhost:3001] [trusted=http://localhost:4246]
 *
 * The dev API accepts browser calls from one web origin (`app.web-base-url` / `app.cors.allowed-origins`,
 * http://localhost:4246). A production build started on another port (`npm run start -- -p 3001`) is
 * refused with 403 by the API's CORS / refresh origin checks, because the `/api` rewrite forwards the
 * browser's `Origin`. This proxy streams every request to the production server unchanged (bodies,
 * uploads, downloads, cookies) and only replaces the `Origin` header — so the flows run against the real
 * production build with the browser at http://localhost:{listenPort}.
 */
import http from "node:http";

const [port = "3002", target = "http://localhost:3001", trusted = "http://localhost:4246"] = process.argv.slice(2);
const upstream = new URL(target);

const server = http.createServer((req, res) => {
  const headers = { ...req.headers };
  if (headers.origin) headers.origin = trusted;
  const forward = http.request(
    { hostname: upstream.hostname, port: upstream.port, path: req.url, method: req.method, headers },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  forward.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`origin-proxy: ${error.message}`);
  });
  req.pipe(forward);
});

server.listen(Number(port), () => {
  console.log(`origin-proxy http://localhost:${port} → ${target} (Origin as ${trusted})`);
});
