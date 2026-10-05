import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const base = process.env.PROTOTYPE_URL ?? 'http://127.0.0.1:59849';
const output = resolve('prototype/screenshots');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const expectations = {
  D: { selector: '.d-stock-line', count: 53, font: 'Outfit', mono: true, title: 'Cook from', background: 'rgb(36, 37, 32)' },
  E: { selector: '.e-food-row', count: 53, font: 'Manrope', title: 'What feels good', background: 'rgb(240, 245, 239)' },
  F: { selector: '.f-record', count: 53, font: 'Space Grotesk', mono: true, title: 'Inventory', background: 'rgb(255, 255, 255)' },
};
let passed = 0;
try {
  const navigationPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await navigationPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  if (!(await navigationPage.locator('h1').innerText()).includes('Cook from')) throw new Error('Queryless preview route did not default to variant D');
  await navigationPage.locator('body').focus();
  await navigationPage.keyboard.press('ArrowRight');
  if (!navigationPage.url().includes('variant=E')) throw new Error('Arrow navigation did not switch D to E');
  await navigationPage.locator('.search-box input').focus();
  await navigationPage.keyboard.press('ArrowRight');
  if (!navigationPage.url().includes('variant=E')) throw new Error('Arrow navigation intercepted text-field input');
  console.log('PASS switcher: queryless route defaults to D; arrows switch variants and stay out of text inputs');
  passed += 1;
  await navigationPage.close();
  for (const [key, expected] of Object.entries(expectations)) {
    for (const [size, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      await page.goto(`${base}/?variant=${key}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      const result = await page.evaluate(({ selector, font, mono, title }) => ({
        heading: document.querySelector('h1')?.innerText ?? '',
        rows: document.querySelectorAll(selector).length,
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        fontLoaded: document.fonts.check(`500 16px "${font}"`),
        monoLoaded: !mono || document.fonts.check('500 12px "IBM Plex Mono"'),
        fontFamily: getComputedStyle(document.querySelector('main')).fontFamily,
        background: getComputedStyle(document.querySelector('.prototype-root')).backgroundColor,
        title,
      }), { selector: expected.selector, font: expected.font, mono: expected.mono, title: expected.title });
      if (!result.heading.includes(result.title) || result.rows !== expected.count || result.scrollWidth > result.width || !result.fontLoaded || !result.monoLoaded || result.background !== expected.background) {
        throw new Error(`${key}/${size}: ${JSON.stringify(result)}`);
      }
      await page.screenshot({ path: resolve(output, `variant-${key}-${size}.jpg`), type: 'jpeg', quality: 88 });
      console.log(`PASS ${key}/${size}: ${result.rows} rows, font ${expected.font} loaded, ${result.width}px without horizontal overflow`);
      passed += 1;
      if (size === 'desktop') {
        const addLabel = { D: 'Add a food', E: 'Add to pantry', F: 'New item' }[key];
        await page.getByRole('button', { name: addLabel }).click();
        if (await page.getByRole('dialog').count() !== 1) throw new Error(`${key}: add form failed to open`);
        const option = await page.locator('.add-modal select').first().locator('option').allTextContents();
        if (!option.includes('Millets')) throw new Error(`${key}: category picker missing existing Indian food category`);
        await page.getByRole('button', { name: 'Cancel' }).click();
        console.log(`PASS ${key}/add: category form opens and contains Millets`);
        passed += 1;
        if (key === 'E') await page.locator('.e-category-tile').filter({ hasText: 'Rice & grains' }).click();
        else await page.locator('select[aria-label="Filter by category"]').selectOption({ label: 'Rice & grains' });
        if (await page.locator(expected.selector).count() !== 3) throw new Error(`${key}: category filter did not produce three Rice & grains items`);
        await page.locator('.search-box input').fill('Poha thick');
        if (await page.locator(expected.selector).count() !== 1) throw new Error(`${key}: item search did not narrow to Poha thick`);
        if (key === 'F') await page.locator('.f-detail-actions .f-restock').click();
        else await page.locator(expected.selector).getByRole('button', { name: 'Restock Poha thick' }).click();
        const updatedAmount = key === 'F'
          ? await page.locator('.f-detail-count strong').first().innerText()
          : await page.locator(expected.selector).first().innerText();
        if (!updatedAmount.includes('2 g')) throw new Error(`${key}: restock did not increment the sample amount: ${updatedAmount}`);
        await page.locator('.search-box input').fill('');
        if (key === 'E') await page.locator('.e-category-tile.all').click();
        else await page.locator('select[aria-label="Filter by category"]').selectOption('all');
        const lowLabel = { D: 'Low / out', E: 'Low or empty', F: 'Needs attention' }[key];
        await page.getByRole('button', { name: lowLabel }).click();
        if (await page.locator(expected.selector).count() !== 6) throw new Error(`${key}: low-stock filter did not show the six remaining low/out items after restocking Poha`);
        console.log(`PASS ${key}/controls: category filter, search, restock amount, and low-stock filter`);
        passed += 1;
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`PASS ${passed} focused browser assertions; captured six D/E/F screenshots.`);
