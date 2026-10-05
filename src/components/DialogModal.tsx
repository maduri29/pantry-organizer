import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as D from '../domain.ts';
import type { Batch, CategorySuggestion, PantryState, Product, ShoppingItem } from '../types.ts';
import { formatAmount } from './InventoryView.tsx';

export type ModalType =
  | 'add'
  | 'use'
  | 'minimum'
  | 'manage'
  | 'restock'
  | 'buy'
  | 'delete'
  | 'bulk'
  | 'connect_missing'
  | 'connect_auth';

export interface ModalState {
  type: ModalType;
  revision: number;
  section?: 'details' | 'stock';
  product?: Product;
  batch?: Batch;
  shoppingItem?: ShoppingItem;
}

interface DialogModalProps {
  modal: ModalState | null;
  state: PantryState;
  onClose: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  onSuggestCategory?: (
    name: string,
    categories: string[],
    signal: AbortSignal
  ) => Promise<CategorySuggestion>;
}

interface ModalFormContentProps {
  modal: ModalState;
  state: PantryState;
  onClose: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  onSuggestCategory?: (
    name: string,
    categories: string[],
    signal: AbortSignal
  ) => Promise<CategorySuggestion>;
}

const CategoryField: React.FC<{
  categories: string[];
  initialCategory: string;
  itemName?: string;
  onSuggestCategory?: (
    name: string,
    categories: string[],
    signal: AbortSignal
  ) => Promise<CategorySuggestion>;
}> = ({ categories, initialCategory, itemName = '', onSuggestCategory }) => {
  const initialIndex = categories.indexOf(initialCategory);
  const [selection, setSelection] = useState(
    initialIndex >= 0 ? `existing:${encodeURIComponent(initialCategory)}` : 'new'
  );
  const [customCategory, setCustomCategory] = useState(initialIndex >= 0 ? '' : initialCategory);
  const [suggestion, setSuggestion] = useState<{ name: string; result: CategorySuggestion } | null>(
    null
  );
  const [suggestingName, setSuggestingName] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<{ name: string; message: string } | null>(
    null
  );
  const controller = useRef<AbortController | null>(null);
  const nameRef = useRef(itemName);

  useLayoutEffect(() => {
    nameRef.current = itemName.trim();
    controller.current?.abort();
    controller.current = null;
  }, [itemName]);
  useEffect(() => () => controller.current?.abort(), []);

  const requestSuggestion = async () => {
    if (!onSuggestCategory || !itemName.trim()) return;
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    setSuggestingName(itemName);
    setSuggestionError(null);
    try {
      const requestedName = itemName.trim();
      const result = await onSuggestCategory(requestedName, categories, requestController.signal);
      if (!requestController.signal.aborted && nameRef.current === requestedName) {
        setSuggestion({ name: requestedName, result });
      }
    } catch (error) {
      if (!requestController.signal.aborted) {
        setSuggestionError({
          name: itemName.trim(),
          message:
            error instanceof Error ? error.message : 'Could not suggest a category right now.'
        });
      }
    } finally {
      if (!requestController.signal.aborted) setSuggestingName(null);
    }
  };

  const useSuggestion = () => {
    const currentSuggestion = suggestion?.name === itemName.trim() ? suggestion.result : null;
    if (!currentSuggestion) return;
    setSelection(`existing:${encodeURIComponent(currentSuggestion.category)}`);
    setCustomCategory('');
  };

  const currentSuggestion = suggestion?.name === itemName.trim() ? suggestion.result : null;
  const currentError = suggestionError?.name === itemName.trim() ? suggestionError.message : '';
  const suggesting = suggestingName === itemName;

  return (
    <>
      <label>
        Category
        <select
          name="category-choice"
          value={selection}
          onChange={(event) => setSelection(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category} value={`existing:${encodeURIComponent(category)}`}>
              {category}
            </option>
          ))}
          <option value="new">Add a custom category…</option>
        </select>
      </label>
      {selection === 'new' && (
        <label>
          Custom category
          <input
            name="category-custom"
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
            maxLength={60}
            required
            autoComplete="off"
            placeholder="e.g. Baking supplies"
          />
        </label>
      )}
      {onSuggestCategory && (
        <div className="category-suggestion">
          <button
            type="button"
            aria-label="Suggest category with Jev"
            onClick={() => void requestSuggestion()}
            disabled={!itemName.trim() || suggesting}
          >
            {suggesting ? 'Suggesting…' : 'Suggest category'}
          </button>
          {currentSuggestion && (
            <div className="category-suggestion-result" role="status">
              <span>
                Jev suggests <strong>{currentSuggestion.category}</strong> ·{' '}
                {Math.round(currentSuggestion.confidence * 100)}% confidence
              </span>
              <button type="button" onClick={useSuggestion}>
                Use {currentSuggestion.category}
              </button>
            </div>
          )}
          {currentError && (
            <span className="error" role="status">
              {currentError}
            </span>
          )}
        </div>
      )}
    </>
  );
};

