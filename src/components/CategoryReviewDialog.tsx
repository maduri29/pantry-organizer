import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CategorySuggestion } from '../types.ts';

export interface CategoryProposal extends CategorySuggestion {
  name: string;
  currentCategory: string;
}

export interface CategoryReviewData {
  reviewId: string;
  revision: number;
  categories: string[];
  entries: CategoryProposal[];
}

interface CategoryReviewDialogProps {
  review: CategoryReviewData | null;
  onClose: () => void;
  onApply: (assignments: Array<{ productId: string; category: string }>) => Promise<void>;
}

export const CategoryReviewDialog: React.FC<CategoryReviewDialogProps> = ({
  review,
  onClose,
  onApply
}) => {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(review?.entries.map((entry) => entry.id) || [])
  );
  const [categoriesById, setCategoriesById] = useState<Record<string, string>>(() =>
    Object.fromEntries((review?.entries || []).map((entry) => [entry.id, entry.category]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = document.getElementById('category-review') as HTMLDialogElement | null;
    dialogRef.current = dialog;
    if (review && dialog && !dialog.open) dialog.showModal();
    if (!review && dialog?.open) dialog.close();
  }, [review]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const selectedCount = selected.size;
  const entries = review?.entries || [];
  const selectionSummary = useMemo(
    () => `${selectedCount} of ${entries.length} changes selected`,
    [entries.length, selectedCount]
  );

  const apply = async () => {
    const assignments = entries
      .filter((entry) => selected.has(entry.id))
      .map((entry) => ({
        productId: entry.id,
        category: categoriesById[entry.id] || entry.category
      }));
    if (!assignments.length) {
      setError('Select at least one category change to apply.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onApply(assignments);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not apply these categories.');
    } finally {
      setBusy(false);
    }
  };

  const dialog = document.getElementById('category-review');
  if (!review || !dialog) return null;

  return createPortal(
    <section className="category-review-content" aria-labelledby="category-review-title">
      <h2 id="category-review-title">Review category suggestions</h2>
      <p>
        Jev only suggests categories. Choose which changes to save; you can adjust any category
        before applying.
      </p>
      <div className="category-review-meta" role="status">
        {selectionSummary}
      </div>
      <div className="category-review-list">
        {entries.map((entry) => {
          const checked = selected.has(entry.id);
          return (
            <div className="category-review-row" key={entry.id}>
              <label className="category-review-pick">
                <input
                  type="checkbox"
                  aria-label={`Apply suggestion for ${entry.name}`}
                  checked={checked}
                  onChange={(event) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (event.target.checked) next.add(entry.id);
                      else next.delete(entry.id);
                      return next;
                    })
                  }
                />
                <span>
                  <strong>{entry.name}</strong>
                  <small>
                    {entry.currentCategory} → {entry.category} ·{' '}
                    {Math.round(entry.confidence * 100)}% confidence
                  </small>
                </span>
              </label>
              <label className="category-review-select">
                <span className="sr-only">Category for {entry.name}</span>
                <select
                  aria-label={`Category for ${entry.name}`}
                  value={categoriesById[entry.id] || entry.category}
                  onChange={(event) =>
                    setCategoriesById((previous) => ({
                      ...previous,
                      [entry.id]: event.target.value
                    }))
                  }
                >
                  {review.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
      </div>
      <div className="error" role="alert">
        {error}
      </div>
      <div className="actions">
        <button type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="primary" type="button" onClick={() => void apply()} disabled={busy}>
          {busy ? 'Saving…' : `Apply ${selectedCount} selected`}
        </button>
      </div>
    </section>,
    dialog
  );
};
