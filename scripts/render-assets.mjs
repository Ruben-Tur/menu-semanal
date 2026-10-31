// Genera los iconos PNG y la imagen para redes (og.png) a partir de los SVG/HTML
// de /design y public/icons/icon.svg, haciendo capturas con Edge (o Chrome) sin ventana.
// Uso: node scripts/render-assets.mjs   (EDGE_PATH=... para otro navegador)
// Solo hace falta al cambiar el diseño de los iconos; los PNG ya están en el repositorio.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const BROWSER = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const JOBS = [
  { src: 'public/icons/icon.svg', out: 'public/icons/icon-192.png', w: 192, h: 192, transparent: true },
  { src: 'public/icons/icon.svg', out: 'public/icons/icon-512.png', w: 512, h: 512, transparent: true },
  { src: 'design/icon-maskable.svg', out: 'public/icons/icon-maskable-512.png', w: 512, h: 512 },
  { src: 'design/icon-maskable.svg', out: 'public/icons/apple-touch-icon.png', w: 180, h: 180 },
  { src: 'design/og.html', out: 'public/og.png', w: 1200, h: 630 },
];

const profile = mkdtempSync(path.join(tmpdir(), 'menu-semanal-render-'));
const port = 9300 + Math.floor(Math.random() * 400);
const browser = spawn(BROWSER, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--blink-settings=preferredColorScheme=1', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let wsUrl;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await sleep(250);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch { /* el navegador aún arranca */ }
  }
  if (!wsUrl) throw new Error('No se ha podido conectar con el navegador.');

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => { ws.onopen = r; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id) pending.get(msg.id)?.(msg.result);
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

  for (const job of JOBS) {
    await send('Emulation.setDeviceMetricsOverride', { width: job.w, height: job.h, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setDefaultBackgroundColorOverride', job.transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
    await send('Page.navigate', { url: pathToFileURL(path.join(ROOT, job.src)).href });
    await sleep(700);
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: job.w, height: job.h, scale: 1 } });
    writeFileSync(path.join(ROOT, job.out), Buffer.from(data, 'base64'));
    console.log(`✓ ${job.out} (${job.w}×${job.h})`);
  }
  ws.close();
} finally {
  browser.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
