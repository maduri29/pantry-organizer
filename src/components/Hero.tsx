import React from 'react';

interface HeroProps {
  hasProducts: boolean;
  onAdd: () => void;
  onBulk: () => void;
}

export const Hero: React.FC<HeroProps> = ({ hasProducts, onAdd, onBulk }) => {
  return (
    <section className="hero">
      <div>
        <div className="eyebrow">Good food, accounted for</div>
        <h1>A little order. A lot less waste.</h1>
        <p>See what’s here. Use what’s fresh. Shop for what’s next.</p>
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
      </div>
    </section>
  );
};
