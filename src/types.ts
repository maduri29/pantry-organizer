import { Context, Schema } from 'effect';

export const units = ['level', 'items', 'g', 'kg', 'lb', 'ml', 'L', 'packs'] as const;
export const locations = ['Pantry', 'Fridge', 'Freezer'] as const;
export const categories = [
  'Vegetables',
  'Fruit',
  'Grains & pulses',
  'Spices & seasonings',
  'Dairy & eggs',
  'Meat & fish',
  'Canned & packaged foods',
  'Snacks',
  'Drinks',
  'Other'
] as const;

export const UnitSchema = Schema.Literal('level', 'items', 'g', 'kg', 'lb', 'ml', 'L', 'packs');
export type Unit = (typeof units)[number];

export const LocationSchema = Schema.Literal('Pantry', 'Fridge', 'Freezer');
export type Location = (typeof locations)[number];

export const CategorySchema = Schema.Literal(
  'Vegetables',
  'Fruit',
  'Grains & pulses',
  'Spices & seasonings',
  'Dairy & eggs',
  'Meat & fish',
  'Canned & packaged foods',
  'Snacks',
  'Drinks',
  'Other'
);
export type Category = (typeof categories)[number];

export interface Product {
  id: string;
  name: string;
  unit: Unit;
  category: string;
  minimum: number;
  checkedAt: string;
}

export const ProductSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  unit: UnitSchema,
  category: Schema.String,
  minimum: Schema.Number,
  checkedAt: Schema.String
});

export interface Batch {
  id: string;
  productId: string;
  quantity: number;
  location: Location;
  expiry: string | null;
  checkedAt: string;
}

export const BatchSchema = Schema.Struct({
  id: Schema.String,
  productId: Schema.String,
  quantity: Schema.Number,
  location: LocationSchema,
  expiry: Schema.NullOr(Schema.String),
  checkedAt: Schema.String
});

export const MovementTypeSchema = Schema.Literal('restock', 'consume', 'discard', 'correct');
export type MovementType = typeof MovementTypeSchema.Type;

export interface Movement {
  id: string;
  productId: string;
  batchId: string;
  type: MovementType;
  quantity: number;
  at: string;
}

export const MovementSchema = Schema.Struct({
  id: Schema.String,
  productId: Schema.String,
  batchId: Schema.String,
  type: MovementTypeSchema,
  quantity: Schema.Number,
  at: Schema.String
});

export const ShoppingStatusSchema = Schema.Literal('open', 'purchased', 'removed');
export type ShoppingStatus = typeof ShoppingStatusSchema.Type;

export interface ShoppingItem {
  id: string;
  productId: string;
  quantity?: number;
  status: ShoppingStatus;
}

export const ShoppingItemSchema = Schema.Struct({
  id: Schema.String,
  productId: Schema.String,
  quantity: Schema.optional(Schema.Number),
  status: ShoppingStatusSchema
});

export interface PantryState {
  products: Product[];
  batches: Batch[];
  movements: Movement[];
  shopping: ShoppingItem[];
}

export const PantryStateSchema = Schema.Struct({
  products: Schema.Array(ProductSchema),
  batches: Schema.Array(BatchSchema),
  movements: Schema.Array(MovementSchema),
  shopping: Schema.Array(ShoppingItemSchema)
});

export interface PantryRecord {
  state: PantryState;
  revision: number;
}

export interface CategorySuggestionInput {
  id: string;
  name: string;
}

export interface CategorySuggestion {
  id: string;
  category: string;
  confidence: number;
}

export interface CategoryAssignment {
  productId: string;
  category: string;
}

export const PantryRecordSchema = Schema.Struct({
  state: PantryStateSchema,
  revision: Schema.Number
});

export interface FoodInput {
  name: string;
  unit: Unit;
  category: string;
  location: Location;
  quantity: number;
  minimum?: number;
  expiry?: string | null;
}

export interface RestockInput {
  productId: string;
  quantity: number;
  location: Location;
  expiry?: string | null;
}

export interface PantryConfig {
  firebase?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    appId?: string;
  };
  householdId?: string;
}

export interface PantryRepository {
  load(): Promise<PantryRecord>;
  save(state: PantryState, revision: number): Promise<PantryRecord>;
  getIdToken?(): Promise<string>;
  subscribe?(
    callback: (record: PantryRecord) => void,
    onError?: (err: unknown) => void
  ): () => void;
  signOut?(): Promise<void>;
}

export const PantryRepositoryTag = Context.GenericTag<PantryRepository>('PantryRepository');

declare global {
  interface Window {
    PANTRY_CONFIG?: PantryConfig;
  }
}
