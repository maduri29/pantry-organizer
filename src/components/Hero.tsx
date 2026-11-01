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
        <p>
          {view === 'inventory'
            ? 'What’s here, what’s low, and what to use next.'
            : view === 'shopping'
              ? 'Pick up what’s missing. Update stock when you’re home.'
              : 'Your recent additions and stock check-ins.'}
        </p>
      </div>
      <div className="hero-art" aria-hidden="true">
        <svg viewBox="0 0 172 92" focusable="false" role="presentation">
          <path className="shelf-cloth" d="M78 76h66l8 8H86Z" />
          <path className="shelf-line" d="M14 77h144" />
          <path className="shelf-jar" d="M29 23h35v50H29z" />
          <path className="shelf-grain" d="M30 48c9-4 22 4 33 0v25H30Z" />
          <path className="shelf-lid" d="M27 18h39v7H27z" />
          <path className="shelf-label" d="M36 34h21v17H36z" />
          <path d="m43 38 5 8m0-8-5 8m-8 11 3 4m7-5 2 5m8-3-2 5m-13 2 2 4" />
          <path className="shelf-bottle" d="M83 13h12v18l7 8v34H76V39l7-8Z" />
          <path className="shelf-oil" d="M77 47h24v26H77Z" />
          <path className="shelf-cap" d="M82 10h14v6H82z" />
          <path className="shelf-label" d="M81 45h16v15H81z" />
          <path d="M88 48v9m0-5c-4 0-4-3-4-3 3 0 4 1 4 3m0 3c4 0 4-3 4-3-3 0-4 1-4 3" />
          <path
            className="shelf-pear"
            d="M129 43c-6 0-5 8-10 13-9 10-3 19 9 19s18-8 11-18c-5-6-4-14-10-14Z"
          />
          <path className="shelf-leaf" d="M130 43c2-7 8-8 13-5-3 6-7 8-13 5Z" />
          <path d="M130 43c-1-4 0-7 2-9m-10 32c0 3 1 4 3 5" />
        </svg>
      </div>
      <div className="hero-actions">
        <button className="primary" data-action="add" onClick={onAdd}>
          ＋ Add food
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
