import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const root = resolve(import.meta.dirname);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};
const port = Number(process.env.PORT) || 4173;

if (typeof Bun !== 'undefined') {
  Bun.serve({
    port,
    hostname: '127.0.0.1',
    async fetch(req) {
      const url = new URL(req.url);
      const path = resolve(
        root,
        '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
      );
      if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) {
        return new Response('Forbidden', { status: 403 });
      }
      const sourcePath = resolve(root, 'src');
      const allowedSource =
        (path.startsWith(sourcePath + '\\') || path.startsWith(sourcePath + '/')) &&
        extname(path) === '.js';
      if (
        !['/index.html', '/styles.css', '/config.js'].includes(url.pathname) &&
        url.pathname !== '/' &&
        !allowedSource
      ) {
        return new Response('Not found', { status: 404 });
      }
      const file = Bun.file(path);
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            'Content-Type': types[extname(path)] || 'text/plain',
            'Cache-Control': 'no-store'
          }
        });
      }
      if (url.pathname === '/config.js') {
        return new Response('window.PANTRY_CONFIG = {};', {
          headers: { 'Content-Type': 'text/javascript' }
        });
      }
      return new Response('Not found', { status: 404 });
    }
  });
  console.log(`Pantry preview: http://localhost:${port}`);
} else {
  http
    .createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const path = resolve(
        root,
        '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
      );
      if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) {
        res.writeHead(403).end();
        return;
      }
      const sourcePath = resolve(root, 'src');
      const allowedSource =
        (path.startsWith(sourcePath + '\\') || path.startsWith(sourcePath + '/')) &&
        extname(path) === '.js';
      if (
        !['/index.html', '/styles.css', '/config.js'].includes(url.pathname) &&
        url.pathname !== '/' &&
        !allowedSource
      ) {
        res.writeHead(404).end();
        return;
      }
      try {
        const body = await readFile(path);
        res.writeHead(200, {
          'Content-Type': types[extname(path)] || 'text/plain',
          'Cache-Control': 'no-store'
        });
        res.end(body);
      } catch {
        if (url.pathname === '/config.js') {
          res.writeHead(200, { 'Content-Type': 'text/javascript' });
          res.end('window.PANTRY_CONFIG = {};');
        } else res.writeHead(404).end('Not found');
      }
    })
    .listen(port, '127.0.0.1', () => console.log(`Pantry preview: http://localhost:${port}`));
}
