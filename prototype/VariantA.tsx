import React from 'react';
import type { PantryItem } from './types.ts';
import { AddButton, AmountLabel, Brand, EmptyState, Filters, Icon, StatusPill, type VariantProps } from './ui.tsx';

export const VariantA: React.FC<VariantProps> = ({ filtered, search, category, lowOnly, onSearch, onCategory, onLowOnly, onAdd, onRestock }) => {
  const groups = [...new Set(filtered.map((item) => item.category))];
  return <main className="variant-a">
    <header className="a-header"><Brand /><span className="sample-ribbon"><span />Sample pantry · illustrative stock</span><div className="a-header-actions"><button type="button" className="quiet-button">Today’s note</button><span className="avatar">M</span></div></header>
    <section className="a-welcome"><div><span className="eyebrow">A LITTLE ORDER, A LOT LESS WASTE</span><h1>A home for the<br />food you love.</h1><p>See what’s on each shelf and know what’s ready for the next meal.</p><div className="a-welcome-actions"><AddButton onClick={onAdd} /><span className="a-sample-caption">53 sample foods · nothing saved</span></div></div><div className="a-illustration" aria-hidden="true"><div className="jar jar-one"><i /><b /><span /></div><div className="jar jar-two"><i /><b /><span /></div><div className="jar jar-three"><i /><b /><span /></div><div className="shelf-line" /></div></section>
    <section className="a-summary"><div><strong>53</strong><span>foods at home</span></div><div><strong>{filtered.filter((item) => item.level !== 'ready').length}</strong><span>to check soon</span></div><div><strong>{new Set(filtered.map((item) => item.category)).size}</strong><span>categories in view</span></div></section>
    <section className="a-inventory"><div className="section-heading"><div><span className="eyebrow">YOUR KITCHEN</span><h2>Take a look around</h2></div><span className="sort-note">Grouped by shelf</span></div><Filters search={search} category={category} lowOnly={lowOnly} onSearch={onSearch} onCategory={onCategory} onLowOnly={onLowOnly} />
      {filtered.length === 0 ? <EmptyState /> : groups.map((group) => { const items = filtered.filter((item) => item.category === group); return <section className="shelf-section" key={group}><div className="shelf-heading"><div><span className="shelf-kicker">SHELF</span><h3>{group}</h3></div><span>{items.length} {items.length === 1 ? 'food' : 'foods'}</span></div><div className="shelf-items">{items.map((item: PantryItem) => <article className="shelf-item" key={item.id}><div className="shelf-item-copy"><span className={`shelf-marker mark-${item.level}`} /><div><h4>{item.name}</h4><span>{item.location} · {item.category}</span></div></div><div className="shelf-item-stock"><StatusPill item={item} /><AmountLabel item={item} /><button type="button" className="round-action" aria-label={`Restock ${item.name}`} title="Add one locally" onClick={() => onRestock(item.id)}><Icon name="plus" /></button></div></article>)}</div><div className="shelf-board" /></section>; })}
    </section>
    <footer className="a-footer"><Brand /><span>Good food, accounted for.</span></footer>
  </main>;
};
