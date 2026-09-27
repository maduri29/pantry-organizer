import { describe, expect, test } from 'bun:test';
import { Effect, Schema } from 'effect';
import * as D from '../src/domain.ts';
import { LocalDemoRepository } from '../src/storage.ts';
import { PantryRecordSchema, type FoodInput } from '../src/types.ts';

const food = (extra: Partial<FoodInput> = {}): FoodInput => ({
  name: 'Rice',
  quantity: 5,
  unit: 'kg',
  minimum: 1,
  category: 'Grains & pulses',
  location: 'Pantry',
  ...extra
});

describe('Bun + Effect Domain Suite', () => {
  test('addEffect returns tagged DomainValidationError on invalid food', () => {
    const s = D.empty();
    const result = Effect.runSyncExit(D.addEffect(s, food({ name: '' })));
    expect(result._tag).toBe('Failure');
  });

  test('addEffect adds product and returns it successfully', () => {
    const s = D.empty();
    const product = Effect.runSync(D.addEffect(s, food()));
    expect(product.name).toBe('Rice');
    expect(D.total(s, product)).toBe(5);
  });

  test('PantryRecordSchema decodes and validates PantryRecord', () => {
    const s = D.empty();
    D.add(s, food());
    const record = { state: s, revision: 1 };
    const decoded = Schema.decodeUnknownSync(PantryRecordSchema)(record);
    expect(decoded.revision).toBe(1);
    expect(decoded.state.products.length).toBe(1);
  });

  test('Effect Option computes expiry days correctly', () => {
    expect(D.expiryDays(null)).toBe(Infinity);
    expect(D.expiryDays(undefined)).toBe(Infinity);
    expect(D.expiryDays(D.today())).toBe(0);
  });

  test('LocalDemoRepository persists and decodes durably', async () => {
    const values = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v)
    };
    const repo = new LocalDemoRepository();
    const initial = await repo.load();
    expect(initial.revision).toBe(0);
    D.add(initial.state, food());
    const saved = await repo.save(initial.state, 0);
    expect(saved.revision).toBe(1);
  });

  test('validateState succeeds on valid pantry state and fails on corrupted data', () => {
    const s = D.empty();
    D.add(s, food());
    const validResult = Effect.runSyncExit(D.validateState(s));
    expect(validResult._tag).toBe('Success');

    const invalidResult = Effect.runSyncExit(D.validateState({ products: 'not-an-array' }));
    expect(invalidResult._tag).toBe('Failure');
  });
});
