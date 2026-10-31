// Comprueba que el service worker guarda en caché todos los archivos que necesita
// la app sin conexión. Si se añade un módulo y se olvida aquí, la app se rompería offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const PUBLIC = path.resolve(import.meta.dirname, '../public');
const sw = readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
const shell = JSON.parse(
  sw.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'),
);

// Archivos públicos que no hacen falta sin conexión (SEO, redes) o que no se cachean a sí mismos.
const NOT_CACHED = new Set(['/sw.js', '/robots.txt', '/sitemap.xml', '/llms.txt', '/og.png', '/index.html']);

const listFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : ['/' + path.relative(PUBLIC, full).split(path.sep).join('/')];
  });

test('todo lo que precachea el service worker existe', () => {
  for (const url of shell) {
    const file = url === '/' ? 'index.html' : url.slice(1);
    assert.ok(existsSync(path.join(PUBLIC, file)), `Falta ${url}`);
  }
});

test('ningún archivo de la app se queda fuera de la caché', () => {
  const missing = listFiles(PUBLIC).filter((f) => !NOT_CACHED.has(f) && !shell.includes(f));
  assert.deepEqual(missing, []);
});
