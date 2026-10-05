import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const base = process.env.PROTOTYPE_URL ?? 'http://127.0.0.1:60666';
const output = resolve('prototype/screenshots');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  await mkdir(output, { recursive: true });
  for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${base}/?variant=A`, { waitUntil: 'domcontentloaded' });
    const summary = page.locator('.glance-status');
    if (!(await page.locator('.a-shopping-glance h2').innerText()).includes('Shopping glance')) throw new Error('Shopping glance is missing');
    const normalizedSummary = (await summary.innerText()).replace(/\s+/g, ' ');
    if (!normalizedSummary.includes('2 out now') || !normalizedSummary.includes('5 running low')) throw new Error(`Derived 2 out / 5 low counts are wrong: ${normalizedSummary}`);
    if ((await page.locator('.glance-item-copy > strong').allTextContents()).join('|') !== 'Flax seeds|Red chillis|Baking powder|Dawn dishwash soap') throw new Error('Top attention item names are wrong');
    if (await page.locator('.shelf-item').count() !== 53) throw new Error('Expected all 53 sample items');
    if (await page.locator('.shelf-item .item-illustration').count() !== 53) throw new Error('Not all shelf items have illustrations');
    const sprite = await page.locator('.shelf-item .item-illustration-sprite').evaluateAll((els) => els.map((el) => ({ image: getComputedStyle(el).backgroundImage, position: getComputedStyle(el).backgroundPosition })));
    if (sprite.some((item) => !item.image.includes('pantry-items.png') || item.position.includes('NaN'))) throw new Error('Sprite image/position mapping failed');
    const spriteSize = await page.evaluate(async () => { const image = new Image(); image.src = '/prototype-shots/pantry-items.png'; await image.decode(); return [image.naturalWidth, image.naturalHeight]; });
    if (spriteSize[0] < 1200 || spriteSize[0] !== spriteSize[1]) throw new Error(`Sprite asset failed to load at expected square resolution: ${spriteSize.join('x')}`);
    const before = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (before.scrollWidth > before.width) throw new Error(`Horizontal overflow at ${label}: ${JSON.stringify(before)}`);
    await page.screenshot({ path: resolve(output, `variant-A-${label}.jpg`), type: 'jpeg', quality: 88 });
    console.log(`PASS A/${label}: shopping glance 2 out/5 low; 53 items illustrated; no overflow`);

    if (label === 'desktop') {
      await page.locator('select[aria-label="Filter by category"]').selectOption({ label: 'Rice & grains' });
      await page.locator('.search-box input').fill('Poha thick');
      await page.getByRole('button', { name: 'Low / out' }).click();
      await page.getByRole('button', { name: 'See all 7 items' }).click();
      if (await page.locator('.search-box input').inputValue() !== '') throw new Error('See all did not clear search');
      if (await page.locator('select[aria-label="Filter by category"]').inputValue() !== 'all') throw new Error('See all did not reset category');
      if (await page.locator('.shelf-item').count() !== 7) throw new Error('See all did not reveal all seven attention items');
      await page.getByRole('button', { name: 'Restock Flax seeds' }).click();
      const afterSummary = (await summary.innerText()).replace(/\s+/g, ' ');
      if (!afterSummary.includes('1 out now') || !afterSummary.includes('5 running low')) throw new Error(`Glance counts did not update after local restock: ${afterSummary}`);
      if (await page.locator('.shelf-item').count() !== 6) throw new Error('Restocked item remained in low/out filter');
      console.log('PASS A/controls: See all resets search/category, reveals seven; restock updates glance to 1 out/5 low');
    }
    await page.close();
  }
} finally {
  await browser.close();
}
