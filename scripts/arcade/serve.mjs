#!/usr/bin/env node
// Tiny static server for local testing of Godot web exports.
//
//   node scripts/arcade/serve.mjs [--port 8765] [--host 127.0.0.1] [--root public/game-builds] [--coi]
//
// --coi adds Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy:
//       require-corp (only needed for threaded exports, i.e. variant/thread_support=true).
// Correct MIME types for .wasm/.pck, no caching, path traversal blocked.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const port = Number(opt('--port', '8765'));
const host = opt('--host', '127.0.0.1');
const root = path.resolve(ROOT, opt('--root', 'public/game-builds'));
const coi = args.includes('--coi');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const target = path.resolve(root, `.${rel}`);
  if (target !== root && !target.startsWith(root + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' }).end('forbidden');
    return;
  }
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`404 ${rel}`);
    return;
  }
  if (stat.isDirectory()) {
    res.writeHead(301, { Location: `${url.pathname}/` }).end();
    return;
  }
  const headers = {
    'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (coi) {
    headers['Cross-Origin-Opener-Policy'] = 'same-origin';
    headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(target).pipe(res);
});

server.listen(port, host, () => {
  console.log(`[arcade-serve] http://${host}:${port}/  root=${root}  coi=${coi}`);
});
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
