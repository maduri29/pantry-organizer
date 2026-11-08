import React from 'react';

interface HeroProps {
  view: 'inventory' | 'shopping' | 'history';
  hasProducts: boolean;
  onAdd: () => void;
  onBulk: () => void;
  canSuggestCategories?: boolean;
  suggestingCategories?: boolean;
  onSuggestCategories?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  view,
  hasProducts,
  onAdd,
  onBulk,
  canSuggestCategories = false,
  suggestingCategories = false,
  onSuggestCategories
}) => {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>
          {view === 'inventory'
            ? 'Your pantry'
            : view === 'shopping'
              ? 'Shopping list'
              : 'Pantry activity'}
        </h1>
      </div>
      <div className="hero-actions">
        <button className="primary" data-action="add" aria-label="＋ Add food" onClick={onAdd}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>{' '}
          Add food
        </button>
        {hasProducts && (
          <button data-action="bulk" onClick={onBulk}>
            Restock several
          </button>
        )}
        {hasProducts && canSuggestCategories && (
          <button
            data-action="suggest-categories"
            onClick={onSuggestCategories}
            disabled={suggestingCategories}
          >
            {suggestingCategories ? 'Suggesting…' : 'Suggest categories'}
          </button>
        )}
      </div>
    </section>
  );
};
