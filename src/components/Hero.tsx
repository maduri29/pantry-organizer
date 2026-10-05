import React from 'react';

interface HeroProps {
  hasProducts: boolean;
  onAdd: () => void;
  onBulk: () => void;
  canSuggestCategories?: boolean;
  suggestingCategories?: boolean;
  onSuggestCategories?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
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
        <div className="eyebrow">A little order, a lot less waste</div>
        <h1>A home for the food you love.</h1>
        <p>See what’s on each shelf and know what’s ready for the next meal.</p>
      </div>
      <div className="hero-art" aria-hidden="true">
        <svg viewBox="0 0 220 170" focusable="false" role="presentation">
          <path className="hero-shelf" d="M22 147c49 8 126 8 177-1" />
          <path className="hero-bowl" d="M55 99h111c-4 31-24 48-55 48S60 130 55 99Z" />
          <path className="hero-bowl-rim" d="M49 98c0-7 26-12 62-12s62 5 62 12-26 12-62 12-62-5-62-12Z" />
          <path className="hero-leaf" d="M88 93c-1-21 9-36 29-45 1 20-7 35-25 47M112 91c4-18 17-27 35-26-4 18-15 27-33 29" />
          <path className="hero-stem" d="M105 99c3-18 7-34 14-49" />
          <path className="hero-grain" d="M72 96c-4-13 1-24 10-29 6 12 4 23-5 32M133 98c4-13 13-18 24-16-1 12-9 19-22 20" />
          <circle className="hero-spark" cx="40" cy="65" r="4" />
          <path className="hero-spark" d="M184 65v12m-6-6h12" />
          <path className="hero-cloth" d="M42 135c-8 1-14 4-18 10 7 5 15 6 23 2" />
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
