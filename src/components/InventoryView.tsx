import React, { useMemo } from 'react';
import * as D from '../domain.ts';
import type { Batch, PantryState, Product } from '../types.ts';

interface InventoryViewProps {
  state: PantryState;
  online: boolean;
  search: string;
  location: string;
  category: string;
  sort: string;
  filter: 'all' | 'soon' | 'low';
  onSearchChange: (search: string) => void;
  onLocationChange: (location: string) => void;
  onCategoryChange: (category: string) => void;
  onSortChange: (sort: string) => void;
  onClearFilter: () => void;
  onAddFood: () => void;
  onTrySample: () => void;
  onCheckStock: (batch: Batch, product: Product) => void;
  onRestock: (product: Product) => void;
  onEditSettings: (product: Product) => void;
  onDelete: (product: Product) => void;
  onAddToList: (product: Product) => void;
}

export const icon = (p: { category: string }): string =>
  ({
    Vegetables: '🥬',
    Fruit: '🍋',
    'Grains & pulses': '🌾',
    'Dairy & eggs': '🥛',
    'Meat & fish': '🐟',
    Snacks: '🥨',
    Other: '🫙'
  })[p.category] || '🫙';

export const fmt = (n: number): string => Number(n.toFixed(3)).toLocaleString();

export const formatAmount = (n: number, p: Product): string =>
  p.unit === 'level' ? D.level(n) : `${fmt(n)} ${p.unit}`;

