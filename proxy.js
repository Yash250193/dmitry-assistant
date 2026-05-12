'use strict';
/**
 * Локальный CORS-прокси для Авито API.
 * Запуск: node proxy.js
 * Адрес:  http://localhost:8080  →  https://api.avito.ru
 */
const http  = require('http');
const https = require('https');

const PROXY_PORT = 9099;
const API_HOST   = 'api.avito.ru';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

http.createServer((req, res) => {

  // Preflight OPTIONS — отвечаем сразу
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/ping') {
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS));
    res.end(JSON.stringify({ ok: true, proxy: 'avito', port: PROXY_PORT }));
    return;
  }

  console.log(`[proxy] ${req.method} ${req.url}`);

  // Строим заголовки для запроса к Авито
  const headers = Object.assign({}, req.headers);
  headers['host'] = API_HOST;
  delete headers['origin'];
  delete headers['referer'];

  const opts = {
    hostname: API_HOST,
    port:     443,
    path:     req.url,
    method:   req.method,
    headers,
  };

  const proxy = https.request(opts, (apiRes) => {
    res.writeHead(apiRes.statusCode, Object.assign({}, apiRes.headers, CORS));
    apiRes.pipe(res, { end: true });
  });

  proxy.on('error', (err) => {
    console.error('[proxy error]', err.message);
    res.writeHead(502, CORS);
    res.end(JSON.stringify({ error: err.message }));
  });

  req.pipe(proxy, { end: true });

}).listen(PROXY_PORT, () => {
  console.log('');
  console.log('  ✅  CORS-прокси запущен');
  console.log(`  →   http://localhost:${PROXY_PORT}  проксирует  https://${API_HOST}`);
  console.log('');
  console.log('  Оставьте это окно открытым.');
  console.log('  Откройте приложение через Live Server или: npx serve .');
  console.log('');
});
