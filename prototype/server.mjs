// Local-only entry for the throwaway UI variations. This does not import App.tsx,
// Firebase, the service worker, or any production repository.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const outputDir = await mkdtemp(join(tmpdir(), 'pantry-ui-prototype-'));
const build = await Bun.build({
  entrypoints: [resolve(import.meta.dir, 'main.tsx')],
  outdir: outputDir,
  target: 'browser',
  format: 'esm',
  naming: 'prototype.js',
  minify: false,
  define: { 'process.env.NODE_ENV': '"development"' },
});

if (!build.success) {
  for (const log of build.logs) console.error(log);
  throw new Error('Could not build the local prototype.');
}

const html = await Bun.file(resolve(import.meta.dir, 'index.html')).text();
const css = await Bun.file(resolve(import.meta.dir, 'prototype.css')).text();
const gallery = await Bun.file(resolve(import.meta.dir, 'screenshots.html')).text();
const script = Bun.file(resolve(outputDir, 'prototype.js'));
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/' || pathname === '/index.html') {
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (pathname === '/prototype.css') {
      return new Response(css, { headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (pathname === '/prototype.js') {
      return new Response(script, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (pathname === '/screenshots.html') {
      return new Response(gallery, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (/^\/prototype-fonts\/[a-z0-9-]+\.woff2$/.test(pathname)) {
      const fileName = pathname.split('/').at(-1);
      const font = Bun.file(resolve(import.meta.dir, 'fonts', fileName));
      if (await font.exists()) return new Response(font, { headers: { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=3600' } });
    }
    if (/^\/prototype-shots\/variant-[A-F]-(desktop|mobile)\.jpg$/.test(pathname)) {
      const fileName = pathname.split('/').at(-1);
      const screenshot = Bun.file(resolve(import.meta.dir, 'screenshots', fileName));
      if (await screenshot.exists()) return new Response(screenshot, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=3600' } });
    }
    if (pathname === '/prototype-shots/pantry-items.png') {
      const sprite = Bun.file(resolve(import.meta.dir, 'assets/pantry-items.png'));
      if (await sprite.exists()) return new Response(sprite, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' } });
    }
    if (pathname === '/prototype-shots/pantry-items.prompt.txt') {
      const prompt = Bun.file(resolve(import.meta.dir, 'assets/pantry-items.prompt.txt'));
      if (await prompt.exists()) return new Response(prompt, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
    }
    return new Response('Not found', { status: 404 });
  },
});

console.log(`Pantry UI prototype ready at http://127.0.0.1:${server.port}/?variant=A`);
