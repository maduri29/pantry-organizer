import React, { useMemo } from 'react';
import * as D from '../domain.ts';
import type { PantryState, Product, ShoppingItem } from '../types.ts';
import { formatAmount } from '../format.ts';
import { FoodIllustration } from './FoodIllustration.tsx';

interface ShoppingViewProps {
  state: PantryState;
  onRemoveItem: (itemId: string) => void;
  onBuyItem: (item: ShoppingItem, product: Product) => void;
  onAddSuggestion: (product: Product) => void;
  onAddSuggestions: (productIds: string[]) => void;
}

export const ShoppingView: React.FC<ShoppingViewProps> = ({
  state: s,
  onRemoveItem,
  onBuyItem,
  onAddSuggestion,
  onAddSuggestions
}) => {
  const items = useMemo(() => s.shopping.filter((i) => i.status === 'open'), [s.shopping]);
  const productMap = useMemo(() => new Map(s.products.map((p) => [p.id, p])), [s.products]);
  const openItemProductIds = useMemo(() => new Set(items.map((i) => i.productId)), [items]);
  const suggestions = useMemo(() => {
    return s.products.filter((p) => !openItemProductIds.has(p.id) && D.isLow(s, p));
  }, [s, openItemProductIds]);

  return (
    <div className="shopping-view">
      <div className="view-section-heading">
        <h2>To pick up</h2>
        <span>
          {items.length} {items.length === 1 ? 'food' : 'foods'}
        </span>
      </div>

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
                    : `Planned: ${formatAmount(i.quantity ?? 1, p)}`}
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
          <h2>Your shopping list is clear</h2>
          <p>Add foods from your inventory or accept a suggestion below.</p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="view-section-heading suggestions-heading">
          <h2>Worth checking before you shop</h2>
          <div className="suggestion-controls">
            <span>
              {suggestions.length} {suggestions.length === 1 ? 'suggestion' : 'suggestions'}
            </span>
            {suggestions.length > 1 && (
              <button
                type="button"
                onClick={() => onAddSuggestions(suggestions.map((product) => product.id))}
              >
                Add all to list
              </button>
            )}
          </div>
        </div>
      )}

      {suggestions.map((p) => (
        <div key={p.id} className="shopping-row suggestion-row">
          <FoodIllustration product={p} />
          <div className="info">
            <h2>{p.name}</h2>
            <span className="meta">{formatAmount(D.total(s, p), p)} left</span>
          </div>
          <button data-action="shop" data-id={p.id} onClick={() => onAddSuggestion(p)}>
            Add to list
          </button>
        </div>
      ))}
    </div>
  );
};
