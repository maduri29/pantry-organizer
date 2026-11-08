import { level } from './domain.ts';
import type { Product } from './types.ts';

export const fmt = (n: number): string => Number(n.toFixed(3)).toLocaleString();

export const formatUnit = (n: number, unit: string): string =>
  n === 1 && (unit === 'items' || unit === 'packs') ? unit.slice(0, -1) : unit;

export const formatAmount = (n: number, product: Product): string =>
  product.unit === 'level' ? level(n) : `${fmt(n)} ${formatUnit(n, product.unit)}`;
