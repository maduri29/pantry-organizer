import React from 'react';
import type { PantryItem } from './types.ts';
import { AddButton, AmountLabel, Brand, EmptyState, Filters, Icon, StatusPill, type VariantProps } from './ui.tsx';

export const VariantA: React.FC<VariantProps> = ({ items: allItems, filtered, search, category, lowOnly, onSearch, onCategory, onLowOnly, onAdd, onRestock }) => {
  const groups = [...new Set(filtered.map((item) => item.category))];
  const needsBuy = allItems.filter((item) => item.level !== 'ready');
  const outNow = needsBuy.filter((item) => item.level === 'out');
  const runningLow = needsBuy.filter((item) => item.level === 'low');
  const glanceItems = [...outNow, ...runningLow].slice(0, 4);
  const showAllNeeds = () => {
    onSearch('');
    onCategory('all');
    if (needsBuy.length ? !lowOnly : lowOnly) onLowOnly();
    window.setTimeout(() => document.getElementById('a-inventory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  return <main className="variant-a">
    <header className="a-header"><Brand /><span className="sample-ribbon"><span />Sample pantry · illustrative stock</span><div className="a-header-actions"><button type="button" className="quiet-button">Today’s note</button><span className="avatar">M</span></div></header>
    <section className="a-welcome"><div><span className="eyebrow">A LITTLE ORDER, A LOT LESS WASTE</span><h1>A home for the<br />food you love.</h1><p>See what’s on each shelf and know what’s ready for the next meal.</p><div className="a-welcome-actions"><AddButton onClick={onAdd} /><span className="a-sample-caption">53 sample foods · nothing saved</span></div></div><div className="a-illustration" aria-hidden="true"><div className="jar jar-one"><i /><b /><span /></div><div className="jar jar-two"><i /><b /><span /></div><div className="jar jar-three"><i /><b /><span /></div><div className="shelf-line" /></div></section>
    <section className="a-summary"><div><strong>{allItems.length}</strong><span>foods at home</span></div><div><strong>{needsBuy.length}</strong><span>to check soon</span></div><div><strong>{new Set(allItems.map((item) => item.category)).size}</strong><span>categories stocked</span></div></section>
    <section className="a-shopping-glance" aria-labelledby="a-shopping-title"><div className="glance-heading"><span className="glance-icon"><Icon name="box" size={20} /></span><div><span className="eyebrow">A QUICK LOOK BEFORE YOU SHOP</span><h2 id="a-shopping-title">Shopping glance</h2></div></div><div className="glance-status"><span><i className="out-dot" /><strong>{outNow.length}</strong> out now</span><span><i className="low-dot" /><strong>{runningLow.length}</strong> running low</span><span className="glance-caption">Based on the stock shown here</span></div>{needsBuy.length ? <div className="glance-items">{glanceItems.map((item) => <article className="glance-item" key={item.id}><ItemIllustration item={item} /><div className="glance-item-copy"><strong>{item.name}</strong><StatusPill item={item} /></div></article>)}</div> : <p className="glance-clear"><Icon name="check" size={16} />Everything looks stocked for now.</p>}<div className="glance-foot"><span>{needsBuy.length > glanceItems.length ? `${needsBuy.length - glanceItems.length} more item${needsBuy.length - glanceItems.length === 1 ? '' : 's'} need a look` : 'You’re up to date'}</span><button type="button" onClick={showAllNeeds}>{needsBuy.length ? `See all ${needsBuy.length} items` : 'See your pantry' }<Icon name="arrow" size={15} /></button></div></section>
    <section className="a-inventory" id="a-inventory"><div className="section-heading"><div><span className="eyebrow">YOUR KITCHEN</span><h2>Take a look around</h2></div><span className="sort-note">Grouped by shelf</span></div><Filters search={search} category={category} lowOnly={lowOnly} onSearch={onSearch} onCategory={onCategory} onLowOnly={onLowOnly} />
      {filtered.length === 0 ? <EmptyState /> : groups.map((group) => { const shelfItems = filtered.filter((item) => item.category === group); return <section className="shelf-section" key={group}><div className="shelf-heading"><div><span className="shelf-kicker">SHELF</span><h3>{group}</h3></div><span>{shelfItems.length} {shelfItems.length === 1 ? 'food' : 'foods'}</span></div><div className="shelf-items">{shelfItems.map((item: PantryItem) => <article className="shelf-item" key={item.id}><div className="shelf-item-copy"><span className={`shelf-marker mark-${item.level}`} /><ItemIllustration item={item} /><div><h4>{item.name}</h4><span>{item.location} · {item.category}</span></div></div><div className="shelf-item-stock"><StatusPill item={item} /><AmountLabel item={item} /><button type="button" className="round-action" aria-label={`Restock ${item.name}`} title="Add one locally" onClick={() => onRestock(item.id)}><Icon name="plus" /></button></div></article>)}</div><div className="shelf-board" /></section>; })}
    </section>
    <footer className="a-footer"><Brand /><span>Good food, accounted for.</span></footer>
  </main>;
};

const illustrationIndex: Record<string, number> = {
  Vegetables: 8, Fruit: 5, 'Rice & grains': 1, Millets: 1, 'Dals & beans': 9,
  'Atta & flours': 0, 'Rava & semolina': 0, 'Pasta & noodles': 2,
  'Baking & dessert ingredients': 0, 'Whole spices & herbs': 11,
  'Ground spices & masalas': 3, 'Oils & ghee': 6,
  'Pickles, chutneys & condiments': 3, 'Sugar, jaggery & sweeteners': 6,
  'Nuts & seeds': 4, 'Dried fruit': 5, 'Bread & bakery': 7,
  'Dairy & eggs': 10, 'Meat & poultry': 10, 'Fish & seafood': 10,
  'Plant-based proteins': 9, 'Packaged meals': 1, 'Snacks & sweets': 7,
  Drinks: 6, 'Kitchen & food storage supplies': 13, 'Cleaning & laundry': 12,
  'Personal care': 14, 'Household essentials': 15,
};
const itemIllustrationIndex: Record<string, number> = {
  'Cocoa powder': 6, 'Custard powder': 6, Falooda: 6, Honey: 6,
  Jaggery: 6, Mishri: 6,
};

const ItemIllustration: React.FC<{ item: PantryItem }> = ({ item }) => {
  const index = itemIllustrationIndex[item.name] ?? illustrationIndex[item.category];
  const position = index === undefined ? 'center' : `${(index % 4) * (100 / 3)}% ${Math.floor(index / 4) * (100 / 3)}%`;
  return <span className="item-illustration" aria-hidden="true"><span className="item-illustration-sprite" style={{ backgroundPosition: position, backgroundImage: index === undefined ? 'none' : undefined }} /><span className="item-illustration-fallback"><Icon name={item.category.includes('Kitchen') || item.category.includes('Cleaning') ? 'box' : 'spark'} size={19} /></span></span>;
};
