import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
const root = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const location = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!location.startsWith(root + path.sep) && location !== path.join(root, 'index.html')) { res.writeHead(403); res.end(); return; }
    const body = await readFile(location); res.writeHead(200, { 'Content-Type': mime[path.extname(location)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173, '0.0.0.0', () => {
  console.log('电脑打开: http://127.0.0.1:4173');
  const addresses = new Set(Object.values(networkInterfaces()).flat()
    .filter(info => info && info.family === 'IPv4' && !info.internal)
    .map(info => info.address)
    .filter(address => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)));
  for (const address of addresses) console.log(`手机打开（连接同一 Wi-Fi）: http://${address}:4173`);
  console.log('使用期间请保持此窗口开启。');
}).on('error', error => {
  if (error.code === 'EADDRINUSE') console.error('4173 端口已被占用。如果骰子已经启动，请使用原来的窗口；否则关闭占用该端口的程序后重试。');
  else console.error(error.message);
  process.exitCode = 1;
});
