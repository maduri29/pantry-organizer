import React from 'react';
import { AmountLabel, EmptyState, Filters, Icon, StatusPill, type VariantProps } from './ui.tsx';

export const VariantD: React.FC<VariantProps> = ({ items, filtered, search, category, lowOnly, onSearch, onCategory, onLowOnly, onAdd, onRestock }) => {
  const attention = items.filter((item) => item.level !== 'ready').length;
  return <main className="variant-d">
    <header className="d-top"><div className="d-wordmark"><span className="d-mark"><Icon name="brand" size={21} /></span><span>pantry<span>THE HOUSEHOLD INDEX</span></span></div><span className="d-edition">ISSUE 01 <i /> HOME STOCK</span><button className="d-add" type="button" onClick={onAdd}><Icon name="plus" /> Add a food</button></header>
    <section className="d-hero"><div><span className="d-kicker">A GOOD PANTRY IS A COOK'S BEST TOOL</span><h1>Cook from<br />the good stuff.</h1><p>A clear view of what's here, so dinner starts with possibility.</p></div><div className="d-hero-note"><span>AT A GLANCE</span><div><strong>{attention.toString().padStart(2, '0')}</strong><b>foods to check</b></div><div><strong>{items.length.toString().padStart(2, '0')}</strong><b>in the cupboard</b></div><small>Keep the everyday close.</small></div></section>
    <section className="d-inventory"><div className="d-section-top"><div><span className="d-kicker">THE PANTRY, IN GOOD ORDER</span><h2>Household stock <span>{filtered.length.toString().padStart(2, '0')}</span></h2></div><span className="d-legend"><i /> Ready <i className="amber" /> Check soon</span></div><Filters search={search} category={category} lowOnly={lowOnly} onSearch={onSearch} onCategory={onCategory} onLowOnly={onLowOnly} />
      {filtered.length ? <div className="d-index">{filtered.map((item, index) => <article className={`d-stock-line ${item.level !== 'ready' ? 'needs-check' : ''}`} key={item.id}><span className="d-row-number">{(index + 1).toString().padStart(2, '0')}</span><div className="d-stock-copy"><strong>{item.name}</strong><span>{item.category}</span></div><StatusPill item={item} /><div className="d-amount"><AmountLabel item={item} /><span>{item.location}</span></div><button className="d-restock" type="button" aria-label={`Restock ${item.name}`} title="Add one to sample stock" onClick={() => onRestock(item.id)}><Icon name="plus" /></button></article>)}</div> : <EmptyState />}
      <footer className="d-note"><span>THE PANTRY INDEX</span><span>Illustrative sample stock · changes stay in this tab</span></footer>
    </section>
  </main>;
};
