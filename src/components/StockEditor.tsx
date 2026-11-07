import React, { useEffect, useRef, useState } from 'react';
import * as D from '../domain.ts';
import type { Batch, Location, PantryState, Product, ShoppingItem } from '../types.ts';
import { FoodIllustration } from './FoodIllustration.tsx';
import { fmt, formatAmount } from './InventoryView.tsx';

export const LevelPicker: React.FC<{
  name: string;
  value: string;
  onChange: (value: string) => void;
  restock?: boolean;
}> = ({ name, value, onChange, restock = false }) => (
  <div className="level-picker">
    {(restock ? [1, 0.5, 0.25] : [1, 0.5, 0.25, 0]).map((level) => (
      <label className={Number(value) === level && value !== '' ? 'is-selected' : ''} key={level}>
        <input
          type="radio"
          name={name}
          value={String(level)}
          checked={value === String(level)}
          onChange={() => onChange(String(level))}
          required
        />
        <svg aria-hidden="true" viewBox="0 0 24 28">
          <path className="level-vessel" d="M4 3h16v22H4z" />
          {level > 0 && <rect x="7" y={22 - level * 15} width="10" height={level * 15} />}
        </svg>
        <span>{D.level(level)}</span>
      </label>
    ))}
  </div>
);

export const QuantityInput: React.FC<{
  name: string;
  value: string;
  unit: string;
  onChange: (value: string) => void;
  restock?: boolean;
  id?: string;
}> = ({ name, value, unit, onChange, restock = false, id }) => (
  <div className="quantity-stepper">
    <button
      type="button"
      aria-label={`Decrease ${unit}`}
      disabled={!Number.isFinite(Number(value)) || Number(value) <= (restock ? 1 : 0)}
      onClick={() =>
        onChange(String(Math.max(restock ? 1 : 0, Number((Number(value) - 1).toFixed(3)))))
      }
    >
      −
    </button>
    <input
      id={id}
      aria-label={restock ? `Amount bought (${unit})` : `Amount left (${unit})`}
      name={name}
      type="number"
      inputMode="decimal"
      min={restock ? '0.000001' : '0'}
      step="any"
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    <span>
      {Number(value) === 1 && (unit === 'items' || unit === 'packs') ? unit.slice(0, -1) : unit}
    </span>
    <button
      type="button"
      aria-label={`Increase ${unit}`}
      onClick={() => onChange(String(Number((Number(value || 0) + 1).toFixed(3))))}
    >
      +
    </button>
  </div>
);

