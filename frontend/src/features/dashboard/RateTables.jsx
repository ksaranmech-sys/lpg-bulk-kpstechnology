import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../../api/api';
import RateTable from './RateTable';

// Number of manually entered month cells across the given tables.
function countManualCells(tables) {
  return tables.reduce((total, table) => total + (table.rows || []).reduce((rowTotal, row) => (
    rowTotal + Object.values(row.values || {}).filter((cell) => cell?.overridden).length
  ), 0), 0);
}

// Super admin: one Rate/KM/Ton card per configured table (every state x tonnage class), in the
// server's order, so adding a table on the backend shows it here without a frontend change.
// "Recalculate all" clears every manually entered month value in every table (Base edits kept).
export default function RateTables({ user }) {
  const [tables, setTables] = useState([]);
  const [error, setError] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [notice, setNotice] = useState(null); // { text, failed }
  const isSuperAdmin = user?.role === 'super_admin';
  const manualCells = useMemo(() => countManualCells(tables), [tables]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setTables([]);
      return undefined;
    }
    let cancelled = false;
    api.listRateTables()
      .then((res) => { if (!cancelled) setTables(res.data.rateTables || []); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.error || 'Failed to load rate tables'); });
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  async function recalculateAll() {
    if (!window.confirm(`Recalculate all Rate/KM/Ton tables? This clears ${manualCells} manually entered month value(s) across every table so each cell shows the figure calculated from the diesel prices. Base values are kept.`)) return;
    setNotice(null);
    setRecalculating(true);
    try {
      const res = await api.recalculateRateTables();
      setTables(res.data.rateTables || []);
      setNotice({ text: 'All Rate/KM/Ton tables recalculated from the diesel prices.', failed: false });
    } catch (err) {
      setNotice({ text: err.response?.data?.error || 'Failed to recalculate rate tables', failed: true });
    } finally {
      setRecalculating(false);
    }
  }

  if (!isSuperAdmin) return null;
  if (error) return <div className="card" style={{ marginTop: 24 }}><p className="error-text">{error}</p></div>;
  if (!tables.length) return null;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }} data-testid="rate-tables-toolbar">
        {notice && (
          <span className={notice.failed ? 'error-text' : ''} style={{ margin: 0, fontSize: 13, color: notice.failed ? undefined : '#047857' }} role="status">
            {notice.text}
          </span>
        )}
        <button
          type="button"
          className="btn secondary"
          onClick={recalculateAll}
          disabled={recalculating}
          title={manualCells ? `${manualCells} manually entered month value(s) will be cleared` : 'No manually entered month values - every cell is already calculated'}
        >
          {recalculating ? 'Recalculating...' : 'Recalculate all tables'}
        </button>
      </div>
      {tables.map((table) => (
        <RateTable key={table.id} user={user} tableId={table.id} title={table.title} initialTable={table} />
      ))}
    </>
  );
}
