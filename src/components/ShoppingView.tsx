import React, { useMemo } from 'react';
import * as D from '../domain.ts';
import type { PantryState, Product, ShoppingItem } from '../types.ts';
import { fmt, formatAmount } from './InventoryView.tsx';
import { FoodIllustration } from './FoodIllustration.tsx';

interface ShoppingViewProps {
  state: PantryState;
  onRemoveItem: (itemId: string) => void;
  onBuyItem: (item: ShoppingItem, product: Product) => void;
  onAddSuggestion: (product: Product) => void;
}

export const ShoppingView: React.FC<ShoppingViewProps> = ({
  state: s,
  onRemoveItem,
  onBuyItem,
  onAddSuggestion
}) => {
  const items = useMemo(() => s.shopping.filter((i) => i.status === 'open'), [s.shopping]);
  const productMap = useMemo(() => new Map(s.products.map((p) => [p.id, p])), [s.products]);
  const openItemProductIds = useMemo(() => new Set(items.map((i) => i.productId)), [items]);
  const suggestions = useMemo(() => {
    return s.products.filter((p) => !openItemProductIds.has(p.id) && D.isLow(s, p));
  }, [s, openItemProductIds]);

  return (
    <>
      <p className="section-caption">
        Your list, your call. Suggestions are added only when you choose them.
      </p>

      {items.length > 0 ? (
        items.map((i) => {
          const p = productMap.get(i.productId);
          if (!p) return null;
          return (
            <div key={i.id} className="shopping-row">
              <FoodIllustration product={p} />
              <div className="info">
                <h2>{p.name}</h2>
                <span className="meta">
                  {p.unit === 'level'
                    ? 'Restock when you shop'
                    : `Planned: ${fmt(i.quantity ?? 1)} ${p.unit}`}
                </span>
              </div>
              <button
                data-action="remove"
                data-id={i.id}
                aria-label={`Remove ${p.name}`}
                onClick={() => onRemoveItem(i.id)}
              >
                ×
              </button>
              <button
                className="primary"
                data-action="buy"
                data-id={i.id}
                onClick={() => onBuyItem(i, p)}
              >
                Restock
              </button>
            </div>
          );
        })
      ) : (
        <div className="empty">
          <h2>A little list goes a long way</h2>
          <p>Add foods from your inventory or accept a suggestion below.</p>
        </div>
      )}

      {suggestions.length > 0 && <h3>Worth checking before you shop</h3>}

      {suggestions.map((p) => (
        <div key={p.id} className="shopping-row">
          <div className="info">
            <h2>{p.name}</h2>
            <span className="meta">{formatAmount(D.total(s, p), p)} left</span>
          </div>
          <button data-action="shop" data-id={p.id} onClick={() => onAddSuggestion(p)}>
            Add to list
          </button>
        </div>
      ))}
    </>
  );
};
