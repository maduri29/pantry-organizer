import React from 'react';
import { level as levelLabel } from '../domain.ts';
import { formatUnit } from '../format.ts';

export const LevelPicker: React.FC<{
  name: string;
  value: string;
  onChange: (value: string) => void;
  restock?: boolean;
}> = ({ name, value, onChange, restock = false }) => (
  <div className="level-picker">
    {(restock ? [1, 0.5, 0.25] : [1, 0.5, 0.25, 0]).map((level) => (
      <label className={Number(value) === level && value !== '' ? 'is-selected' : ''} key={level}>
        <input
          type="radio"
          name={name}
          value={String(level)}
          checked={value === String(level)}
          onChange={() => onChange(String(level))}
          required
        />
        <svg aria-hidden="true" viewBox="0 0 24 28">
          <path className="level-vessel" d="M4 3h16v22H4z" />
          {level > 0 && <rect x="7" y={22 - level * 15} width="10" height={level * 15} />}
        </svg>
        <span>{levelLabel(level)}</span>
      </label>
    ))}
  </div>
);

export const QuantityInput: React.FC<{
  name: string;
  value: string;
  unit: string;
  onChange: (value: string) => void;
  restock?: boolean;
  id?: string;
}> = ({ name, value, unit, onChange, restock = false, id }) => (
  <div className="quantity-stepper">
    <button
      type="button"
      aria-label={`Decrease ${unit}`}
      disabled={!Number.isFinite(Number(value)) || Number(value) <= (restock ? 1 : 0)}
      onClick={() =>
        onChange(String(Math.max(restock ? 1 : 0, Number((Number(value) - 1).toFixed(3)))))
      }
    >
      −
    </button>
    <input
      id={id}
      aria-label={restock ? `Amount bought (${unit})` : `Amount left (${unit})`}
      name={name}
      type="number"
      inputMode="decimal"
      min={restock ? '0.000001' : '0'}
      step="any"
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    <span>{formatUnit(Number(value), unit)}</span>
    <button
      type="button"
      aria-label={`Increase ${unit}`}
      onClick={() => onChange(String(Number((Number(value || 0) + 1).toFixed(3))))}
    >
      +
    </button>
  </div>
);
