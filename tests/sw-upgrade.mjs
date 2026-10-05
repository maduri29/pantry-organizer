import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const workerTemplate = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const releaseId = 'test-current';
const currentWorker = workerTemplate
  .replaceAll('__PANTRY_RELEASE_ID__', releaseId)
  .replaceAll('__PANTRY_MANROPE_HASH__', 'test-manrope')
  .replaceAll('__PANTRY_FRAUNCES_HASH__', 'test-fraunces');
const currentCacheName = `pantry-cache-${releaseId}`;
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
    response.writeHead(200, { 'Content-Type': 'text/css' }).end(`body { color: ${release === 'previous' ? '#111' : '#222'}; }`);
  } else if (pathname === '/favicon.svg') {
    response.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end('<svg></svg>');
  } else if (pathname === '/manifest.webmanifest') {
    response.writeHead(200, { 'Content-Type': 'application/manifest+json' }).end('{}');
  } else if (pathname.startsWith('/assets/')) {
    response.writeHead(200, { 'Content-Type': 'font/woff2' }).end('asset');
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
    return keys.includes(`pantry-cache-${'test-current'}`) && !keys.includes('pantry-cache-v1');
  });
  await page.waitForFunction(async () => {
    const cache = await caches.open(`pantry-cache-${'test-current'}`);
    const keys = await cache.keys();
    return keys.length === 9 && keys.some((request) => new URL(request.url).pathname === '/src/app.js');
  });
  await page.waitForTimeout(100);
  const cacheContents = await page.evaluate(async () => {
    const cache = await caches.open(`pantry-cache-${'test-current'}`);
    const keys = (await cache.keys()).map((request) => request.url);
    const findByPath = async (path) => {
      const key = keys.find((entry) => new URL(entry).pathname === path);
      return key ? cache.match(key) : undefined;
    };
    const response = await findByPath('/src/app.js');
    const firebase = await findByPath('/src/firebase.js');
    const css = await findByPath('/styles.css');
    const manrope = keys.some((key) => key.includes('/assets/manrope.test-manrope.woff2?'));
    const fraunces = keys.some((key) => key.includes('/assets/fraunces.test-fraunces.woff2?'));
    return { keys, app: await response?.text(), firebase: await firebase?.text(), css: await css?.text(), manrope, fraunces };
  });
  const cachedApp = cacheContents.app;
  assert.match(await cachedApp, /current/, 'new worker precaches the current app bundle');
  assert.match(
    cacheContents.firebase,
    /firebaseBuild = 'current'/,
    'new worker precaches the current Firebase module'
  );
  assert.equal(cacheContents.manrope, true, 'new worker precaches the versioned self-hosted UI font');
  assert.equal(cacheContents.fraunces, true, 'new worker precaches the versioned self-hosted display font');
  assert.match(cacheContents.css, /#222/, 'new worker precaches the current stylesheet');

  await page.reload();
  assert.equal(await page.locator('#version').innerText(), 'current');
  assert.equal(await page.locator('body').evaluate((body) => getComputedStyle(body).color), 'rgb(34, 34, 34)');
  assert.equal(
    await page.evaluate(() => localStorage.getItem('pantry-organizer.demo.v1')),
    pantryData
  );
  assert.deepEqual(await page.evaluate(() => caches.keys()), [currentCacheName]);
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
