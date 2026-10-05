// Invoked only when VERCEL_GIT_COMMIT_REF is the UI-study branch.
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const publicDir = resolve('public');
await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });

const result = await Bun.build({
  entrypoints: ['prototype/main.tsx'],
  outdir: 'public',
  target: 'browser',
  format: 'esm',
  naming: 'prototype.js',
  minify: true,
  define: { 'process.env.NODE_ENV': '"development"' },
});

if (!result.success) {
  for (const message of result.logs) console.error(message);
  process.exit(1);
}

for (const name of ['index.html', 'prototype.css', 'screenshots.html']) {
  await copyFile(resolve('prototype', name), resolve(publicDir, name));
}

const screenshots = resolve('prototype/screenshots');
const screenshotFiles = (await readdir(screenshots)).filter((name) => name.endsWith('.jpg'));
if (screenshotFiles.length < 12) throw new Error(`Expected desktop and phone screenshots for six variants, found ${screenshotFiles.length}`);
await mkdir(resolve(publicDir, 'prototype-shots'), { recursive: true });
for (const name of screenshotFiles) await copyFile(resolve(screenshots, name), resolve(publicDir, 'prototype-shots', name));
const fontFiles = await readdir(resolve('prototype/fonts'));
if (fontFiles.length < 4) throw new Error(`Expected four self-hosted prototype font files, found ${fontFiles.length}`);
await mkdir(resolve(publicDir, 'prototype-fonts'), { recursive: true });
for (const name of fontFiles) await copyFile(resolve('prototype/fonts', name), resolve(publicDir, 'prototype-fonts', name));

console.log(`Built standalone prototype preview (${screenshotFiles.length} screenshots, ${fontFiles.length} self-hosted fonts, no app API or service worker).`);