const ModalFormContent: React.FC<ModalFormContentProps> = ({
  modal,
  state: s,
  onClose,
  onSubmit,
  onSuggestCategory
}) => {
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [trackingUnit, setTrackingUnit] = useState<string>(modal.product?.unit ?? 'level');
  const [pickedIds, setPickedIds] = useState<Record<string, boolean>>({});
  const [foodName, setFoodName] = useState(modal.product?.name ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [batchQuantities, setBatchQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      s.batches
        .filter((batch) => batch.productId === modal.product?.id)
        .map((batch) => [batch.id, String(batch.quantity)])
    )
  );

  const allCategories = useMemo(() => {
    return [...new Set([...D.categories, ...s.products.map((p) => p.category)])].sort();
  }, [s.products]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    const values = Object.fromEntries(formData.entries());
    if (values['category-choice'] !== undefined) {
      const choice = String(values['category-choice']);
      values.category =
        choice === 'new'
          ? String(values['category-custom'] ?? '').trim()
          : choice.startsWith('existing:')
            ? decodeURIComponent(choice.slice('existing:'.length))
            : '';
      delete values['category-choice'];
      delete values['category-custom'];
      if (!values.category) {
        setError('Enter a category name.');
        setBusy(false);
        return;
      }
    }

    try {
      await onSubmit(values);
    } catch (err: any) {
      setError(err?.message || 'An error occurred.');
      setBusy(false);
    }
  };

  const handleCancelClick = () => {
    onClose();
  };

  const { type, product: p, batch: b, shoppingItem: i } = modal;

  if (type === 'add') {
    return (
      <>
        <h2>Add something good</h2>
        <p>Use a rough level, or choose exact quantities when useful.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Food name
            <input
              name="name"
              value={foodName}
              onChange={(event) => setFoodName(event.target.value)}
              required
              maxLength={80}
              placeholder="e.g. Eggs"
            />
          </label>
          <label>
            Tracking
            <select
              name="unit"
              id="tracking"
              value={trackingUnit}
              onChange={(e) => setTrackingUnit(e.target.value)}
            >
              {D.units.map((u) => (
                <option key={u} value={u}>
                  {u === 'level' ? 'Rough level (recommended)' : u}
                </option>
              ))}
            </select>
          </label>

          <div id="quantity-field">
            {trackingUnit === 'level' ? (
              <label>
                What’s left?
                <select name="quantity" defaultValue="1">
                  <option value="1">Full</option>
                  <option value="0.5">Half</option>
                  <option value="0.25">Low</option>
                  <option value="0">Out</option>
                </select>
              </label>
            ) : (
              <label>
                Amount
                <input
                  name="quantity"
                  type="number"
                  min="0.000001"
                  step="any"
                  required
                  defaultValue="1"
                />
              </label>
            )}
          </div>

          <div className="two">
            <CategoryField
              categories={allCategories}
              initialCategory="Other"
              itemName={foodName}
              onSuggestCategory={onSuggestCategory}
            />
            <label id="minimum-field" hidden={trackingUnit === 'level'}>
              Low-stock minimum
              <input name="minimum" type="number" min="0" step="any" defaultValue="0" />
            </label>
          </div>

          <div className="two">
            <label>
              Store in
              <select name="location" defaultValue="Pantry">
                {D.locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date on package (optional)
              <input name="expiry" type="date" />
            </label>
          </div>

          <div className="error" role="alert">
            {error}
          </div>
          <div className="actions">
            <button type="button" id="cancel" onClick={handleCancelClick} disabled={busy}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              Add food
            </button>
          </div>
        </form>
      </>
    );
  }

  if (type === 'manage' && p) {
    const batches = s.batches.filter((batch) => batch.productId === p.id);
    const jumpTo = (id: string) =>
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const submitDelete = async () => {
      setError('');
      setBusy(true);
      try {
        await onSubmit({ 'manage-action': 'delete' });
      } catch (err: any) {
        setError(err?.message || 'Could not delete this item.');
        setBusy(false);
      }
    };

    return (
      <>
        <div className="manage-heading">
          <div>
            <span className="manage-kicker">ITEM WORKSPACE</span>
            <h2>Manage {p.name}</h2>
          </div>
          <button type="button" className="manage-close" aria-label="Close manage item" onClick={onClose} disabled={busy}>×</button>
        </div>
        <p className="manage-intro">Edit item details and keep every location’s stock up to date in one place.</p>
        <nav className="manage-jump" aria-label="Manage item sections">
          <button type="button" onClick={() => jumpTo('manage-details')}>Item details</button>
          <button type="button" onClick={() => jumpTo('manage-stock')}>Stock and locations</button>
        </nav>
        <form className="manage-form" onSubmit={handleSubmit}>
          <input type="hidden" name="manage-action" value="save" />
          <section className="manage-section" id="manage-details" aria-labelledby="manage-details-heading">
            <h3 id="manage-details-heading" tabIndex={-1}>Item details</h3>
            <label>
              Food name
              <input name="name" value={foodName} onChange={(event) => setFoodName(event.target.value)} maxLength={80} required autoComplete="off" />
            </label>
            <CategoryField
              categories={allCategories}
              initialCategory={p.category}
              itemName={foodName}
              onSuggestCategory={onSuggestCategory}
            />
            <label>
              Tracking and unit
              <select
                name="unit"
                value={trackingUnit}
                onChange={(event) => {
                  const nextUnit = event.target.value;
                  if (nextUnit === 'level' && trackingUnit !== 'level') {
                    setBatchQuantities(Object.fromEntries(batches.map((batch) => [batch.id, ''])));
                  }
                  setTrackingUnit(nextUnit);
                }}
              >
                {D.units.map((unit) => (
                  <option key={unit} value={unit}>{unit === 'level' ? 'Rough level' : `Exact · ${unit}`}</option>
                ))}
              </select>
            </label>
            {trackingUnit !== p.unit && batches.some((batch) => batch.quantity > 0) && (
              <p className="manage-note" role="status">Changing tracking relabels current amounts. Review each batch in Stock and locations before saving.</p>
            )}
            {trackingUnit === 'level' ? (
              <>
                <input type="hidden" name="minimum" value="0.25" />
                <p className="manage-note">Rough levels use Full, Half, Low, and Out.</p>
              </>
            ) : (
              <label>
                Shop when below ({trackingUnit})
                <input name="minimum" type="number" min="0" step="any" required defaultValue={String(p.minimum)} />
              </label>
            )}
          </section>

          <section className="manage-section" id="manage-stock" aria-labelledby="manage-stock-heading">
            <h3 id="manage-stock-heading" tabIndex={-1}>Stock and locations</h3>
            {batches.length === 0 && <p className="manage-note">No stock batches yet. Add stock below when you have some.</p>}
            {batches.map((batch) => (
              <fieldset className="manage-batch" id={`manage-batch-${batch.id}`} key={batch.id}>
                <legend>{batch.location} batch</legend>
                {trackingUnit === 'level' ? (
                  <label>
                    What’s left in {batch.location}?
                    <select
                      id={`manage-quantity-${batch.id}`}
                      name={`quantity-${batch.id}`}
                      value={batchQuantities[batch.id] ?? ''}
                      onChange={(event) => setBatchQuantities((previous) => ({ ...previous, [batch.id]: event.target.value }))}
                      required
                    >
                      <option value="">Choose a level…</option>
                      <option value="1">Full</option>
                      <option value="0.5">Half</option>
                      <option value="0.25">Low</option>
                      <option value="0">Out</option>
                    </select>
                  </label>
                ) : (
                  <label>
                    Amount ({trackingUnit})
                    <input
                      id={`manage-quantity-${batch.id}`}
                      name={`quantity-${batch.id}`}
                      type="number"
                      min="0"
                      step="any"
                      value={batchQuantities[batch.id] ?? ''}
                      onChange={(event) => setBatchQuantities((previous) => ({ ...previous, [batch.id]: event.target.value }))}
                      required
                    />
                  </label>
                )}
                <div className="two">
                  <label>
                    Store in
                    <select name={`location-${batch.id}`} defaultValue={batch.location}>
                      {D.locations.map((location) => <option key={location} value={location}>{location}</option>)}
                    </select>
                  </label>
                  <label>
                    Date on package (optional)
                    <input name={`expiry-${batch.id}`} type="date" defaultValue={batch.expiry || ''} />
                  </label>
                </div>
              </fieldset>
            ))}

            <fieldset className="manage-batch add-batch">
              <legend>Add stock</legend>
              {trackingUnit === 'level' ? (
                <label>
                  What’s left?
                  <select name="restock-quantity" defaultValue="">
                    <option value="">Choose a level…</option>
                    <option value="1">Full</option>
                    <option value="0.5">Half</option>
                    <option value="0.25">Low</option>
                    <option value="0">Out</option>
                  </select>
                </label>
              ) : (
                <label>
                  Amount to add ({trackingUnit})
                  <input name="restock-quantity" type="number" min="0.000001" step="any" />
                </label>
              )}
              <div className="two">
                <label>
                  Store in
                  <select name="restock-location" defaultValue="Pantry">
                    {D.locations.map((location) => <option key={location} value={location}>{location}</option>)}
                  </select>
                </label>
                <label>
                  Date on package (optional)
                  <input name="restock-expiry" type="date" />
                </label>
              </div>
              <p className="manage-note">Enter an amount here, then use “Add stock” to include this batch.</p>
            </fieldset>
          </section>

          <details className="manage-danger">
            <summary>Delete this item</summary>
            <p>This removes its batches, activity history, and shopping-list entries. This cannot be undone.</p>
            {!confirmDelete ? (
              <button type="button" className="danger-prepare" onClick={() => setConfirmDelete(true)} disabled={busy}>Continue to delete</button>
            ) : (
              <div className="delete-confirm" role="group" aria-label={`Confirm deleting ${p.name}`}>
                <strong>Delete {p.name} permanently?</strong>
                <div className="manage-actions">
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep item</button>
                  <button type="button" className="danger-confirm" onClick={() => void submitDelete()} disabled={busy}>{busy ? 'Deleting…' : 'Delete food'}</button>
                </div>
              </div>
            )}
          </details>
          <div className="error" role="alert">{error}</div>
          <div className="manage-actions manage-footer">
            <button type="button" onClick={handleCancelClick} disabled={busy}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button type="submit" name="manage-action" value="restock" className="manage-add-stock" disabled={busy}>{busy ? 'Saving…' : 'Add stock'}</button>
          </div>
        </form>
      </>
    );
  }

  if (type === 'use' && p && b) {
    return (
      <>
        <h2>Update {p.name}</h2>
        <p>
          {formatAmount(b.quantity, p)} in {b.location}. Set the amount you see now. No daily usage
          logging needed.
        </p>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="type" value="correct" />
          {p.unit === 'level' ? (
            <label>
              What’s left?
              <select name="quantity" defaultValue={String(b.quantity)}>
                <option value="1">Full</option>
                <option value="0.5">Half</option>
                <option value="0.25">Low</option>
                <option value="0">Out</option>
              </select>
            </label>
          ) : (
            <label>
              {p.unit}
              <input
                name="quantity"
                type="number"
                min="0"
                step="any"
                required
                defaultValue={String(b.quantity)}
              />
            </label>
          )}
          <div className="error" role="alert">
            {error}
          </div>
          <div className="actions">
            <button type="button" id="cancel" onClick={handleCancelClick} disabled={busy}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              Save update
            </button>
          </div>
        </form>
      </>
    );
  }

  if (type === 'minimum' && p) {
    return (
      <>
        <h2>Food settings</h2>
        <p>Suggest shopping when {p.name} reaches this amount.</p>
        <form onSubmit={handleSubmit}>
          <CategoryField categories={allCategories} initialCategory={p.category} />
          {p.unit === 'level' ? (
            <>
              <input type="hidden" name="quantity" value="0.25" />
              <p>Low and Out appear in Running low.</p>
            </>
          ) : (
            <label>
              {p.unit}
              <input
                name="quantity"
                type="number"
                min="0"
                step="any"
                required
                defaultValue={String(p.minimum)}
              />
            </label>
          )}
          <div className="error" role="alert">
            {error}
          </div>
          <div className="actions">
            <button type="button" id="cancel" onClick={handleCancelClick} disabled={busy}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              Save settings
            </button>
          </div>
        </form>
      </>
    );
  }

  if (type === 'restock' && p) {
    return (
      <>
        <h2>Restock {p.name}</h2>
        <p>
          Confirm what is here now. Rough levels replace the level in this location. Exact
          quantities add a batch.
        </p>
        <form onSubmit={handleSubmit}>
          {p.unit === 'level' ? (
            <label>
              What’s left?
              <select name="quantity" defaultValue="1">
                <option value="1">Full</option>
                <option value="0.5">Half</option>
                <option value="0.25">Low</option>
                <option value="0">Out</option>
              </select>
            </label>
          ) : (
            <label>
              {p.unit}
              <input
                name="quantity"
                type="number"
                min="0.000001"
                step="any"
                required
                defaultValue="1"
              />
            </label>
          )}
          <div className="two">
            <label>
              Store in
              <select name="location" defaultValue="Pantry">
                {D.locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date on package (optional)
              <input name="expiry" type="date" />
            </label>
          </div>
          <div className="error" role="alert">
            {error}
          </div>
          <div className="actions">
            <button type="button" id="cancel" onClick={handleCancelClick} disabled={busy}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              Add stock
            </button>
          </div>
        </form>
      </>
    );
  }

  if (type === 'buy' && i && p) {
    return (
      <>
        <h2>Restock {p.name}</h2>
        <p>Confirm what you bought. This updates your stock and completes the list item.</p>
        <form onSubmit={handleSubmit}>
          {p.unit === 'level' ? (
            <label>
              What’s left?
              <select name="quantity" defaultValue="1">
                <option value="1">Full</option>
                <option value="0.5">Half</option>
                <option value="0.25">Low</option>
                <option value="0">Out</option>
              </select>
            </label>
          ) : (
            <label>
              {p.unit}
              <input
                name="quantity"
                type="number"
                min="0.000001"
                step="any"
                required
                defaultValue={String(i.quantity ?? 1)}
              />
            </label>
          )}
          <div className="two">
            <label>
              Store in
              <select name="location" defaultValue="Pantry">
                {D.locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date on package (optional)
              <input name="expiry" type="date" />
            </label>
          </div>
          <div className="error" role="alert">
            {error}
          </div>
          <div className="actions">
            <button type="button" id="cancel" onClick={handleCancelClick} disabled={busy}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              Add to pantry
            </button>
          </div>
        </form>
      </>
    );
  }

  if (type === 'delete' && p) {
    return (
      <>
        <h2>Delete {p.name}?</h2>
        <p>
          This removes its stock batches, activity history, and shopping-list entries from this
          shared pantry. This cannot be undone.
        </p>
        <form onSubmit={handleSubmit}>
          <p>Other foods and their shopping-list items are not affected.</p>
          <div className="error" role="alert">
            {error}
          </div>
          <div className="actions">
            <button type="button" id="cancel" onClick={handleCancelClick} disabled={busy}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              Delete food
            </button>
          </div>
        </form>
      </>
    );
  }

  if (type === 'bulk') {
    const sortedProducts = s.products
      .slice()
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

    return (
      <>
        <h2>Back from the shops?</h2>
        <p>
          Select only what you bought, then confirm each level or amount. Unselected foods stay
          exactly as they are.
        </p>
        <form onSubmit={handleSubmit}>
          {sortedProducts.map((prod) => {
            const last = s.batches.filter((b) => b.productId === prod.id).at(-1);
            const isChecked = !!pickedIds[prod.id];

            return (
              <section key={prod.id} className="bulk-item">
                <label className="bulk-pick">
                  <input
                    type="checkbox"
                    name={`picked-${prod.id}`}
                    data-pick={prod.id}
                    checked={isChecked}
                    onChange={(e) =>
                      setPickedIds((prev) => ({ ...prev, [prod.id]: e.target.checked }))
                    }
                  />
                  {prod.name} <span className="meta">{prod.category}</span>
                </label>
                <fieldset disabled={!isChecked} id={`fields-${prod.id}`}>
                  <div className="two">
                    {prod.unit === 'level' ? (
                      <label>
                        Level now
                        <select required name={`quantity-${prod.id}`} defaultValue="">
                          <option value="">Choose level</option>
                          <option value="1">Full</option>
                          <option value="0.5">Half</option>
                          <option value="0.25">Low</option>
                          <option value="0">Out</option>
                        </select>
                      </label>
                    ) : (
                      <label>
                        Amount bought ({prod.unit})
                        <input
                          required
                          type="number"
                          min="0.000001"
                          step="any"
                          defaultValue="1"
                          name={`quantity-${prod.id}`}
                        />
                      </label>
                    )}
                    <label>
                      Store in
                      <select
                        name={`location-${prod.id}`}
                        defaultValue={last?.location || 'Pantry'}
                      >
                        {D.locations.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    Package date (optional)
                    <input type="date" name={`expiry-${prod.id}`} />
                  </label>
                </fieldset>
              </section>
            );
          })}
          <div className="error" role="alert">
            {error}
          </div>
          <div className="actions">
            <button type="button" id="cancel" onClick={handleCancelClick} disabled={busy}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              Confirm restock
            </button>
          </div>
        </form>
      </>
    );
  }

  if (type === 'connect_missing') {
    return (
      <>
        <h2>Connect your shared pantry</h2>
        <p>
          Firebase setup is needed before two devices can share data. See SETUP.md in the
          repository. Demo data is kept separate.
        </p>
        <form onSubmit={handleSubmit}>
          <p>
            Configure Firebase Auth, Firestore, household members and the web app configuration,
            then reload this page.
          </p>
          <div className="error" role="alert">
            {error}
          </div>
          <div className="actions">
            <button type="button" id="cancel" onClick={handleCancelClick} disabled={busy}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              Got it
            </button>
          </div>
        </form>
      </>
    );
  }

  if (type === 'connect_auth') {
    return (
      <>
        <h2>Your shared pantry</h2>
        <p>
          Sign in with the email account created for your household. Local demo foods are not
          copied.
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <div className="error" role="alert">
            {error}
          </div>
          <div className="actions">
            <button type="button" id="cancel" onClick={handleCancelClick} disabled={busy}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy}>
              Sign in
            </button>
          </div>
        </form>
      </>
    );
  }

  return null;
};

export const DialogModal: React.FC<DialogModalProps> = ({
  modal,
  state: s,
  onClose,
  onSubmit,
  onSuggestCategory
}) => {
  useEffect(() => {
    const dialog = document.getElementById('editor') as HTMLDialogElement | null;
    if (!dialog) return;

    if (modal) {
      dialog.dataset.revision = String(modal.revision);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [modal]);

  useEffect(() => {
    if (modal?.type !== 'manage' || modal.section !== 'stock') return;
    requestAnimationFrame(() => {
      const target = modal.batch
        ? document.getElementById(`manage-quantity-${modal.batch.id}`)
        : document.getElementById('manage-stock-heading');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start' });
    });
  }, [modal]);

  useEffect(() => {
    const dialog = document.getElementById('editor') as HTMLDialogElement | null;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const dialogElement =
    typeof document !== 'undefined'
      ? (document.getElementById('editor') as HTMLDialogElement | null)
      : null;

  if (!modal || !dialogElement) return null;

  return createPortal(
    <ModalFormContent
      key={`${modal.type}-${modal.revision}`}
      modal={modal}
      state={s}
      onClose={onClose}
      onSubmit={onSubmit}
      onSuggestCategory={onSuggestCategory}
    />,
    dialogElement
  );
};
