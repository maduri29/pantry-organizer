import { flushSync } from 'react-dom';
import React, { useState } from 'react';
import * as D from '../domain.ts';
import type { PantryState } from '../types.ts';
import { FoodIllustration } from './FoodIllustration.tsx';
import { formatAmount } from '../format.ts';
import { LevelPicker, QuantityInput } from './StockControls.tsx';

export const RestockTrip: React.FC<{
  state: PantryState;
  onClose: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void>;
}> = ({ state, onClose, onSubmit }) => {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const onList = new Set(
    state.shopping.filter((item) => item.status === 'open').map((item) => item.productId)
  );
  const products = [...state.products].sort(
    (a, b) => Number(onList.has(b.id)) - Number(onList.has(a.id)) || a.name.localeCompare(b.name)
  );
  const count = Object.values(selected).filter(Boolean).length;
  const checkedOffCount = products.filter(
    (product) => selected[product.id] && onList.has(product.id)
  ).length;
  const query = search.trim().toLocaleLowerCase();
  const matchesSearch = (product: (typeof products)[number]) =>
    product.name.toLocaleLowerCase().includes(query);
  const matches = products.filter(matchesSearch).length;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || count === 0) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(Object.fromEntries(new FormData(event.currentTarget)));
    } catch (err: any) {
      setError(err?.message || 'Could not save. Your selections are still here.');
      setBusy(false);
    }
  };

  return (
    <div className="stock-shell restock-trip">
      <header className="stock-heading">
        <div>
          <h2>Put away your groceries</h2>
          <p>Select what you bought. Check the amounts. Save once.</p>
        </div>
        <button
          type="button"
          className="stock-close"
          aria-label="Close restock"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="trip-search">
        <input
          aria-label="Find foods to restock"
          type="search"
          placeholder="Find a food…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span>{count} selected</span>
      </div>
      <form
        className="stock-form"
        onSubmit={submit}
        onInvalidCapture={(event) => {
          const field = event.target as HTMLInputElement;
          if (!field.closest('section[hidden]')) return;
          event.preventDefault();
          flushSync(() => setSearch(''));
          field.focus();
          field.reportValidity();
        }}
      >
        <div className="stock-body trip-body">
          {products.map((product) => {
            const checked = !!selected[product.id];
            const last = state.batches.filter((batch) => batch.productId === product.id).at(-1);
            const planned = state.shopping.find(
              (item) => item.productId === product.id && item.status === 'open'
            );
            const amount =
              amounts[product.id] ??
              String(product.unit === 'level' ? 1 : (planned?.quantity ?? 1));
            return (
              <section
                className={`bulk-item ${checked ? 'is-selected' : ''}`}
                key={product.id}
                hidden={!matchesSearch(product)}
              >
                <label className="bulk-pick">
                  <input
                    type="checkbox"
                    name={`picked-${product.id}`}
                    checked={checked}
                    disabled={busy}
                    onChange={(event) =>
                      setSelected((previous) => ({
                        ...previous,
                        [product.id]: event.target.checked
                      }))
                    }
                  />
                  <FoodIllustration product={product} />
                  <span>
                    <strong>{product.name}</strong>
                    <small>
                      {formatAmount(D.total(state, product), product)} on hand
                      {onList.has(product.id) ? ' · On your list' : ''}
                    </small>
                  </span>
                </label>
                <fieldset disabled={!checked || busy} hidden={!checked} className="trip-fields">
                  <legend>
                    {product.unit === 'level' ? 'Level after restocking' : 'Amount bought'}
                  </legend>
                  {product.unit === 'level' ? (
                    <LevelPicker
                      restock
                      name={`quantity-${product.id}`}
                      value={amount}
                      onChange={(value) =>
                        setAmounts((previous) => ({ ...previous, [product.id]: value }))
                      }
                    />
                  ) : (
                    <QuantityInput
                      restock
                      name={`quantity-${product.id}`}
                      value={amount}
                      unit={product.unit}
                      onChange={(value) =>
                        setAmounts((previous) => ({ ...previous, [product.id]: value }))
                      }
                    />
                  )}
                  <details className="stock-options">
                    <summary>
                      Store in {locations[product.id] ?? last?.location ?? 'Pantry'} · add a date
                    </summary>
                    <div className="two">
                      <label>
                        Store in
                        <select
                          name={`location-${product.id}`}
                          value={locations[product.id] ?? last?.location ?? 'Pantry'}
                          onChange={(event) =>
                            setLocations((previous) => ({
                              ...previous,
                              [product.id]: event.target.value
                            }))
                          }
                        >
                          {D.locations.map((place) => (
                            <option key={place}>{place}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Package date (optional)
                        <input type="date" name={`expiry-${product.id}`} />
                      </label>
                    </div>
                  </details>
                </fieldset>
              </section>
            );
          })}
          {matches === 0 && (
            <p className="trip-empty">
              No matching foods.{' '}
              <button type="button" onClick={() => setSearch('')}>
                Clear search
              </button>
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="stock-footer">
          <p className="stock-preview" role="status">
            {count
              ? `${count} ${count === 1 ? 'food' : 'foods'} to restock${checkedOffCount ? ` · ${checkedOffCount} checked off your list` : ''}`
              : 'Choose the foods you brought home'}
          </p>
          <div>
            <button type="button" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy || count === 0}>
              {busy ? 'Saving…' : 'Confirm restock'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
};
