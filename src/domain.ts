import { Data, Effect, Option, pipe, Schema } from 'effect';
import {
  units,
  locations,
  categories,
  PantryStateSchema,
  type Unit,
  type Location,
  type Product,
  type Batch,
  type PantryState,
  type FoodInput,
  type RestockInput
} from './types.js';

export { units, locations, categories };

export class DomainValidationError extends Data.TaggedError('DomainValidationError')<{
  readonly message: string;
}> {}

export class DomainNotFoundError extends Data.TaggedError('DomainNotFoundError')<{
  readonly message: string;
}> {}

export class DomainConflictError extends Data.TaggedError('DomainConflictError')<{
  readonly message: string;
}> {}

export const today = (): string => new Date().toLocaleDateString('en-CA');
const id = (): string => crypto.randomUUID();

export const empty = (): PantryState => ({
  products: [],
  batches: [],
  movements: [],
  shopping: []
});

const positive = (n: number): Effect.Effect<number, DomainValidationError> => {
  if (!Number.isFinite(n) || n <= 0) {
    return Effect.fail(
      new DomainValidationError({ message: 'Enter an amount greater than zero.' })
    );
  }
  return Effect.succeed(n);
};

export const total = (s: PantryState, p: Product): number =>
  p.unit === 'level'
    ? Math.max(0, ...s.batches.filter((b) => b.productId === p.id).map((b) => b.quantity))
    : s.batches.filter((b) => b.productId === p.id).reduce((n, b) => n + b.quantity, 0);

export const level = (n: number): 'Out' | 'Low' | 'Half' | 'Full' =>
  n === 0 ? 'Out' : n <= 0.25 ? 'Low' : n <= 0.5 ? 'Half' : 'Full';

export const isLow = (s: PantryState, p: Product): boolean => total(s, p) <= p.minimum;

export const expiryDays = (date?: string | null): number =>
  pipe(
    Option.fromNullable(date),
    Option.map((d) =>
      Math.round((Date.parse(`${d}T12:00:00`) - Date.parse(`${today()}T12:00:00`)) / 86400000)
    ),
    Option.getOrElse(() => Infinity)
  );

export function addEffect(
  s: PantryState,
  input: FoodInput
): Effect.Effect<Product, DomainValidationError> {
  return Effect.gen(function* () {
    const name = input.name?.trim();
    if (!name) {
      return yield* Effect.fail(new DomainValidationError({ message: 'Give this food a name.' }));
    }
    if (
      !units.includes(input.unit) ||
      !locations.includes(input.location) ||
      !input.category?.trim() ||
      input.category.length > 60
    ) {
      return yield* Effect.fail(
        new DomainValidationError({ message: 'Choose a valid unit, category and location.' })
      );
    }

    let min = input.minimum;
    if (input.unit === 'level') {
      if (![0, 0.25, 0.5, 1].includes(input.quantity)) {
        return yield* Effect.fail(new DomainValidationError({ message: 'Choose a stock level.' }));
      }
      min = 0.25;
    } else {
      yield* positive(input.quantity);
    }

    if (min !== undefined && (!Number.isFinite(min) || min < 0)) {
      return yield* Effect.fail(
        new DomainValidationError({ message: 'Minimum stock cannot be negative.' })
      );
    }

    if (input.expiry && !/^\d{4}-\d{2}-\d{2}$/.test(input.expiry)) {
      return yield* Effect.fail(new DomainValidationError({ message: 'Choose a valid date.' }));
    }

    let p = s.products.find(
      (prod) => prod.name.toLowerCase() === name.toLowerCase() && prod.unit === input.unit
    );
    const now = new Date().toISOString();
    if (!p) {
      p = {
        id: id(),
        name,
        unit: input.unit,
        category: input.category,
        minimum: min ?? 0,
        checkedAt: now
      };
      s.products.push(p);
    }
    p.checkedAt = now;

    const existing =
      input.unit === 'level'
        ? s.batches.find((b) => b.productId === p!.id && b.location === input.location)
        : null;

    if (existing) {
      existing.quantity = input.quantity;
      existing.expiry = input.expiry || null;
      existing.checkedAt = now;
      s.movements.push({
        id: id(),
        productId: p.id,
        batchId: existing.id,
        type: 'restock',
        quantity: input.quantity,
        at: now
      });
      return p;
    }

    const b: Batch = {
      id: id(),
      productId: p.id,
      quantity: input.quantity,
      location: input.location,
      expiry: input.expiry || null,
      checkedAt: now
    };
    s.batches.push(b);
    s.movements.push({
      id: id(),
      productId: p.id,
      batchId: b.id,
      type: 'restock',
      quantity: input.quantity,
      at: now
    });
    return p;
  });
}

