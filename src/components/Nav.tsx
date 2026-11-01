import React from 'react';

interface NavProps {
  tab: 'inventory' | 'shopping' | 'history';
  shoppingCount: number;
  onSelectTab: (tab: 'inventory' | 'shopping' | 'history') => void;
}

export const Nav: React.FC<NavProps> = ({ tab, shoppingCount, onSelectTab }) => {
  return (
    <nav className="nav" aria-label="Pantry views">
      <button
        data-tab="inventory"
        className={tab === 'inventory' ? 'active' : ''}
        aria-current={tab === 'inventory' ? 'page' : 'false'}
        onClick={() => onSelectTab('inventory')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 11h16M4 20h16M6 11V4h5v7m4 0V6h3v5M7 20v-5h5v5m4 0v-5h2v5" />
        </svg>
        My inventory
      </button>
      <button
        data-tab="shopping"
        className={tab === 'shopping' ? 'active' : ''}
        aria-current={tab === 'shopping' ? 'page' : 'false'}
        onClick={() => onSelectTab('shopping')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 8h14l1 12H4L5 8Zm4 0V6a3 3 0 0 1 6 0v2" />
        </svg>
        Shopping list · {shoppingCount}
      </button>
      <button
        data-tab="history"
        className={tab === 'history' ? 'active' : ''}
        aria-current={tab === 'history' ? 'page' : 'false'}
        onClick={() => onSelectTab('history')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6m2-3v5l3 2" />
        </svg>
        Activity
      </button>
    </nav>
  );
};
