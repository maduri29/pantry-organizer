import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import * as D from '../src/domain.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright-core');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const state = D.empty();
D.add(state, {
  name: 'Bread flour',
  unit: 'kg',
  quantity: 1,
  minimum: 2,
  category: 'Atta & flours',
  location: 'Pantry'
});
D.add(state, {
  name: 'Jowar flour',
  unit: 'g',
  quantity: 907,
  minimum: 0,
  category: 'Atta & flours',
  location: 'Pantry'
});
try {
  for (const width of [560, 320, 390, 430, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    await context.route('**/config.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: 'window.PANTRY_CONFIG = {};' })
    );
    if (process.env.PANTRY_STYLE_SNAPSHOT) {
      const css = await readFile(process.env.PANTRY_STYLE_SNAPSHOT, 'utf8');
      await context.route('**/styles.css', (route) =>
        route.fulfill({ contentType: 'text/css', body: css })
      );
    }
    const page = await context.newPage();
    await page.goto(process.env.PANTRY_UI_URL || 'http://localhost:4173');
    await page.evaluate(
      (state) =>
        localStorage.setItem('pantry-organizer.demo.v1', JSON.stringify({ state, revision: 1 })),
      state
    );
    await page.reload();
    await page.getByRole('button', { name: 'Manage Jowar flour', exact: true }).click();
    await page.locator('#editor').getByRole('button', { name: 'Details', exact: true }).click();
    const padding = await page.evaluate(() =>
      ['.manage-heading', '.editor-task-switch', '.manage-body', '.manage-footer'].map((selector) =>
        parseFloat(getComputedStyle(document.querySelector(selector)).paddingLeft)
      )
    );
    assert.deepEqual(
      padding,
      Array(4).fill(width <= 600 ? 16 : 20),
      `editor gutters at ${width}px`
    );
    await page.locator('.batch-settings > summary').click();
    const chevron = await page.locator('.package-chevron').evaluate((el) => ({
      width: getComputedStyle(el).width,
      height: getComputedStyle(el).height
    }));
    assert.deepEqual(chevron, { width: '16px', height: '16px' });
    await page.locator('.manage-batch-meta > summary').click();
    const marker = await page
      .locator('.manage-batch-meta > summary')
      .evaluate((el) => getComputedStyle(el, '::after').content);
    assert.equal(marker, '""');
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true
    );
    await page.locator('#editor').getByRole('button', { name: 'Cancel', exact: true }).click();
    if (width <= 850) {
      assert.equal(
        await page
          .locator('.shelf-card')
          .first()
          .evaluate((el) => getComputedStyle(el).gridRowEnd),
        'auto'
      );
    }
    await context.close();
  }
  console.log(
    'PASS consistent editor gutters, package chevrons and phone card placement at six widths'
  );
} finally {
  await browser.close();
}
