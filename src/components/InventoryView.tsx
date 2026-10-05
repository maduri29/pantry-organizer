import React, { useMemo } from 'react';
import * as D from '../domain.ts';
import type { Batch, PantryState, Product } from '../types.ts';
import { FoodIllustration } from './FoodIllustration.tsx';

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
  onShowNeeds: () => void;
  onAddFood: () => void;
  onTrySample: () => void;
  onManage: (product: Product, section: 'details' | 'stock', batch?: Batch) => void;
  onAddToList: (product: Product) => void;
}

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
  onShowNeeds,
  onAddFood,
  onTrySample,
  onManage,
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

  const needsAttention = useMemo(
    () =>
      s.products
        .filter((product) => productIsLow.get(product.id) ?? false)
        .sort((a, b) => {
          const outDifference =
            Number((productTotals.get(b.id) ?? 0) === 0) -
            Number((productTotals.get(a.id) ?? 0) === 0);
          return outDifference || a.name.localeCompare(b.name);
        }),
    [s.products, productIsLow, productTotals]
  );
  const outCount = needsAttention.filter((product) => (productTotals.get(product.id) ?? 0) === 0).length;
  const runningLowCount = needsAttention.length - outCount;

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
      {s.products.length > 0 && (
        <section className="shopping-glance" aria-labelledby="shopping-glance-title">
          <div className="glance-heading">
            <span className="glance-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 8h14v11H5zM8 8V5h8v3m-8 5h.01M12 13h.01M16 13h.01" /></svg>
            </span>
            <div>
              <span className="glance-eyebrow">A QUICK LOOK BEFORE YOU SHOP</span>
              <h2 id="shopping-glance-title">Shopping glance</h2>
            </div>
          </div>
          <div className="glance-counts" aria-live="polite">
            <span><i className="glance-dot out" /><strong>{outCount}</strong> out</span>
            <span><i className="glance-dot low" /><strong>{runningLowCount}</strong> running low</span>
            <span className="glance-context">From your latest stock checks</span>
          </div>
          {needsAttention.length ? (
            <div className="glance-items">
              {needsAttention.slice(0, 4).map((product) => {
                const isOut = (productTotals.get(product.id) ?? 0) === 0;
                return (
                  <div className="glance-item" key={product.id}>
                    <FoodIllustration product={product} />
                    <div className="glance-item-copy">
                      <strong>{product.name}</strong>
                      <span className={`glance-status ${isOut ? 'is-out' : 'is-low'}`}>
                        {isOut ? 'Out' : 'Running low'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="glance-clear">Everything looks stocked for now.</p>
          )}
          <div className="glance-footer">
            <span>
              {needsAttention.length > 4
                ? `${needsAttention.length - 4} more need attention`
                : needsAttention.length
                  ? 'Your list of items to check'
                  : 'You’re up to date'}
            </span>
            <button
              type="button"
              className="glance-link"
              onClick={() => {
                onSearchChange('');
                onCategoryChange('all');
                onLocationChange('all');
                if (needsAttention.length) onShowNeeds();
                else onClearFilter();
              }}
            >
              {needsAttention.length ? `See all ${needsAttention.length} items` : 'See your pantry'}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
            </button>
          </div>
        </section>
      )}

      <div className="inventory-heading">
        <div>
          <span className="inventory-eyebrow">YOUR KITCHEN</span>
          <h2>Take a look around</h2>
        </div>
        <span className="inventory-note">Grouped by shelf</span>
      </div>
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

      <div className="grid shelf-grid">
        {items.length > 0 ? (
          items.map((p, index) => {
            const heading =
              sort === 'category' && (index === 0 || items[index - 1].category !== p.category) ? (
                <div key={`cat-${p.category}`} className="category-heading">
                  <div>
                    <span className="shelf-kicker">SHELF</span>
                    <h2>{p.category}</h2>
                  </div>
                  <span className="category-count">
                    {items.filter((item) => item.category === p.category).length}{' '}
                    {items.filter((item) => item.category === p.category).length === 1 ? 'food' : 'foods'}
                  </span>
                </div>
              ) : null;

            const batches = productBatches.get(p.id) || [];
            const isOnShopping = openShoppingIds.has(p.id);
            const totalQty = productTotals.get(p.id) ?? 0;
            const itemIsLow = productIsLow.get(p.id) ?? false;

            return (
              <React.Fragment key={p.id}>
                {heading}
                <article className={`card shelf-card ${totalQty === 0 ? 'is-out' : itemIsLow ? 'is-low' : 'is-ready'}`}>
                  <div className="card-top">
                  <FoodIllustration product={p} />
                    <div>
                      <h2>{p.name}</h2>
                      <span className="meta">{p.category}</span>
                    </div>
                  </div>

                  {batches.length === 1 ? (
                    <button
                      className="amount amount-update"
                      data-action="use"
                      data-id={batches[0].id}
                      aria-label={`Update stock for ${p.name}`}
                      title={`Update stock for ${p.name}`}
                      onClick={() => onManage(p, 'stock', batches[0])}
                    >
                      <span>{p.unit === 'level' ? D.level(totalQty) : <>{fmt(totalQty)} <small>{p.unit}</small></>}</span>
                      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" /></svg>
                    </button>
                  ) : (
                    <div className="amount" aria-label={`Quantity: ${formatAmount(totalQty, p)}`}>
                      {p.unit === 'level' ? D.level(totalQty) : <>{fmt(totalQty)} <small>{p.unit}</small></>}
                    </div>
                  )}

                  <span className={`badge stock-status ${itemIsLow ? 'warn' : ''}`}>
                    {totalQty === 0 ? 'Out' : itemIsLow ? 'Low' : 'Stocked'}
                    {totalQty > 0 && itemIsLow && p.unit !== 'level' ? ` · min ${fmt(p.minimum)} ${p.unit}` : ''}
                  </span>

                  {batches.length === 1 && (() => {
                    const batch = batches[0];
                    const days = D.expiryDays(batch.expiry);
                    return (
                      <div className="stock-line single-batch">
                        <span className="stock-location">{batch.location}</span>
                        {batch.expiry && (
                          <span className={`badge expiry-status ${days < 0 ? 'expired' : days <= 3 ? 'warn' : ''}`}>
                            {days < 0 ? `Passed ${-days}d ago` : days === 0 ? 'Due today' : `Due ${batch.expiry}`}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {batches.length > 1 && (
                    <details className="batch-details">
                      <summary>{batches.length} batches · {Array.from(new Set(batches.map((batch) => batch.location))).join(', ')}</summary>
                      <div className="batch-list">
                        {batches.map((batch) => {
                          const days = D.expiryDays(batch.expiry);
                          return (
                            <div key={batch.id} className="batch-line">
                              <span className="batch-location">
                                <strong>{formatAmount(batch.quantity, p)}</strong> · {batch.location}
                                {batch.expiry && (
                                  <span className={`badge expiry-status ${days < 0 ? 'expired' : days <= 3 ? 'warn' : ''}`}>
                                    {days < 0 ? `Passed ${-days}d ago` : days === 0 ? 'Due today' : `Due ${batch.expiry}`}
                                  </span>
                                )}
                              </span>
                              <button
                                className="stock-update"
                                data-action="use"
                                data-id={batch.id}
                                aria-label={`Update stock for ${p.name} in ${batch.location}`}
                                title={`Update stock for ${p.name} in ${batch.location}`}
                                onClick={() => onManage(p, 'stock', batch)}
                              >
                                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                                <span>Update</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  <div className="card-foot">
                    <button
                      className="icon-action"
                      data-action="manage"
                      data-id={p.id}
                      aria-label={`Manage ${p.name}`}
                      title={`Manage ${p.name}`}
                      onClick={() => onManage(p, 'stock')}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M4 5h16v14H4zM8 9h8m-8 4h5M18 3v4M6 17v4" />
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
