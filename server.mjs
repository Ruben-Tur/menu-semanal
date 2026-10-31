// Servidor estático mínimo para menu-semanal (sin dependencias).
// Solo sirve los archivos de /public: la app no tiene API ni guarda nada en el servidor.
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

// Ruta real (sin enlaces simbólicos) para comparar con realpath() de cada archivo.
const ROOT = await realpath(path.join(import.meta.dirname, 'public'));
const PORT = Number.parseInt(process.env.PORT ?? '4323', 10);
const HOST = process.env.HOST || '127.0.0.1';
const SITE_URL = parseSiteUrl(process.env.SITE_URL || `http://localhost:${PORT}`);
const IS_HTTPS = SITE_URL.startsWith('https://');

// Límite de peticiones por IP (ventana fija). La carga inicial con la caché del
// service worker son unas 30 peticiones, así que el margen es amplio.
const RATE_LIMIT = { windowMs: 60_000, max: 600 };
const MAX_URL_LENGTH = 2048;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

// Archivos de texto en los que se sustituye __SITE_URL__ (URL canónica, sitemap…).
const TEMPLATED = new Set(['.html', '.txt', '.xml']);

// Sin 'unsafe-inline' ni 'unsafe-eval'. El JSON-LD es un bloque de datos y la CSP no lo bloquea.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(IS_HTTPS ? ['upgrade-insecure-requests'] : []),
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1',
  ...(IS_HTTPS ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};

function parseSiteUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocolo');
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    console.error(`SITE_URL no es una URL http(s) válida: ${value}`);
    process.exit(1);
  }
}

const hits = new Map();
setInterval(() => hits.clear(), RATE_LIMIT.windowMs).unref();

function isRateLimited(ip) {
  const count = (hits.get(ip) ?? 0) + 1;
  hits.set(ip, count);
  return count > RATE_LIMIT.max;
}

function sendText(res, status, message, extra = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(message);
}

/** Traduce la ruta de la URL a un archivo dentro de /public, o `null` si no es válida. */
async function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  // Nada de archivos o carpetas ocultos (.git, .env…).
  if (decoded.split('/').some((part) => part.startsWith('.'))) return null;
  if (decoded.endsWith('/')) decoded += 'index.html';

  const file = path.resolve(ROOT, `.${path.posix.normalize(decoded)}`);
  if (!file.startsWith(ROOT + path.sep)) return null;
  try {
    // realpath descarta enlaces simbólicos que apunten fuera de /public.
    const real = await realpath(file);
    if (!real.startsWith(ROOT + path.sep)) return null;
    const info = await stat(real);
    return info.isFile() ? { file: real, info } : null;
  } catch {
    return null;
  }
}

const server = http.createServer({ maxHeaderSize: 8 * 1024 }, async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendText(res, 405, 'Método no permitido', { Allow: 'GET, HEAD' });
    }
    if (isRateLimited(req.socket.remoteAddress ?? 'desconocida')) {
      return sendText(res, 429, 'Demasiadas peticiones. Espera un minuto.', { 'Retry-After': '60' });
    }
    if ((req.url ?? '').length > MAX_URL_LENGTH) return sendText(res, 414, 'URL demasiado larga');
    if (Number(req.headers['content-length'] ?? 0) > 0) return sendText(res, 413, 'Esta web no acepta datos');

    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    const found = await resolveFile(pathname);
    if (!found) return sendText(res, 404, 'No encontrado');

    const ext = path.extname(found.file).toLowerCase();
    const type = MIME[ext];
    if (!type) return sendText(res, 404, 'No encontrado');

    let body = await readFile(found.file);
    if (TEMPLATED.has(ext)) body = Buffer.from(body.toString('utf8').replaceAll('__SITE_URL__', SITE_URL));

    const etag = `"${createHash('sha1').update(body).digest('base64url').slice(0, 16)}"`;
    const name = path.basename(found.file);
    // El HTML, el manifiesto y el service worker se revalidan siempre; el resto lo versiona sw.js.
    const revalidate = ['.html', '.webmanifest', '.txt', '.xml'].includes(ext) || name === 'sw.js';
    const headers = {
      ...SECURITY_HEADERS,
      'Content-Type': type,
      'Cache-Control': revalidate ? 'no-cache' : 'public, max-age=3600',
      ETag: etag,
      ...(name === 'offline.html' ? { 'X-Robots-Tag': 'noindex' } : {}),
    };

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    res.writeHead(200, { ...headers, 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    // Al cliente nunca le llega el detalle del error.
    console.error('Error al servir un archivo:', error.message);
    if (!res.headersSent) sendText(res, 500, 'Error interno');
    else res.destroy();
  }
});

server.requestTimeout = 10_000;
server.headersTimeout = 5_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 200;

server.listen(PORT, HOST, () => {
  console.log(`menu-semanal en http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