function runSyncOrThrow<A, E extends { message: string }>(effect: Effect.Effect<A, E>): A {
  const exit = Effect.runSyncExit(effect);
  if (exit._tag === 'Failure') {
    const failure = exit.cause;
    if (failure._tag === 'Fail') {
      throw new Error(failure.error.message);
    }
    if (failure._tag === 'Die') {
      throw failure.defect;
    }
    throw new Error(String(failure));
  }
  return exit.value;
}

export function add(s: PantryState, input: FoodInput): Product {
  return runSyncOrThrow(addEffect(s, input));
}

export function moveEffect(
  s: PantryState,
  batchId: string,
  type: string,
  quantity: number
): Effect.Effect<void, DomainValidationError | DomainNotFoundError> {
  return Effect.gen(function* () {
    const b = s.batches.find((batch) => batch.id === batchId);
    if (!b) {
      return yield* Effect.fail(
        new DomainNotFoundError({ message: 'This batch no longer exists.' })
      );
    }
    if (!['consume', 'discard', 'correct'].includes(type)) {
      return yield* Effect.fail(new DomainValidationError({ message: 'Unknown stock action.' }));
    }
    const product = s.products.find((p) => p.id === b.productId);
    if (!product) {
      return yield* Effect.fail(
        new DomainNotFoundError({ message: 'This food no longer exists.' })
      );
    }

    if (product.unit === 'level' && (type !== 'correct' || ![0, 0.25, 0.5, 1].includes(quantity))) {
      return yield* Effect.fail(
        new DomainValidationError({ message: 'Choose a remaining stock level.' })
      );
    }

    if (type === 'correct') {
      if (!Number.isFinite(quantity) || quantity < 0) {
        return yield* Effect.fail(
          new DomainValidationError({ message: 'The corrected amount must be zero or greater.' })
        );
      }
    } else {
      yield* positive(quantity);
      if (quantity > b.quantity) {
        return yield* Effect.fail(
          new DomainValidationError({ message: 'That is more than you have in this batch.' })
        );
      }
    }

    const now = new Date().toISOString();
    b.checkedAt = now;
    const delta = type === 'correct' ? quantity - b.quantity : -quantity;
    b.quantity = Math.round((b.quantity + delta) * 1e6) / 1e6;
    s.movements.push({
      id: id(),
      productId: b.productId,
      batchId: b.id,
      type: type as any,
      quantity: type === 'correct' ? delta : quantity,
      at: now
    });
  });
}

export function move(s: PantryState, batchId: string, type: string, quantity: number): void {
  return runSyncOrThrow(moveEffect(s, batchId, type, quantity));
}

export function suggest(s: PantryState, p: Product): void {
  if (s.shopping.some((i) => i.productId === p.id && i.status === 'open')) {
    return;
  }
  s.shopping.push({
    id: id(),
    productId: p.id,
    quantity: Math.max(1, p.minimum - total(s, p)),
    status: 'open'
  });
}

export function purchaseEffect(
  s: PantryState,
  itemId: string,
  input: Partial<FoodInput>
): Effect.Effect<void, DomainValidationError | DomainConflictError | DomainNotFoundError> {
  return Effect.gen(function* () {
    const item = s.shopping.find((i) => i.id === itemId);
    if (!item || item.status !== 'open') {
      return yield* Effect.fail(
        new DomainConflictError({ message: 'This item was already restocked.' })
      );
    }
    const p = s.products.find((prod) => prod.id === item.productId);
    if (!p) {
      return yield* Effect.fail(
        new DomainNotFoundError({ message: 'This food no longer exists.' })
      );
    }
    yield* addEffect(s, { ...p, ...input } as FoodInput);
    item.status = 'purchased';
  });
}

