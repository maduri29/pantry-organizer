import React from 'react';

interface StatsProps {
  totalProducts: number;
  soonCount: number;
  lowCount: number;
  currentFilter: 'all' | 'soon' | 'low';
  onSelectFilter: (filter: 'all' | 'soon' | 'low') => void;
}

export const Stats: React.FC<StatsProps> = ({
  totalProducts,
  soonCount,
  lowCount,
  currentFilter,
  onSelectFilter
}) => {
  return (
    <section className="stats" aria-label="Filter inventory by stock">
      <button
        className={`stat ${currentFilter === 'all' ? 'active' : ''}`}
        data-filter="all"
        aria-pressed={currentFilter === 'all'}
        onClick={() => onSelectFilter('all')}
      >
        <span>
          <strong>{totalProducts}</strong>Foods at home
          <small>Across all your spaces</small>
        </span>
      </button>
      <button
        className={`stat ${currentFilter === 'soon' ? 'active' : ''}`}
        data-filter="soon"
        aria-pressed={currentFilter === 'soon'}
        onClick={() => onSelectFilter('soon')}
      >
        <span>
          <strong className={soonCount > 0 ? 'signal-soon' : undefined}>{soonCount}</strong>Use soon
          <small>Due within 3 days or overdue</small>
        </span>
      </button>
      <button
        className={`stat ${currentFilter === 'low' ? 'active' : ''}`}
        data-filter="low"
        aria-pressed={currentFilter === 'low'}
        onClick={() => onSelectFilter('low')}
      >
        <span>
          <strong className={lowCount > 0 ? 'signal-low' : undefined}>{lowCount}</strong>Running low
          <small>Based on your last stock check</small>
        </span>
      </button>
    </section>
  );
};
