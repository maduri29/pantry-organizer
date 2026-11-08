import { categories } from './category-taxonomy.ts';
import type { Product } from './types.ts';

export const availableCategories = (products: Product[]): string[] =>
  [...new Set([...categories, ...products.map((product) => product.category)])].sort();