export const StockEditor: React.FC<{
  state: PantryState;
  product: Product;
  batch?: Batch;
  shoppingItem?: ShoppingItem;
  initialAction: 'update' | 'restock';
  onSubmit: (values: Record<string, any>) => Promise<void>;
  onClose: () => void;
  onDetails?: () => void;
  onDelete?: () => void;
}> = ({
  state,
  product,
  batch,
  shoppingItem,
  initialAction,
  onSubmit,
  onClose,
  onDetails,
  onDelete
}) => {
  const allBatches = state.batches.filter((item) => item.productId === product.id);
  const activeBatches = allBatches.filter((item) => item.quantity > 0 || item.id === batch?.id);
  const batches = activeBatches.length ? activeBatches : allBatches.slice(-1);
  const latest = batch ?? allBatches.at(-1);
  const [action, setAction] = useState(initialAction);
  const batchId = batch?.id;
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const field =
        action === 'update' && batchId
          ? shellRef.current?.querySelector<HTMLInputElement>(
              `[name="quantity-${batchId}"]:checked, #stock-quantity-${batchId}`
            )
          : shellRef.current?.querySelector<HTMLInputElement>(
              '.stock-mode:not([hidden]) input:checked, .stock-mode:not([hidden]) .quantity-stepper input'
            );
      field?.focus({ preventScroll: true });
      field?.closest('fieldset')?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [action, batchId]);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(batches.map((item) => [item.id, String(item.quantity)]))
  );
  const openItem =
    shoppingItem ??
    state.shopping.find((item) => item.productId === product.id && item.status === 'open');
  const [quantity, setQuantity] = useState(
    String(product.unit === 'level' ? 1 : (openItem?.quantity ?? 1))
  );
  const [location, setLocation] = useState<Location>(latest?.location ?? 'Pantry');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = D.total(state, product);
  const nextAmounts = allBatches.map((item) =>
    amounts[item.id] === undefined ? item.quantity : Number(amounts[item.id])
  );
  const afterUpdate =
    product.unit === 'level'
      ? Math.max(0, ...nextAmounts)
      : nextAmounts.reduce((sum, n) => sum + n, 0);
  const validPreview =
    action === 'update'
      ? Object.values(amounts).every(
          (value) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
        )
      : quantity.trim() !== '' && Number.isFinite(Number(quantity)) && Number(quantity) > 0;
  const locationBefore = Math.max(
    0,
    ...allBatches.filter((item) => item.location === location).map((item) => item.quantity)
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        ...Object.fromEntries(new FormData(event.currentTarget)),
        'stock-action': action
      });
    } catch (err: any) {
      setError(err?.message || 'Could not save. Your changes are still here.');
      setBusy(false);
    }
  };

  return (
    <div className="stock-shell" ref={shellRef}>
      <header className="stock-heading">
        <FoodIllustration product={product} />
        <div>
          <h2>{product.name}</h2>
          <p>{formatAmount(current, product)} on hand</p>
        </div>
        <button
          type="button"
          className="stock-close"
          aria-label="Close stock editor"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div
        className={`stock-intents ${onDetails ? 'unified-intents' : ''}`}
        role="group"
        aria-label="Stock action"
      >
        <button
          type="button"
          aria-pressed={action === 'update'}
          disabled={busy}
          onClick={() => {
            setAction('update');
            setError('');
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4 4L19 6M4 21h16" />
          </svg>
          What’s left
        </button>
        <button
          type="button"
          aria-pressed={action === 'restock'}
          disabled={busy}
          onClick={() => {
            setAction('restock');
            setError('');
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 8h14l2 12H3L5 8Zm3 0V6a4 4 0 0 1 8 0v2M12 11v6m-3-3h6" />
          </svg>
          I bought more
        </button>
        {onDetails && (
          <button type="button" disabled={busy} onClick={onDetails}>
            Details
          </button>
        )}
      </div>
      <form
        className="stock-form"
        onSubmit={submit}
        onInvalidCapture={(event) => {
          const field = event.target as HTMLInputElement;
          const details = field.closest<HTMLDetailsElement>('details:not([open])');
          if (!details) return;
          event.preventDefault();
          details.open = true;
          field.focus();
          field.reportValidity();
        }}
      >
        <div className="stock-body">
          <fieldset
            className="stock-mode"
            hidden={action !== 'update'}
            disabled={action !== 'update' || busy}
          >
            <p className="stock-instruction">Set what’s on the shelf now.</p>
            {batches.length === 0 && (
              <p>No stock recorded yet. Choose “I bought more” to add some.</p>
            )}
            {batches.map((item, index) => (
              <fieldset className="stock-batch" key={item.id} disabled={busy}>
                <legend>
                  {item.location}
                  {batches.length > 1 ? ` · batch ${index + 1}` : ''}
                </legend>
                {item.expiry && (
                  <p className={`stock-date ${D.expiryDays(item.expiry) <= 3 ? 'warn' : ''}`}>
                    Package date · {item.expiry}
                  </p>
                )}
                {product.unit === 'level' ? (
                  <LevelPicker
                    name={`quantity-${item.id}`}
                    value={amounts[item.id] ?? ''}
                    onChange={(value) =>
                      setAmounts((previous) => ({ ...previous, [item.id]: value }))
                    }
                  />
                ) : (
                  <QuantityInput
                    id={`stock-quantity-${item.id}`}
                    name={`quantity-${item.id}`}
                    unit={product.unit}
                    value={amounts[item.id] ?? ''}
                    onChange={(value) =>
                      setAmounts((previous) => ({ ...previous, [item.id]: value }))
                    }
                  />
                )}
                {product.unit !== 'level' && (
                  <button
                    type="button"
                    className="stock-empty-button"
                    disabled={busy || amounts[item.id] === '0'}
                    onClick={() => setAmounts((previous) => ({ ...previous, [item.id]: '0' }))}
                  >
                    All used up
                  </button>
                )}
                <details className="stock-options">
                  <summary>Location &amp; package date</summary>
                  <div className="two">
                    <label>
                      Store in
                      <select name={`location-${item.id}`} defaultValue={item.location}>
                        {D.locations.map((place) => (
                          <option key={place}>{place}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Package date
                      <input
                        type="date"
                        name={`expiry-${item.id}`}
                        defaultValue={item.expiry ?? ''}
                      />
                    </label>
                  </div>
                </details>
              </fieldset>
            ))}
          </fieldset>
          <fieldset
            className="stock-mode"
            hidden={action !== 'restock'}
            disabled={action !== 'restock' || busy}
          >
            <fieldset className="stock-purchase" disabled={busy}>
              <legend>
                {product.unit === 'level' ? 'Level after restocking' : 'How much did you buy?'}
              </legend>
              {product.unit === 'level' ? (
                <LevelPicker restock name="quantity" value={quantity} onChange={setQuantity} />
              ) : (
                <QuantityInput
                  restock
                  name="quantity"
                  unit={product.unit}
                  value={quantity}
                  onChange={setQuantity}
                />
              )}
            </fieldset>
            <label>
              Store in
              <select
                name="location"
                value={location}
                onChange={(event) => setLocation(event.target.value as Location)}
              >
                {D.locations.map((place) => (
                  <option key={place}>{place}</option>
                ))}
              </select>
            </label>
            <details className="stock-options">
              <summary>Add a package date</summary>
              <label>
                Package date (optional)
                <input name="expiry" type="date" />
              </label>
            </details>
            <p className="stock-help">
              {product.unit === 'level'
                ? `Sets the level in ${location}. Other locations keep their levels.`
                : 'Adds to your current stock. The new purchase keeps its own package date.'}
            </p>
            {openItem && (
              <p className="stock-list-note">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
                Also checks this off your shopping list.
              </p>
            )}
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="stock-footer">
          {onDelete && (
            <button
              className="food-delete-action"
              type="button"
              aria-label={`Delete ${product.name}`}
              title={`Delete ${product.name}`}
              onClick={onDelete}
              disabled={busy}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5" />
              </svg>
              Delete food
            </button>
          )}
          <p className="stock-preview" role="status">
            {validPreview &&
              (action === 'update'
                ? `${formatAmount(current, product)} → ${formatAmount(afterUpdate, product)}`
                : product.unit === 'level'
                  ? `${location}: ${D.level(locationBefore)} → ${D.level(Number(quantity))}`
                  : `${fmt(current)} + ${fmt(Number(quantity))} = ${formatAmount(current + Number(quantity), product)}`)}
          </p>
          <div>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              className="primary"
              type="submit"
              disabled={busy || (action === 'update' && batches.length === 0)}
            >
              {busy ? 'Saving…' : action === 'update' ? 'Save stock' : 'Add to pantry'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
};
