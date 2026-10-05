// 本機預覽伺服器（只用 Node 內建模組，不安裝套件）
//   npm run dev        → 只有這台電腦能開（http://localhost:8080）
//   npm run dev:lan    → 同一個 Wi-Fi 的手機也能開（會列出區網網址）
//   停止：在終端機按 Ctrl + C
//
// 安全設計：
// - 白名單：只提供 index.html 與 src/ 底下的網頁檔，其他路徑一律 404。
//   reference/（範例圖片）、docs/、.git/、SPEC.md 等都不會被送出。
// - 只接受 GET、HEAD；擋掉 ../ 路徑穿越與隱藏檔。
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
};

/**
 * 把網址路徑轉成允許提供的相對檔案路徑；不允許時回傳 null。
 * @param {string} urlPath 例如 '/src/main.js?x=1'
 * @returns {string|null} 例如 'src/main.js'
 */
export function resolveRequest(urlPath) {
  let p;
  try {
    p = decodeURIComponent(String(urlPath).split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (p.includes('\0') || p.includes('\\')) return null;
  if (p === '/' || p === '') return 'index.html';
  const norm = path.posix.normalize(p);
  if (!norm.startsWith('/') || norm.split('/').some((seg) => seg === '..' || seg.startsWith('.'))) return null;
  const rel = norm.slice(1);
  if (rel === 'index.html') return rel;
  if (rel.startsWith('src/') && TYPES[path.posix.extname(rel)]) return rel;
  return null;
}

function lanAddresses() {
  return Object.values(networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

function start() {
  const args = process.argv.slice(2);
  const lan = args.includes('--lan');
  const portArg = args.indexOf('--port');
  const port = portArg >= 0 ? Number(args[portArg + 1]) : 8080;
  const host = lan ? '0.0.0.0' : '127.0.0.1';

  const server = createServer(async (req, res) => {
    const send = (code, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, '不支援的請求方式');
    const rel = resolveRequest(req.url);
    if (!rel) return send(404, '找不到');
    const file = path.join(ROOT, rel);
    try {
      if (!(await stat(file)).isFile()) return send(404, '找不到');
      send(200, await readFile(file), TYPES[path.extname(file)]);
    } catch {
      send(404, '找不到');
    }
  });

  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `連接埠 ${port} 已被占用，請改用：npm run dev -- --port 8081` : err.message);
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`預覽伺服器已啟動（停止請按 Ctrl + C）`);
    console.log(`  電腦開啟：http://localhost:${port}/`);
    if (lan) {
      const ips = lanAddresses();
      if (ips.length) ips.forEach((ip) => console.log(`  手機開啟（同一個 Wi-Fi）：http://${ip}:${port}/`));
      else console.log('  找不到區網位址，請確認電腦已連上 Wi-Fi');
      console.log('  注意：伺服器開著時，同一個網路上的任何人都能看到這個頁面；用完請立刻按 Ctrl + C 關閉。');
    }
  });

  process.on('SIGINT', () => { console.log('\n已關閉預覽伺服器'); server.close(() => process.exit(0)); });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) start();
