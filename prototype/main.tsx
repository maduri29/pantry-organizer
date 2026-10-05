// Throwaway UI study: three different ways to work with the pantry inventory.
// Served only by `bun run prototype` on loopback; production src/main.tsx never imports this route.
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VariantA } from './VariantA.tsx';
import { VariantB } from './VariantB.tsx';
import { VariantC } from './VariantC.tsx';
import { VariantD } from './VariantD.tsx';
import { VariantE } from './VariantE.tsx';
import { VariantF } from './VariantF.tsx';
import { AddModal, PrototypeSwitcher, type VariantKey, variantNames } from './ui.tsx';
import { seedItems, type PantryItem, type StockLevel } from './types.ts';

const readVariant = (): VariantKey => {
  const value = new URLSearchParams(window.location.search).get('variant');
  return value === 'A' || value === 'B' || value === 'C' || value === 'D' || value === 'E' || value === 'F' ? value : 'D';
};

const PrototypeApp: React.FC = () => {
  const [variant, setVariant] = useState<VariantKey>(readVariant);
  const [items, setItems] = useState<PantryItem[]>(() => seedItems.map((item) => ({ ...item })));
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [lowOnly, setLowOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [tripIds, setTripIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  const changeVariant = (next: VariantKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setVariant(next);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest('input, textarea, select, [contenteditable="true"]') || target.isContentEditable)) return;
      event.preventDefault();
      const keys: VariantKey[] = ['A', 'B', 'C', 'D', 'E', 'F'];
      const index = keys.indexOf(variant);
      changeVariant(keys[(index + (event.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [variant]);

  const filtered = useMemo(() => items.filter((item) => {
    const matchesText = item.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = category === 'all' || item.category === category;
    const matchesLevel = !lowOnly || item.level !== 'ready';
    return matchesText && matchesCategory && matchesLevel;
  }), [items, search, category, lowOnly]);

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1800);
  };

  const restock = (id: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, amount: item.amount + 1, level: 'ready' as StockLevel } : item));
    const item = items.find((entry) => entry.id === id);
    if (item) announce(`${item.name}: sample stock increased`);
  };

  const useOne = (id: string) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const amount = Math.max(0, item.amount - 1);
      return { ...item, amount, level: amount === 0 ? 'out' : amount <= 1 ? 'low' : 'ready' };
    }));
    const item = items.find((entry) => entry.id === id);
    if (item) announce(`${item.name}: sample stock adjusted`);
  };

  const checkIn = (id: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, amount: Math.max(item.amount, 2), level: 'ready' } : item));
    const item = items.find((entry) => entry.id === id);
    if (item) announce(`${item.name}: marked on hand in this demo`);
  };

  const addItem = (values: { name: string; category: string; amount: number; unit: PantryItem['unit'] }) => {
    const id = `demo-new-${Date.now()}`;
    const item: PantryItem = { ...values, id, location: 'Pantry', level: values.amount === 0 ? 'out' : values.amount <= 1 ? 'low' : 'ready' };
    setItems((current) => [item, ...current]);
    setCategory('all');
    setSearch('');
    setAddOpen(false);
    announce(`${values.name} added to this sample view`);
  };

  const common = { items, filtered, search, category, lowOnly, tripIds, onSearch: setSearch, onCategory: setCategory, onLowOnly: () => setLowOnly((value) => !value), onAdd: () => setAddOpen(true), onRestock: restock, onUse: useOne, onToggleTrip: (id: string) => setTripIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) };
  const variants = { A: VariantA, B: VariantB, C: VariantC, D: VariantD, E: VariantE, F: VariantF };
  const CurrentVariant = variants[variant];

  return <div className={`prototype-root theme-${variant.toLowerCase()}`} data-variant={variant}>
    <div className="prototype-disclaimer"><span><i /> DESIGN PROTOTYPE</span><span>53 familiar foods · illustrative stock · no cloud connection</span><a href="/screenshots.html">Screenshots</a></div>
    <CurrentVariant {...common} />
    <PrototypeSwitcher current={variant} onChange={changeVariant} />
    {addOpen && <AddModal onClose={() => setAddOpen(false)} onSave={addItem} />}
    <div className={`prototype-toast ${notice ? 'is-visible' : ''}`} role="status" aria-live="polite">{notice}</div>
    <span className="sr-only" aria-live="polite">Showing variation {variant}: {variantNames[variant]}</span>
  </div>;
};

const mount = document.getElementById('app');
if (mount) createRoot(mount).render(<PrototypeApp />);
