import { availableCategories } from '../category-options.ts';
import { FoodIllustration } from './FoodIllustration.tsx';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as D from '../domain.ts';
import type {
  Batch,
  CategorySuggestion,
  Location,
  PantryState,
  Product,
  ShoppingItem
} from '../types.ts';
import { RestockTrip } from './RestockTrip.tsx';
import { StockEditor } from './StockEditor.tsx';
import { formatAmount } from '../format.ts';

export type ModalType =
  | 'stock'
  | 'add'
  | 'manage'
  | 'buy'
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
  initialName?: string;
  initialCategory?: string;
  initialLocation?: Location;
  lastAdded?: string;
}

interface DialogModalProps {
  modal: ModalState | null;
  state: PantryState;
  onClose: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  onManageExisting?: (product: Product) => void;
  onSuggestCategory?: (name: string, signal: AbortSignal) => Promise<CategorySuggestion>;
}

interface ModalFormContentProps {
  modal: ModalState;
  state: PantryState;
  onClose: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  onManageExisting?: (product: Product) => void;
  onSuggestCategory?: (name: string, signal: AbortSignal) => Promise<CategorySuggestion>;
}

const CategoryField: React.FC<{
  categories: string[];
  initialCategory: string;
  itemName?: string;
  onSuggestCategory?: (name: string, signal: AbortSignal) => Promise<CategorySuggestion>;
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
  useEffect(
    () => () => {
      const active = controller.current;
      controller.current = null;
      active?.abort();
    },
    []
  );

  const requestSuggestion = async () => {
    if (!onSuggestCategory || !itemName.trim()) return;
    controller.current?.abort();
    const requestController = new AbortController();
    requestController.signal.addEventListener(
      'abort',
      () => {
        if (controller.current === requestController) setSuggestingName(null);
      },
      { once: true }
    );
    controller.current = requestController;
    setSuggestingName(itemName);
    setSuggestionError(null);
    try {
      const requestedName = itemName.trim();
      const result = await onSuggestCategory(requestedName, requestController.signal);
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
  onManageExisting,
  onSuggestCategory
}) => {
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [trackingUnit, setTrackingUnit] = useState<string>(modal.product?.unit ?? 'level');
  const [foodName, setFoodName] = useState(modal.initialName ?? modal.product?.name ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [stockAction, setStockAction] = useState<'update' | 'restock'>('update');
  const [stockBusy, setStockBusy] = useState(false);
  const keepItemRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmDelete) keepItemRef.current?.focus();
  }, [confirmDelete]);
  const [editMode, setEditMode] = useState<'stock' | 'details'>(
    modal.section === 'details' ? 'details' : 'stock'
  );
  const [batchQuantities, setBatchQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      s.batches
        .filter((batch) => batch.productId === modal.product?.id)
        .map((batch) => [batch.id, String(batch.quantity)])
    )
  );

  const allCategories = useMemo(() => {
    return availableCategories(s.products);
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
    const matchingFoods = s.products.filter(
      (product) => product.name.toLocaleLowerCase() === foodName.trim().toLocaleLowerCase()
    );
    const existing =
      matchingFoods.find((product) => product.unit === trackingUnit) ?? matchingFoods[0];
    return (
      <div className="add-shell">
        <div className="add-heading">
          <div>
            <h2 id="add-food-title">Add food</h2>
            <p>A name is enough to start. Adjust the rest when you need to.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close add food"
            onClick={onClose}
            disabled={busy}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <form
          className="add-form"
          onSubmit={handleSubmit}
          onInvalidCapture={(event) => {
            let details = (event.target as HTMLElement).closest<HTMLDetailsElement>(
              'details:not([open])'
            );
            while (details) {
              details.open = true;
              details =
                details.parentElement?.closest<HTMLDetailsElement>('details:not([open])') ?? null;
            }
          }}
        >
          <div className="add-body">
            {modal.lastAdded && (
              <p className="add-success" role="status">
                {modal.lastAdded} added. Ready for the next food.
              </p>
            )}
            <label>
              Food name
              <input
                name="name"
                value={foodName}
                onChange={(event) => setFoodName(event.target.value)}
                required
                maxLength={80}
                autoComplete="off"
                autoCapitalize="words"
                placeholder="e.g. Eggs, milk or rice"
              />
            </label>
            {existing && (
              <div className="existing-food" role="status">
                <div>
                  <strong>{existing.name} is already in your pantry</strong>
                  <p>
                    {existing.unit !== trackingUnit
                      ? 'Adding with a different tracking method creates a separate pantry entry.'
                      : trackingUnit === 'level'
                        ? 'Adding it again replaces the stock level in the selected location.'
                        : 'Adding it again creates a separate stock batch.'}
                  </p>
                </div>
                {onManageExisting && (
                  <button type="button" onClick={() => onManageExisting(existing)} disabled={busy}>
                    Update existing food
                  </button>
                )}
              </div>
            )}
            <div className="two add-basics">
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
                    Amount ({trackingUnit})
                    <input
                      name="quantity"
                      type="number"
                      inputMode="decimal"
                      min="0.000001"
                      step="any"
                      required
                      defaultValue="1"
                    />
                  </label>
                )}
              </div>
              <label>
                Store in
                <select name="location" defaultValue={modal.initialLocation ?? 'Pantry'}>
                  {D.locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <CategoryField
              categories={allCategories}
              initialCategory={modal.initialCategory ?? 'Other'}
              itemName={foodName}
              onSuggestCategory={onSuggestCategory}
            />
            <details className="add-options">
              <summary>Exact quantities & dates</summary>
              <div className="add-option-fields">
                <label>
                  Tracking
                  <select
                    name="unit"
                    id="tracking"
                    value={trackingUnit}
                    onChange={(event) => setTrackingUnit(event.target.value)}
                  >
                    {D.units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit === 'level' ? 'Rough level (recommended)' : unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label id="minimum-field" hidden={trackingUnit === 'level'}>
                  Low-stock minimum
                  <input
                    name="minimum"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    defaultValue="0"
                    disabled={trackingUnit === 'level'}
                  />
                </label>
                <label>
                  Date on package (optional)
                  <input name="expiry" type="date" />
                </label>
              </div>
            </details>
            <div className="error" role="alert">
              {error}
            </div>
          </div>
          <div className="add-footer">
            <div className="actions">
              <button type="button" id="cancel" onClick={handleCancelClick} disabled={busy}>
                Cancel
              </button>
              <button className="primary" type="submit" disabled={busy}>
                {busy ? 'Adding…' : 'Add food'}
              </button>
            </div>
            <button
              className="quiet add-another"
              type="submit"
              name="add-action"
              value="another"
              disabled={busy}
            >
              Add & add another
            </button>
          </div>
        </form>
      </div>
    );
  }

  if ((type === 'stock' || type === 'buy') && p) {
    return (
      <StockEditor
        state={s}
        product={p}
        batch={b}
        shoppingItem={i}
        initialAction={type === 'stock' ? 'update' : 'restock'}
        onSubmit={onSubmit}
        onClose={onClose}
      />
    );
  }

  if (type === 'manage' && p) {
    const batches = s.batches.filter((batch) => batch.productId === p.id);
    const handleManageInvalid = (event: React.InvalidEvent<HTMLFormElement>) => {
      const field = event.target as HTMLInputElement | HTMLSelectElement;
      if (!field.closest('details:not([open])')) return;
      event.preventDefault();
      let details = field.closest<HTMLDetailsElement>('details:not([open])');
      while (details) {
        details.open = true;
        details = field.closest<HTMLDetailsElement>('details:not([open])');
      }
      field.focus({ preventScroll: true });
      field.scrollIntoView({ block: 'center' });
      field.reportValidity();
    };
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
      <div className="manage-editor">
        <header className="manage-heading">
          <FoodIllustration product={p} />
          <div>
            <h2>{editMode === 'details' ? 'Edit food' : p.name}</h2>
            <p className="edit-food-caption">
              {editMode === 'details' ? p.name : `${formatAmount(D.total(s, p), p)} on hand`}
            </p>
            <button
              className="edit-details-link"
              type="button"
              aria-label="Details"
              hidden={editMode === 'details'}
              disabled={busy || stockBusy}
              onClick={() => setEditMode('details')}
            >
              Edit details
            </button>
          </div>
          <button
            type="button"
            className="manage-close"
            aria-label="Close manage item"
            onClick={onClose}
            disabled={busy || stockBusy}
          >
            ×
          </button>
        </header>
        <div className="editor-task-switch">
          <h3 hidden={editMode === 'details'}>
            {editMode === 'details'
              ? 'Food details'
              : stockAction === 'update'
                ? 'Update what’s left'
                : 'Add your purchase'}
          </h3>
          <button
            type="button"
            aria-label="What’s left"
            hidden={editMode === 'stock' && stockAction === 'update'}
            disabled={busy || stockBusy}
            onClick={() => {
              setStockAction('update');
              setEditMode('stock');
            }}
          >
            Back to stock
          </button>
          <button
            type="button"
            aria-label="I bought more"
            hidden={editMode === 'details' || stockAction === 'restock'}
            disabled={busy || stockBusy}
            onClick={() => {
              setStockAction('restock');
              setEditMode('stock');
            }}
          >
            Bought more?
          </button>
        </div>
        <div className="editor-pane" hidden={editMode !== 'stock'}>
          <StockEditor
            state={s}
            product={p}
            batch={b}
            initialAction="update"
            selectedAction={stockAction}
            embedded
            onBusyChange={setStockBusy}
            onSubmit={onSubmit}
            onClose={onClose}
            onDetails={() => setEditMode('details')}
            onDelete={() => {
              setEditMode('details');
              setConfirmDelete(true);
            }}
          />
        </div>
        <div className="manage-shell" hidden={editMode !== 'details'}>
          <form
            className="manage-form"
            onSubmit={handleSubmit}
            onInvalidCapture={handleManageInvalid}
          >
            <input type="hidden" name="manage-action" value="save" />
            <div className="manage-body">
              <div className="manage-panel" id="manage-panel-details">
                <section className="manage-section" id="manage-details">
                  <label>
                    Food name
                    <input
                      name="name"
                      value={foodName}
                      onChange={(event) => setFoodName(event.target.value)}
                      maxLength={80}
                      required
                      autoComplete="off"
                    />
                  </label>
                  <CategoryField
                    categories={allCategories}
                    initialCategory={p.category}
                    itemName={foodName}
                    onSuggestCategory={onSuggestCategory}
                  />
                  <div className="manage-settings edit-tracking">
                    <label>
                      Tracking and unit
                      <select
                        name="unit"
                        value={trackingUnit}
                        onChange={(event) => {
                          const nextUnit = event.target.value;
                          if (nextUnit === 'level' && trackingUnit !== 'level') {
                            setBatchQuantities(
                              Object.fromEntries(batches.map((batch) => [batch.id, '']))
                            );
                          }
                          setTrackingUnit(nextUnit);
                        }}
                      >
                        {D.units.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit === 'level' ? 'Rough level' : `Exact · ${unit}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    {trackingUnit !== p.unit && batches.some((batch) => batch.quantity > 0) && (
                      <p className="manage-note" role="status">
                        Changing tracking relabels current amounts. Review each batch below before
                        saving.
                      </p>
                    )}
                    {trackingUnit === 'level' ? (
                      <>
                        <input type="hidden" name="minimum" value="0.25" />
                        <p className="manage-note">Rough levels use Full, Half, Low, and Out.</p>
                      </>
                    ) : (
                      <label>
                        Shop when below ({trackingUnit})
                        <input
                          name="minimum"
                          type="number"
                          min="0"
                          step="any"
                          required
                          defaultValue={String(p.minimum)}
                        />
                      </label>
                    )}
                  </div>
                </section>
              </div>
              <details className="manage-panel batch-settings" id="manage-panel-stock">
                <summary>
                  Packages <span className="package-count">{batches.length}</span>
                  <svg aria-hidden="true" className="package-chevron" viewBox="0 0 16 16">
                    <path d="M4 6 L8 10 L12 6" />
                  </svg>
                </summary>
                <p className="manage-note">
                  Change a package’s location, date or remaining amount.
                </p>
                <section className="manage-section" id="manage-stock">
                  {batches.length === 0 && <p className="manage-note">No stock batches yet.</p>}
                  {batches.map((batch, index) => {
                    const days = D.expiryDays(batch.expiry);
                    const expiryLabel = !batch.expiry
                      ? ''
                      : days < 0
                        ? `Expired ${-days}d ago`
                        : days === 0
                          ? 'Due today'
                          : days <= 3
                            ? `Due in ${days}d`
                            : `Expires ${batch.expiry}`;
                    return (
                      <fieldset
                        className="manage-batch"
                        id={`manage-batch-${batch.id}`}
                        key={batch.id}
                      >
                        <legend>
                          {batches.length === 1
                            ? `Current stock · ${batch.location}`
                            : `Batch ${index + 1} · ${batch.location}`}
                        </legend>
                        {trackingUnit === 'level' ? (
                          <label>
                            Current stock level
                            <select
                              id={`manage-quantity-${batch.id}`}
                              name={`quantity-${batch.id}`}
                              value={batchQuantities[batch.id] ?? ''}
                              onChange={(event) =>
                                setBatchQuantities((previous) => ({
                                  ...previous,
                                  [batch.id]: event.target.value
                                }))
                              }
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
                            Current amount ({trackingUnit})
                            <input
                              id={`manage-quantity-${batch.id}`}
                              name={`quantity-${batch.id}`}
                              type="number"
                              min="0"
                              step="any"
                              value={batchQuantities[batch.id] ?? ''}
                              onChange={(event) =>
                                setBatchQuantities((previous) => ({
                                  ...previous,
                                  [batch.id]: event.target.value
                                }))
                              }
                              required
                            />
                          </label>
                        )}
                        {expiryLabel && (
                          <span
                            className={`manage-expiry ${days < 0 ? 'expired' : days <= 3 ? 'warn' : ''}`}
                          >
                            {expiryLabel}
                          </span>
                        )}
                        <details className="manage-batch-meta">
                          <summary>Location &amp; expiry</summary>
                          <div className="two">
                            <label>
                              Location
                              <select name={`location-${batch.id}`} defaultValue={batch.location}>
                                {D.locations.map((location) => (
                                  <option key={location} value={location}>
                                    {location}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Expiry date
                              <input
                                name={`expiry-${batch.id}`}
                                type="date"
                                defaultValue={batch.expiry || ''}
                              />
                            </label>
                          </div>
                        </details>
                      </fieldset>
                    );
                  })}
                </section>
              </details>
              {!confirmDelete ? (
                <div className="manage-delete-row">
                  <button
                    type="button"
                    className="manage-delete-icon"
                    aria-label={`Delete ${p.name}`}
                    title={`Delete ${p.name}`}
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5" />
                    </svg>
                    <span>Delete food</span>
                  </button>
                </div>
              ) : (
                <div
                  className="delete-confirm"
                  role="group"
                  aria-label={`Confirm deleting ${p.name}`}
                >
                  <div>
                    <strong>Delete {p.name}?</strong>
                    <p>
                      This removes its batches, activity, and shopping entries. This cannot be
                      undone.
                    </p>
                  </div>
                  <div className="manage-actions">
                    <button
                      ref={keepItemRef}
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={busy}
                    >
                      Keep item
                    </button>
                    <button
                      type="button"
                      className="danger-confirm"
                      onClick={() => void submitDelete()}
                      disabled={busy}
                    >
                      {busy ? 'Deleting…' : 'Delete item'}
                    </button>
                  </div>
                </div>
              )}
              <div className="error" role="alert">
                {error}
              </div>
            </div>
            <footer className="manage-footer">
              <button
                type="button"
                className="manage-cancel"
                onClick={handleCancelClick}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </footer>
          </form>
        </div>
      </div>
    );
  }

  if (type === 'bulk') {
    return <RestockTrip state={s} onSubmit={onSubmit} onClose={onClose} />;
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
  onManageExisting,
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
      const heading = dialog.querySelector('h2');
      if (heading) {
        if (!heading.id) heading.id = 'editor-title';
        dialog.setAttribute('aria-labelledby', heading.id);
      }
      if (modal.type === 'add') {
        const frame = requestAnimationFrame(() =>
          dialog.querySelector<HTMLInputElement>('[name="name"]')?.focus({ preventScroll: true })
        );
        return () => cancelAnimationFrame(frame);
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
        : document.getElementById('manage-details');
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
      onManageExisting={onManageExisting}
      onSuggestCategory={onSuggestCategory}
    />,
    dialogElement
  );
};