export function purchase(s: PantryState, itemId: string, input: Partial<FoodInput>): void {
  return runSyncOrThrow(purchaseEffect(s, itemId, input));
}

export function deleteFoodEffect(
  s: PantryState,
  productId: string
): Effect.Effect<Product, DomainNotFoundError> {
  return Effect.gen(function* () {
    const product = s.products.find((p) => p.id === productId);
    if (!product) {
      return yield* Effect.fail(
        new DomainNotFoundError({ message: 'This food no longer exists.' })
      );
    }
    const batchIds = new Set(s.batches.filter((b) => b.productId === productId).map((b) => b.id));
    s.products = s.products.filter((p) => p.id !== productId);
    s.batches = s.batches.filter((b) => b.productId !== productId);
    s.movements = s.movements.filter((m) => m.productId !== productId && !batchIds.has(m.batchId));
    s.shopping = s.shopping.filter((i) => i.productId !== productId);
    return product;
  });
}

export function deleteFood(s: PantryState, productId: string): Product {
  return runSyncOrThrow(deleteFoodEffect(s, productId));
}

export function bulkRestockEffect(
  s: PantryState,
  entries: RestockInput[]
): Effect.Effect<void, DomainValidationError | DomainNotFoundError | DomainConflictError> {
  return Effect.gen(function* () {
    if (!entries.length) {
      return yield* Effect.fail(
        new DomainValidationError({ message: 'Select at least one food you bought.' })
      );
    }
    if (new Set(entries.map((e) => e.productId)).size !== entries.length) {
      return yield* Effect.fail(
        new DomainValidationError({ message: 'A food was selected more than once.' })
      );
    }
    const next = structuredClone(s);
    for (const entry of entries) {
      const p = next.products.find((prod) => prod.id === entry.productId);
      if (!p) {
        return yield* Effect.fail(
          new DomainNotFoundError({ message: 'This food no longer exists.' })
        );
      }
      const item = next.shopping.find((i) => i.productId === p.id && i.status === 'open');
      if (item) {
        yield* purchaseEffect(next, item.id, entry as any);
      } else {
        yield* addEffect(next, { ...p, ...entry } as FoodInput);
      }
    }
    Object.assign(s, next);
  });
}

export function bulkRestock(s: PantryState, entries: RestockInput[]): void {
  return runSyncOrThrow(bulkRestockEffect(s, entries));
}

export function demo(): PantryState {
  const s = empty();
  const sampleItems: [string, Unit, string, Location, number, number, number | null][] = [
    ['Avocados', 'items', 'Fruit', 'Pantry', 2, 2, 2],
    ['Greek yogurt', 'g', 'Dairy & eggs', 'Fridge', 400, 200, 3],
    ['Basmati rice', 'kg', 'Grains & pulses', 'Pantry', 1.5, 0.5, null],
    ['Blueberries', 'packs', 'Fruit', 'Fridge', 1, 1, 1],
    ['Frozen peas', 'g', 'Vegetables', 'Freezer', 600, 200, null]
  ];

  for (const [name, unit, category, location, quantity, minimum, days] of sampleItems) {
    const d = new Date();
    d.setDate(d.getDate() + (days || 0));
    add(s, {
      name,
      unit,
      category,
      location,
      quantity,
      minimum,
      expiry: days ? d.toLocaleDateString('en-CA') : ''
    });
  }
  return s;
}

export const validateState = (data: unknown): Effect.Effect<PantryState, DomainValidationError> => {
  const decoded = Schema.decodeUnknownEither(PantryStateSchema)(data);
  if (decoded._tag === 'Left') {
    return Effect.fail(new DomainValidationError({ message: 'Invalid pantry data format.' }));
  }
  return Effect.succeed(decoded.right as PantryState);
};
