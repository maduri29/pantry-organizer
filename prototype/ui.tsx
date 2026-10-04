import React from 'react';
import { categories, type PantryItem } from './types.ts';

export type VariantKey = 'A' | 'B' | 'C';
export const variantNames: Record<VariantKey, string> = {
  A: 'Kitchen shelves',
  B: 'Inventory workspace',
  C: 'Grocery trip',
};

export const Icon: React.FC<{ name: 'brand' | 'plus' | 'arrow' | 'box' | 'search' | 'check' | 'minus' | 'spark'; size?: number }> = ({ name, size = 18 }) => {
  const paths: Record<string, React.ReactNode> = {
    brand: <><path d="M4 18.5h16M6.2 18.5V8.3L12 4l5.8 4.3v10.2"/><path d="M9.5 18.5v-5.8h5v5.8M9 9.5h.01M15 9.5h.01"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    box: <><path d="m4 7 8-4 8 4v10l-8 4-8-4z"/><path d="m4 7 8 4 8-4M12 11v10"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    check: <><path d="m4 12 5 5L20 6"/></>,
    minus: <path d="M5 12h14"/>,
    spark: <><path d="m12 3 1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

export interface VariantProps {
  items: PantryItem[];
  filtered: PantryItem[];
  search: string;
  category: string;
  lowOnly: boolean;
  tripIds: string[];
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onLowOnly: () => void;
  onAdd: () => void;
  onRestock: (id: string) => void;
  onUse: (id: string) => void;
  onToggleTrip: (id: string) => void;
}

export const Brand: React.FC<{ light?: boolean }> = ({ light = false }) => (
  <div className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark"><Icon name="brand" size={21} /></span><span>pantry<small>a little less waste.</small></span></div>
);

export const SearchBox: React.FC<{ value: string; onChange: (value: string) => void; placeholder?: string }> = ({ value, onChange, placeholder = 'Search your pantry' }) => (
  <label className="search-box"><Icon name="search" /><span className="sr-only">Search pantry items</span><input value={value} onChange={(event) => onChange(event.currentTarget.value)} placeholder={placeholder} /></label>
);

export const Filters: React.FC<Pick<VariantProps, 'search' | 'category' | 'lowOnly' | 'onSearch' | 'onCategory' | 'onLowOnly'>> = ({ search, category, lowOnly, onSearch, onCategory, onLowOnly }) => (
  <div className="filters">
    <SearchBox value={search} onChange={onSearch} />
    <label className="select-wrap"><span className="sr-only">Filter by category</span><select aria-label="Filter by category" value={category} onChange={(event) => onCategory(event.currentTarget.value)}><option value="all">All categories</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
    <button type="button" className={`toggle-filter ${lowOnly ? 'is-active' : ''}`} aria-pressed={lowOnly} onClick={onLowOnly}><span className="toggle-dot" />Low / out</button>
  </div>
);

export const StatusPill: React.FC<{ item: PantryItem }> = ({ item }) => (
  <span className={`status-pill status-${item.level}`}><span className="status-dot" />{item.level === 'ready' ? 'On hand' : item.level === 'low' ? 'Running low' : 'Out'}</span>
);

export const AmountLabel: React.FC<{ item: PantryItem }> = ({ item }) => <span className="amount-label">{item.amount} <small>{item.unit}</small></span>;

export const AddButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Add food' }) => <button type="button" className="primary-button" onClick={onClick}><Icon name="plus" />{label}</button>;

export const EmptyState: React.FC = () => <div className="empty-state"><span className="empty-icon"><Icon name="box" size={24} /></span><strong>No matching food</strong><span>Try another name or category.</span></div>;

export const AddModal: React.FC<{ onClose: () => void; onSave: (values: { name: string; category: string; amount: number; unit: PantryItem['unit'] }) => void }> = ({ onClose, onSave }) => {
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState<string>('Other');
  const [amount, setAmount] = React.useState('2');
  const [unit, setUnit] = React.useState<PantryItem['unit']>('items');
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-title" onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; onSave({ name: name.trim(), category, amount: Math.max(0, Number(amount) || 0), unit }); }}>
    <div className="modal-head"><div><span className="eyebrow">LOCAL DEMO</span><h2 id="add-title">Add something to the pantry</h2></div><button type="button" className="close-button" aria-label="Close add food dialog" onClick={onClose}>×</button></div>
    <label className="field-label">Food name<input autoFocus required value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="e.g. Brown rice" /></label>
    <label className="field-label">Category<select value={category} onChange={(event) => setCategory(event.currentTarget.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
    <div className="amount-fields"><label className="field-label">What’s left<input type="number" min="0" step="0.5" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} /></label><label className="field-label">Unit<select value={unit} onChange={(event) => setUnit(event.currentTarget.value as PantryItem['unit'])}>{(['items', 'g', 'kg', 'lb'] as const).map((value) => <option key={value}>{value}</option>)}</select></label></div>
    <p className="prototype-note">This is an in-memory sample. Nothing is saved or shared.</p>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Icon name="plus" />Add food</button></div>
  </form></div>;
};

export const PrototypeSwitcher: React.FC<{ current: VariantKey; onChange: (key: VariantKey) => void }> = ({ current, onChange }) => {
  // The prototype server binds to loopback only; this guard keeps the switcher out of production origins.
  if (window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost') return null;
  const keys: VariantKey[] = ['A', 'B', 'C'];
  const index = keys.indexOf(current);
  return <nav className="prototype-switcher" aria-label="Prototype variations"><button type="button" aria-label="Previous variation" onClick={() => onChange(keys[(index + keys.length - 1) % keys.length])}>←</button><span><b>{current}</b><span>{variantNames[current]}</span></span><button type="button" aria-label="Next variation" onClick={() => onChange(keys[(index + 1) % keys.length])}>→</button></nav>;
};
