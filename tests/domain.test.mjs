import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/domain.js';
const food = (extra = {}) => ({
  name: 'Rice',
  quantity: 5,
  unit: 'kg',
  minimum: 1,
  category: 'Grains & pulses',
  location: 'Pantry',
  ...extra
});
test('same food keeps separate batches; incompatible units stay separate', () => {
  const s = D.empty();
  D.add(s, food());
  D.add(s, food({ expiry: '2027-01-01' }));
  D.add(s, food({ unit: 'g' }));
  assert.equal(s.products.length, 2);
  assert.equal(s.batches.length, 3);
  assert.equal(D.total(s, s.products[0]), 10);
});
test('pounds are an exact-stock unit and stay separate from other units', () => {
  const s = D.empty();
  const p = D.add(s, food({ name: 'Bread flour', unit: 'lb', quantity: 1, minimum: 0 }));
  assert.equal(p.unit, 'lb');
  assert.equal(D.total(s, p), 1);
  D.add(s, food({ name: 'Bread flour', unit: 'g', quantity: 454, minimum: 0 }));
  assert.equal(s.products.length, 2);
});
test('stock check sets remaining amount without inventing consumption', () => {
  const s = D.empty();
  D.add(s, food());
  D.move(s, s.batches[0].id, 'correct', 0);
  assert.equal(D.total(s, s.products[0]), 0);
  assert.equal(s.products.length, 1);
  assert.equal(s.movements[1].type, 'correct');
  assert.equal(s.movements[1].quantity, -5);
  assert.ok(s.batches[0].checkedAt);
  assert.equal(D.isLow(s, s.products[0]), true);
});
test('rejects negative, nonfinite and overdrawn amounts', () => {
  for (const quantity of [-1, NaN, Infinity, 0])
    assert.throws(() => D.add(D.empty(), food({ quantity })));
  const s = D.empty();
  D.add(s, food());
  assert.throws(() => D.move(s, s.batches[0].id, 'discard', 6));
  assert.throws(() => D.move(s, s.batches[0].id, 'correct', -1));
  assert.equal(D.total(s, s.products[0]), 5);
});
test('suggestions require acceptance, deduplicate and purchase exactly once', () => {
  const s = D.empty();
  const p = D.add(s, food({ quantity: 1 }));
  assert.equal(s.shopping.length, 0);
  D.suggest(s, p);
  D.suggest(s, p);
  assert.equal(s.shopping.length, 1);
  const item = s.shopping[0];
  D.purchase(s, item.id, { quantity: 3, location: 'Pantry', expiry: null });
  assert.equal(D.total(s, p), 4);
  assert.equal(item.status, 'purchased');
  assert.throws(() => D.purchase(s, item.id, { quantity: 3, location: 'Pantry' }));
  assert.equal(D.total(s, p), 4);
});
test('category is independent from storage and permits a custom category', () => {
  const s = D.empty();
  const p = D.add(s, food({ category: '  Baking supplies  ', location: 'Freezer' }));
  assert.equal(p.category, 'Baking supplies');
  assert.equal(s.batches[0].location, 'Freezer');
  assert.throws(() => D.add(D.empty(), food({ category: '   ' })));
});
test('usage estimates are not a low-stock trigger', () => {
  const s = D.empty();
  const p = D.add(s, food({ quantity: 10, minimum: 2 }));
  assert.equal(D.isLow(s, p), false);
  assert.equal(D.total(s, p), 10);
});
test('rough levels replace stock per location, never add fractions', () => {
  const s = D.empty();
  const p = D.add(s, food({ unit: 'level', quantity: 0.25 }));
  assert.equal(D.isLow(s, p), true);
  D.add(s, food({ unit: 'level', quantity: 1 }));
  assert.equal(s.batches.length, 1);
  assert.equal(D.total(s, p), 1);
  assert.equal(D.isLow(s, p), false);
  D.move(s, s.batches[0].id, 'correct', 0);
  assert.equal(D.level(D.total(s, p)), 'Out');
  assert.throws(() => D.move(s, s.batches[0].id, 'correct', 5));
});
test('bulk restock changes only selected products and is atomic on validation failure', () => {
  const s = D.empty();
  const a = D.add(s, food({ name: 'Rice', unit: 'level', quantity: 0.25 }));
  const b = D.add(s, food({ name: 'Oats', unit: 'level', quantity: 0.5 }));
  D.suggest(s, a);
  D.bulkRestock(s, [{ productId: a.id, quantity: 1, location: 'Pantry' }]);
  assert.equal(D.total(s, a), 1);
  assert.equal(D.total(s, b), 0.5);
  assert.equal(s.shopping[0].status, 'purchased');
  const before = structuredClone(s);
  assert.throws(() =>
    D.bulkRestock(s, [
      { productId: a.id, quantity: 0.5, location: 'Pantry' },
      { productId: b.id, quantity: 9, location: 'Pantry' }
    ])
  );
  assert.deepEqual(s, before);
});
test('deleting a food clears linked batches, history and shopping entries only', () => {
  const s = D.empty();
  const rice = D.add(s, food());
  D.add(s, food({ location: 'Fridge', expiry: '2027-01-01' }));
  D.move(s, s.batches[0].id, 'consume', 2);
  D.suggest(s, rice);
  s.shopping.push(
    { id: 'rice-purchased', productId: rice.id, status: 'purchased' },
    { id: 'rice-removed', productId: rice.id, status: 'removed' }
  );
  const oats = D.add(s, food({ name: 'Oats', quantity: 2 }));
  D.move(s, s.batches.find((b) => b.productId === oats.id).id, 'correct', 0);
  D.suggest(s, oats);
  const oatsBatchIds = s.batches.filter((b) => b.productId === oats.id).map((b) => b.id),
    oatsMovements = s.movements.filter((m) => m.productId === oats.id),
    oatsShopping = structuredClone(s.shopping.at(-1));
  D.deleteFood(s, rice.id);
  assert.deepEqual(
    s.products.map((p) => p.id),
    [oats.id]
  );
  assert.deepEqual(
    s.batches.map((b) => b.id),
    oatsBatchIds
  );
  assert.deepEqual(s.movements, oatsMovements);
  assert.deepEqual(s.shopping, [oatsShopping]);
  assert.equal(D.total(s, oats), 0);
  assert.equal(D.isLow(s, oats), true);
});
test('deleting an unknown food leaves the pantry unchanged', () => {
  const s = D.empty();
  D.add(s, food());
  const before = structuredClone(s);
  assert.throws(() => D.deleteFood(s, 'missing-food'), /no longer exists/);
  assert.deepEqual(s, before);
});
test('local demo saves durably and rejects stale revisions', async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v)
  };
  const { LocalDemoRepository } = await import('../src/storage.js');
  const a = new LocalDemoRepository(),
    b = new LocalDemoRepository();
  const initial = await a.load();
  D.add(initial.state, food());
  await a.save(initial.state, 0);
  assert.equal((await b.load()).state.products.length, 1);
  await assert.rejects(() => b.save(D.empty(), 0), /another tab/);
});
