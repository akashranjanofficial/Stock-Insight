// Lightweight HTTPS reverse proxy for local development.
// Proxies https://localhost:<HTTPS_PORT> → http://localhost:<HTTP_PORT>

import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certsDir = path.resolve(__dirname, "..", ".certs");

const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 5174;
const HTTP_TARGET_PORT = Number(process.env.HTTP_TARGET_PORT) || 5173;

const keyPath = path.join(certsDir, "localhost-key.pem");
const certPath = path.join(certsDir, "localhost-cert.pem");

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error("❌ SSL certificates not found in .certs/");
  console.error("   Run start-local.sh to generate them automatically.");
  process.exit(1);
}

const sslOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

const proxy = https.createServer(sslOptions, (clientReq, clientRes) => {
  const options = {
    hostname: "localhost",
    port: HTTP_TARGET_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: clientReq.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on("error", (err) => {
    clientRes.writeHead(502, { "Content-Type": "text/plain" });
    clientRes.end(`HTTPS Proxy Error: ${err.message}`);
  });

  clientReq.pipe(proxyReq, { end: true });
});

// Handle WebSocket upgrades (needed for Vite HMR)
proxy.on("upgrade", (clientReq, clientSocket, head) => {
  const options = {
    hostname: "localhost",
    port: HTTP_TARGET_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: clientReq.headers,
  };

  const proxyReq = http.request(options);

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    clientSocket.write(
      `HTTP/1.1 101 ${proxyRes.statusMessage}\r\n` +
        Object.entries(proxyRes.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n"
    );
    if (proxyHead.length > 0) clientSocket.write(proxyHead);

    proxySocket.pipe(clientSocket);
    clientSocket.pipe(proxySocket);
  });

  proxyReq.on("error", () => {
    clientSocket.destroy();
  });

  proxyReq.end();
});

proxy.listen(HTTPS_PORT, () => {
  console.log(`🔒 HTTPS proxy running at https://localhost:${HTTPS_PORT}`);
  console.log(`   ↳ forwarding to http://localhost:${HTTP_TARGET_PORT}`);
});
