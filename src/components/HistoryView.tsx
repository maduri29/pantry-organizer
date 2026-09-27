import React, { useMemo } from 'react';
import * as D from '../domain.ts';
import type { Movement, PantryState } from '../types.ts';
import { fmt } from './InventoryView.tsx';

interface HistoryViewProps {
  state: PantryState;
}

const actionLabels: Record<string, string> = {
  restock: 'Added',
  consume: 'Used',
  discard: 'Discarded',
  correct: 'Corrected by'
};

export const HistoryView: React.FC<HistoryViewProps> = ({ state: s }) => {
  const productMap = useMemo(() => new Map(s.products.map((p) => [p.id, p])), [s.products]);
  const movements = useMemo(() => s.movements.slice().reverse().slice(0, 100), [s.movements]);

  return (
    <>
      <p className="section-caption">
        A quiet record of additions and stock check-ins. No need to log every use.
      </p>

      {movements.length > 0 ? (
        <table className="history">
          <thead>
            <tr>
              <th>Food</th>
              <th>Action</th>
              <th>Amount</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m: Movement) => {
              const p = productMap.get(m.productId);
              const amountStr =
                p?.unit === 'level'
                  ? m.type === 'correct'
                    ? 'Level updated'
                    : D.level(m.quantity)
                  : `${fmt(m.quantity)} ${p?.unit || ''}`;

              return (
                <tr key={m.id}>
                  <td>{p?.name || 'Unknown'}</td>
                  <td>{actionLabels[m.type] || m.type}</td>
                  <td>{amountStr}</td>
                  <td>{new Date(m.at).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="empty">
          <h2>Your pantry’s story starts here</h2>
          <p>Add a food to record your first activity.</p>
        </div>
      )}
    </>
  );
};
