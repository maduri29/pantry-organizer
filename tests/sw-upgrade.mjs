import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const currentWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const previousWorker = await readFile(new URL('./fixtures/sw-v1.js', import.meta.url), 'utf8');
assert.notEqual(previousWorker, currentWorker, 'cache version and cache keys must change');

let release = 'previous';
const html = `<!doctype html>
<html><head><link rel="stylesheet" href="/styles.css"></head>
<body><main><div id="version"></div></main>
<script>navigator.serviceWorker.register('/sw.js')</script>
<script src="/src/app.js"></script></body></html>`;
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  response.setHeader('Cache-Control', 'no-cache');
  if (pathname === '/' || pathname === '/index.html') {
    response.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
  } else if (pathname === '/sw.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript' });
    response.end(release === 'previous' ? previousWorker : currentWorker);
  } else if (pathname === '/src/app.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript' });
    response.end(`document.querySelector('#version').textContent = '${release}';`);
  } else if (pathname === '/src/firebase.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript' });
    response.end(`window.firebaseBuild = '${release}';`);
  } else if (pathname === '/styles.css') {
    response.writeHead(200, { 'Content-Type': 'text/css' }).end('body { color: #222; }');
  } else if (pathname === '/favicon.svg') {
    response.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end('<svg></svg>');
  } else if (pathname === '/manifest.webmanifest') {
    response.writeHead(200, { 'Content-Type': 'application/manifest+json' }).end('{}');
  } else {
    response.writeHead(404).end();
  }
});

const address = await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address()));
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const origin = `http://127.0.0.1:${address.port}`;
  await page.goto(origin);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.waitForFunction(async () => (await caches.keys()).includes('pantry-cache-v1'));
  assert.equal(await page.locator('#version').innerText(), 'previous');

  const pantryData = JSON.stringify({ state: { products: [{ name: 'Keep this food' }] } });
  await page.evaluate(
    (value) => localStorage.setItem('pantry-organizer.demo.v1', value),
    pantryData
  );
  release = 'current';
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    return keys.includes('pantry-cache-v6') && !keys.includes('pantry-cache-v1');
  });
  await page.waitForFunction(async () => {
    const cache = await caches.open('pantry-cache-v6');
    return Boolean(await cache.match('/src/app.js?__pantry_cache_v6=pantry-cache-v6'));
  });
  const cacheContents = await page.evaluate(async () => {
    const cache = await caches.open('pantry-cache-v6');
    const keys = (await cache.keys()).map((request) => request.url);
    const response = await cache.match('/src/app.js?__pantry_cache_v6=pantry-cache-v6');
    const firebase = await cache.match('/src/firebase.js?__pantry_cache_v6=pantry-cache-v6');
    return { keys, app: await response?.text(), firebase: await firebase?.text() };
  });
  const cachedApp = cacheContents.app;
  assert.match(await cachedApp, /current/, 'new worker precaches the current app bundle');
  assert.match(
    cacheContents.firebase,
    /firebaseBuild = 'current'/,
    'new worker precaches the current Firebase module'
  );

  await page.reload();
  assert.equal(await page.locator('#version').innerText(), 'current');
  assert.equal(
    await page.evaluate(() => localStorage.getItem('pantry-organizer.demo.v1')),
    pantryData
  );
  assert.deepEqual(await page.evaluate(() => caches.keys()), ['pantry-cache-v6']);
  console.log(
    'PASS service worker update replaces stale app assets and preserves pantry localStorage'
  );
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}
