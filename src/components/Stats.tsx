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
    <section className="stats">
      <button
        className={`stat ${currentFilter === 'all' ? 'active' : ''}`}
        data-filter="all"
        onClick={() => onSelectFilter('all')}
      >
        <span className="stat-icon">▦</span>
        <span>
          <strong>{totalProducts}</strong>Foods at home
          <small>Across all your spaces</small>
        </span>
      </button>
      <button
        className={`stat ${currentFilter === 'soon' ? 'active' : ''}`}
        data-filter="soon"
        onClick={() => onSelectFilter('soon')}
      >
        <span className="stat-icon">◷</span>
        <span>
          <strong>{soonCount}</strong>Use soon
          <small>Due within 3 days or overdue</small>
        </span>
      </button>
      <button
        className={`stat ${currentFilter === 'low' ? 'active' : ''}`}
        data-filter="low"
        onClick={() => onSelectFilter('low')}
      >
        <span className="stat-icon">↘</span>
        <span>
          <strong>{lowCount}</strong>Running low
          <small>Based on your last stock check</small>
        </span>
      </button>
    </section>
  );
};
