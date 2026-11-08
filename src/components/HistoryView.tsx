import React, { useMemo } from 'react';
import type { Movement, PantryState } from '../types.ts';
import { fmt, formatUnit } from '../format.ts';
import * as D from '../domain.ts';

interface HistoryViewProps {
  state: PantryState;
}

const actionLabels: Record<Movement['type'], string> = {
  restock: 'Added',
  consume: 'Used',
  discard: 'Discarded',
  correct: 'Adjusted'
};

const dayKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const dayLabel = (date: Date, today: Date): string => {
  const day = dayKey(date);
  if (day === dayKey(today)) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day === dayKey(yesterday)) return 'Yesterday';

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {})
  }).format(date);
};

const amountLabel = (movement: Movement, unit: string | undefined): string => {
  if (unit === 'level') {
    return movement.type === 'correct' ? 'Level changed' : D.level(movement.quantity);
  }

  const sign =
    movement.type === 'restock'
      ? '+'
      : movement.type === 'correct'
        ? movement.quantity < 0
          ? '−'
          : movement.quantity > 0
            ? '+'
            : ''
        : '−';
  const quantity = Math.abs(movement.quantity);
  const formattedUnit = unit ? ` ${formatUnit(quantity, unit)}` : '';
  return `${sign}${fmt(quantity)}${formattedUnit}`;
};

const timeLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
};

export const HistoryView: React.FC<HistoryViewProps> = ({ state }) => {
  const productMap = useMemo(
    () => new Map(state.products.map((product) => [product.id, product])),
    [state.products]
  );
  const groups = useMemo(() => {
    const today = new Date();
    const byDay = new Map<string, { label: string; movements: Movement[] }>();

    for (const movement of state.movements.slice(-100).reverse()) {
      const date = new Date(movement.at);
      const key = Number.isNaN(date.getTime()) ? 'unknown' : dayKey(date);
      const label = Number.isNaN(date.getTime()) ? 'Unknown date' : dayLabel(date, today);
      const group = byDay.get(key) || { label, movements: [] };
      group.movements.push(movement);
      byDay.set(key, group);
    }

    return [...byDay.values()];
  }, [state.movements]);

  return (
    <div className="activity-view">
      {groups.length > 0 ? (
        <div className="activity-groups">
          {groups.map((group) => (
            <section className="activity-day" aria-label={group.label} key={group.label}>
              <h2>{group.label}</h2>
              <ol>
                {group.movements.map((movement) => {
                  const product = productMap.get(movement.productId);
                  const time = new Date(movement.at);
                  const validTime = !Number.isNaN(time.getTime());

                  return (
                    <li className="activity-event" data-kind={movement.type} key={movement.id}>
                      <span className="activity-marker" aria-hidden="true" />
                      <div className="activity-description">
                        <span className="activity-food">{product?.name || 'Unknown food'}</span>
                        <span className="activity-action">{actionLabels[movement.type]}</span>
                      </div>
                      <div className="activity-meta">
                        <span className="activity-amount">
                          {amountLabel(movement, product?.unit)}
                        </span>
                        <time
                          className="activity-time"
                          dateTime={validTime ? time.toISOString() : undefined}
                        >
                          {timeLabel(movement.at)}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty activity-empty">
          <h2>No activity yet</h2>
        </div>
      )}
    </div>
  );
};