export const InventoryView: React.FC<InventoryViewProps> = ({
  state: s,
  online,
  search,
  location,
  category,
  sort,
  filter,
  onSearchChange,
  onLocationChange,
  onCategoryChange,
  onSortChange,
  onClearFilter,
  onAddFood,
  onTrySample,
  onCheckStock,
  onRestock,
  onEditSettings,
  onDelete,
  onAddToList
}) => {
  const allCategories = useMemo(() => {
    return [...new Set([...D.categories, ...s.products.map((p) => p.category)])].sort();
  }, [s.products]);

  const { productBatches, productTotals, productIsLow, minExpiryDays, openShoppingIds } =
    useMemo(() => {
      const pBatches = new Map<string, Batch[]>();
      const pTotals = new Map<string, number>();
      const pIsLow = new Map<string, boolean>();
      const pExpiry = new Map<string, number>();

      for (const b of s.batches) {
        if (b.quantity > 0) {
          const list = pBatches.get(b.productId);
          if (list) list.push(b);
          else pBatches.set(b.productId, [b]);
        }
      }

      for (const [pId, batches] of pBatches.entries()) {
        batches.sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
        let minExp = Infinity;
        for (const b of batches) {
          const exp = D.expiryDays(b.expiry);
          if (exp < minExp) minExp = exp;
        }
        pExpiry.set(pId, minExp);
      }

      for (const p of s.products) {
        const tot = D.total(s, p);
        pTotals.set(p.id, tot);
        pIsLow.set(p.id, D.isLow(s, p));
      }

      const openShop = new Set<string>();
      for (const item of s.shopping) {
        if (item.status === 'open') {
          openShop.add(item.productId);
        }
      }

      return {
        productBatches: pBatches,
        productTotals: pTotals,
        productIsLow: pIsLow,
        minExpiryDays: pExpiry,
        openShoppingIds: openShop
      };
    }, [s]);

  const items = useMemo(() => {
    const term = search.toLowerCase();
    return s.products
      .filter((p) => {
        if (term && !p.name.toLowerCase().includes(term)) return false;
        if (category !== 'all' && p.category !== category) return false;
        if (
          location !== 'all' &&
          !(productBatches.get(p.id)?.some((b) => b.location === location) ?? false)
        ) {
          return false;
        }
        if (filter === 'low') return productIsLow.get(p.id) ?? false;
        if (filter === 'soon') return (minExpiryDays.get(p.id) ?? Infinity) <= 3;
        return true;
      })
      .sort((a, b) => {
        if (sort === 'category') {
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        }
        if (sort === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sort === 'low') {
          const lowDiff =
            Number(productIsLow.get(b.id) ?? false) - Number(productIsLow.get(a.id) ?? false);
          return lowDiff || a.name.localeCompare(b.name);
        }
        const aExp = minExpiryDays.get(a.id) ?? Infinity;
        const bExp = minExpiryDays.get(b.id) ?? Infinity;
        return aExp - bExp;
      });
  }, [
    s.products,
    search,
    category,
    location,
    filter,
    sort,
    productBatches,
    productIsLow,
    minExpiryDays
  ]);

  return (
    <>
      <div className="toolbar">
        <input
          id="search"
          aria-label="Search food"
          placeholder="Search your pantry…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
        />
        <select
          id="location"
          aria-label="Storage location"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
        >
          <option value="all">All locations</option>
          {D.locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
        <select
          id="category"
          aria-label="Food category"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="all">All categories</option>
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          id="sort"
          aria-label="Sort foods"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
        >
          <option value="category">By category</option>
          <option value="name">A to Z</option>
          <option value="low">Low stock first</option>
          <option value="expiry">Soonest date</option>
        </select>
        {filter !== 'all' && (
          <button data-filter="all" onClick={onClearFilter}>
            Clear filter
          </button>
        )}
      </div>

      <div className="grid">
        {items.length > 0 ? (
          items.map((p, index) => {
            const heading =
              sort === 'category' && (index === 0 || items[index - 1].category !== p.category) ? (
                <h2 key={`cat-${p.category}`} className="category-heading">
                  {p.category}
                </h2>
              ) : null;

            const batches = productBatches.get(p.id) || [];
            const isOnShopping = openShoppingIds.has(p.id);
            const totalQty = productTotals.get(p.id) ?? 0;
            const itemIsLow = productIsLow.get(p.id) ?? false;

            return (
              <React.Fragment key={p.id}>
                {heading}
                <article className="card">
                  <div className="card-top">
                    <div className="food" aria-hidden="true">
                      {icon(p)}
                    </div>
                    <div>
                      <h2>{p.name}</h2>
                      <span className="meta">{p.category}</span>
                    </div>
                  </div>

                  <div className="amount">
                    {p.unit === 'level' ? (
                      D.level(totalQty)
                    ) : (
                      <>
                        {fmt(totalQty)} <small>{p.unit}</small>
                      </>
                    )}
                  </div>

                  <span className={`badge ${itemIsLow ? 'warn' : ''}`}>
                    {totalQty === 0 ? 'Out of stock' : itemIsLow ? 'Running low' : 'Stocked up'}
                    {p.unit === 'level' ? '' : ` · min ${fmt(p.minimum)} ${p.unit}`}
                  </span>

                  {batches.map((b) => {
                    const days = D.expiryDays(b.expiry);
                    return (
                      <div key={b.id} className="batch">
                        <div>
                          {formatAmount(b.quantity, p)} · {b.location}
                          <br />
                          <span className="meta">
                            Checked{' '}
                            {b.checkedAt ? new Date(b.checkedAt).toLocaleDateString() : 'not yet'}
                          </span>
                          {b.expiry && (
                            <>
                              <br />
                              <span
                                className={`badge ${
                                  days < 0 ? 'expired' : days <= 3 ? 'warn' : ''
                                }`}
                              >
                                {days < 0
                                  ? `Date passed ${-days}d ago`
                                  : days === 0
                                    ? 'Due today'
                                    : `Due ${b.expiry}`}
                              </span>
                            </>
                          )}
                        </div>
                        <button
                          data-action="use"
                          data-id={b.id}
                          aria-label={`Check stock for ${p.name} in ${b.location}`}
                          title={`Check stock for ${p.name} in ${b.location}`}
                          onClick={() => onCheckStock(b, p)}
                        >
                          Check stock
                        </button>
                      </div>
                    );
                  })}

                  <div className="card-foot">
                    <button
                      className="icon-action"
                      data-action="restock"
                      data-id={p.id}
                      aria-label={`Restock ${p.name}`}
                      title={`Restock ${p.name}`}
                      onClick={() => onRestock(p)}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                    <button
                      className="icon-action"
                      data-action="minimum"
                      data-id={p.id}
                      aria-label={`Edit settings for ${p.name}`}
                      title={`Edit settings for ${p.name}`}
                      onClick={() => onEditSettings(p)}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4" />
                      </svg>
                    </button>
                    <button
                      className="icon-action danger"
                      data-action="delete"
                      data-id={p.id}
                      aria-label={`Delete ${p.name}`}
                      title={`Delete ${p.name}`}
                      onClick={() => onDelete(p)}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M3 6h18m-2 0-1 14H6L5 6m4 0V4h6v2m-5 4v7m4-7v7" />
                      </svg>
                    </button>
                    <button
                      className="icon-action"
                      data-action="shop"
                      data-id={p.id}
                      aria-label={
                        isOnShopping
                          ? `${p.name} already on shopping list`
                          : `Add ${p.name} to shopping list`
                      }
                      title={
                        isOnShopping
                          ? `${p.name} already on shopping list`
                          : `Add ${p.name} to shopping list`
                      }
                      disabled={isOnShopping}
                      onClick={() => onAddToList(p)}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M3 4h2l2.5 12h11L21 8H6m3 12h.01M17 20h.01M12 6v6m-3-3h6" />
                      </svg>
                    </button>
                  </div>
                </article>
              </React.Fragment>
            );
          })
        ) : (
          <div className="empty">
            <div className="food" style={{ margin: 'auto' }}>
              🫙
            </div>
            <h2>{s.products.length ? 'No matching foods' : 'Make room for a calmer kitchen'}</h2>
            <p>
              {s.products.length
                ? 'Try another search or clear your filters.'
                : 'Start with a few things you already have. You can add the rest as you go.'}
            </p>
            <button className="primary" data-action="add" onClick={onAddFood}>
              Add your first food
            </button>{' '}
            {!online && !s.products.length && (
              <button data-action="demo" onClick={onTrySample}>
                Try sample pantry
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
