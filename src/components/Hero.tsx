import React from 'react';

interface HeroProps {
  view: 'inventory' | 'shopping' | 'history';
  hasProducts: boolean;
  onAdd: () => void;
  onBulk: () => void;
}

export const Hero: React.FC<HeroProps> = ({ view, hasProducts, onAdd, onBulk }) => {
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
        {hasProducts && (
          <button data-action="bulk" onClick={onBulk}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 10h16l-1.4 9H5.4L4 10Zm3 0 3-5m7 5-3-5M9 13v3m6-3v3" />
            </svg>
            Add groceries
          </button>
        )}
        <button
          className="primary hero-add"
          data-action="add"
          aria-label="＋ Add food"
          onClick={onAdd}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>{' '}
          Add food
        </button>
      </div>
    </section>
  );
};
