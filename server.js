'use strict';
/**
 * Запуск: node server.js
 * Открыть:  http://localhost:3000
 *
 * Один сервер делает всё:
 *   /          → отдаёт index.html и статику
 *   /api/*     → проксирует на https://api.avito.ru/*  (без CORS!)
 */
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT     = 3000;
const API_HOST = 'api.avito.ru';
const ROOT     = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
};

http.createServer((req, res) => {

  // ── API proxy: /api/* → https://api.avito.ru/* ────────────────────
  if (req.url.startsWith('/api/') || req.url.startsWith('/api?')) {
    const apiPath = req.url.slice(4); // убираем /api, оставляем /token, /core/v1/...

    const headers = Object.assign({}, req.headers);
    headers['host'] = API_HOST;
    delete headers['origin'];
    delete headers['referer'];

    const opts = {
      hostname: API_HOST,
      port:     443,
      path:     apiPath,
      method:   req.method,
      headers,
    };

    console.log(`[api] ${req.method} ${apiPath}`);

    const proxy = https.request(opts, (apiRes) => {
      res.writeHead(apiRes.statusCode, apiRes.headers);
      apiRes.pipe(res, { end: true });
    });

    proxy.on('error', (err) => {
      console.error('[api error]', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    req.pipe(proxy, { end: true });
    return;
  }

  // ── Static files ──────────────────────────────────────────────────
  const urlPath  = req.url.split('?')[0];
  const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  const ext      = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });

}).listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ✅  Сервер запущен!');
  console.log(`  →   Откройте в браузере:  http://localhost:${PORT}`);
  console.log('');
  console.log('  Оставьте это окно открытым.');
  console.log('');
});
