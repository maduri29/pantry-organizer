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
        My inventory
      </button>
      <button
        data-tab="shopping"
        className={tab === 'shopping' ? 'active' : ''}
        aria-current={tab === 'shopping' ? 'page' : 'false'}
        onClick={() => onSelectTab('shopping')}
      >
        Shopping list · {shoppingCount}
      </button>
      <button
        data-tab="history"
        className={tab === 'history' ? 'active' : ''}
        aria-current={tab === 'history' ? 'page' : 'false'}
        onClick={() => onSelectTab('history')}
      >
        Activity
      </button>
    </nav>
  );
};
