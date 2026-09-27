import { mkdir, copyFile, cp, writeFile, stat } from 'node:fs/promises';

const t0 = performance.now();

// 1. Parallel bundling using Bun when available
if (typeof Bun !== 'undefined') {
  const [appBuild, domainBuild, storageBuild] = await Promise.all([
    Bun.build({
      entrypoints: ['src/main.tsx'],
      naming: 'app.js',
      outdir: './src',
      target: 'browser',
      external: ['*/firebase.js'],
      minify: true,
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    }),
    Bun.build({
      entrypoints: ['src/domain.ts'],
      naming: 'domain.js',
      outdir: './src',
      target: 'node',
      minify: false
    }),
    Bun.build({
      entrypoints: ['src/storage.ts'],
      naming: 'storage.js',
      outdir: './src',
      target: 'node',
      minify: false
    })
  ]);

  for (const b of [appBuild, domainBuild, storageBuild]) {
    if (!b.success) {
      for (const message of b.logs) {
        console.error(message);
      }
      process.exit(1);
    }
  }
}

if (process.argv.includes('--bundle-only')) {
  const t1 = performance.now();
  const appSize = (await stat('src/app.js')).size;
  console.log(`✓ Bundled in ${(t1 - t0).toFixed(1)}ms (app.js: ${(appSize / 1024).toFixed(1)} KB)`);
  process.exit(0);
}

// 2. Prepare static hosting in public/
await mkdir('public', { recursive: true });
for (const name of ['index.html', 'styles.css', 'favicon.svg', 'manifest.webmanifest', 'sw.js']) {
  await copyFile(name, `public/${name}`);
}
await cp('src', 'public/src', { recursive: true });

const env = {
  apiKey: process.env.PANTRY_FIREBASE_API_KEY,
  authDomain: process.env.PANTRY_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.PANTRY_FIREBASE_PROJECT_ID,
  appId: process.env.PANTRY_FIREBASE_APP_ID
};

if (Object.values(env).every(Boolean)) {
  const config = {
    firebase: env,
    householdId: process.env.PANTRY_HOUSEHOLD_ID || 'our-pantry'
  };
  await writeFile(
    'public/config.js',
    `window.PANTRY_CONFIG = ${JSON.stringify(config).replaceAll('<', '\\u003c')};\n`
  );
} else {
  try {
    await copyFile('config.js', 'public/config.js');
  } catch {
    await writeFile('public/config.js', 'window.PANTRY_CONFIG = {};\n');
  }
}

const t1 = performance.now();
const appSize = (await stat('public/src/app.js')).size;
console.log(
  `✓ Build completed in ${(t1 - t0).toFixed(1)}ms (app.js: ${(appSize / 1024).toFixed(1)} KB)`
);
