import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../api/api';

const VISIBLE_MONTHS = 12;
const STATE_COL_WIDTH = 140;
const MIN_MONTH_COL_WIDTH = 58;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-04' -> 'Apr-26'
export function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-');
  const name = MONTH_NAMES[Number(month) - 1];
  if (!name || !year) return monthKey || '';
  return `${name}-${year.slice(-2)}`;
}

function formatPrice(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '';
}

function formatSyncedAt(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

// Sizes the table so exactly VISIBLE_MONTHS month columns fit the scroll container; the rest
// scroll horizontally. Width is relative to the container so it adapts to the card width.
function tableSizing(monthCount) {
  const ratio = monthCount / VISIBLE_MONTHS;
  return {
    width: `calc(${ratio * 100}% + ${STATE_COL_WIDTH * (1 - ratio)}px)`,
    minWidth: STATE_COL_WIDTH + monthCount * MIN_MONTH_COL_WIDTH,
  };
}

export default function DieselPriceTable({ user }) {
  const [table, setTable] = useState(null);
  const [draft, setDraft] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const isSuperAdmin = user?.role === 'super_admin';
  const months = useMemo(() => table?.months || [], [table]);
  const rows = useMemo(
    () => table?.rows || (table?.states || []).map((state) => ({ state, city: '' })),
    [table]
  );

  useEffect(() => {
    if (!isSuperAdmin) {
      setTable(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getDieselPriceTable()
      .then((res) => {
        if (!cancelled) setTable(res.data.dieselPriceTable || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Failed to load diesel prices');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  // Latest months live on the right; start scrolled there so the most recent year is in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && months.length) el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [months.length]);

  function cellFor(state, month) {
    return table?.cells?.[state]?.[month] || null;
  }

  function draftValue(state, month) {
    const pending = draft[state]?.[month];
    if (pending !== undefined) return pending;
    const cell = cellFor(state, month);
    return cell ? String(cell.value) : '';
  }

  function updateDraft(state, month, value) {
    setDraft((current) => ({ ...current, [state]: { ...(current[state] || {}), [month]: value } }));
  }

  function startEdit() {
    setError('');
    setDraft({});
    setEditMode(true);
  }

  function cancelEdit() {
    setDraft({});
    setEditMode(false);
  }

  // Only cells whose draft differs from what is stored are sent; '' clears a cell.
  function collectEdits() {
    const cells = {};
    Object.entries(draft).forEach(([state, monthsDraft]) => {
      Object.entries(monthsDraft).forEach(([month, raw]) => {
        const trimmed = String(raw ?? '').trim();
        const existing = cellFor(state, month);
        if (trimmed === '') {
          if (existing) cells[state] = { ...(cells[state] || {}), [month]: null };
          return;
        }
        const value = Number(trimmed);
        if (!Number.isFinite(value) || value < 0) {
          throw new Error(`Enter a valid price for ${state} (${formatMonthLabel(month)})`);
        }
        if (existing && existing.source === 'manual' && existing.value === value) return;
        cells[state] = { ...(cells[state] || {}), [month]: value };
      });
    });
    return cells;
  }

  async function saveEdits() {
    setError('');
    let cells;
    try {
      cells = collectEdits();
    } catch (err) {
      setError(err.message);
      return;
    }
    if (!Object.keys(cells).length) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateDieselPriceTable(cells);
      setTable(res.data.dieselPriceTable || table);
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save diesel prices');
    } finally {
      setSaving(false);
    }
  }

  async function syncNow() {
    setError('');
    setSyncing(true);
    try {
      const res = await api.syncDieselPriceTable();
      setTable(res.data.dieselPriceTable || table);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to refresh prices from v3cars');
    } finally {
      setSyncing(false);
    }
  }

  if (!isSuperAdmin) return null;

  const hasDraft = Object.keys(draft).length > 0;
  const lastSyncedAt = formatSyncedAt(table?.lastSyncedAt);

  return (
    <div className="card diesel-price-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>Average Diesel Price</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!editMode && (
            <>
              <button type="button" className="btn secondary" onClick={syncNow} disabled={syncing || loading}>
                {syncing ? 'Refreshing...' : 'Refresh prices'}
              </button>
              <button type="button" className="btn" onClick={startEdit} disabled={loading || !table}>
                Edit
              </button>
            </>
          )}
          {editMode && (
            <>
              <button type="button" className="btn secondary" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={saveEdits} disabled={saving || !hasDraft}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="diesel-price-scroll" ref={scrollRef} data-testid="diesel-price-scroll" style={{ marginTop: 12 }}>
        <table className="diesel-price-table" style={tableSizing(months.length)}>
          <colgroup>
            <col style={{ width: STATE_COL_WIDTH }} />
            {months.map((month) => <col key={month} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="diesel-price-sticky" aria-hidden="true" />
              <th colSpan={Math.max(months.length, 1)} className="diesel-price-group">
                <span className="diesel-price-group-label">Average Diesel Price (₹ / litre)</span>
              </th>
            </tr>
            <tr>
              <th className="diesel-price-sticky">State (city)</th>
              {months.map((month) => (
                <th key={month} scope="col">{formatMonthLabel(month)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ state, city }) => (
              <tr key={state}>
                <th className="diesel-price-sticky" scope="row">
                  {state}
                  {city && <span className="diesel-price-city">{city}</span>}
                </th>
                {months.map((month) => {
                  const cell = cellFor(state, month);
                  const isManual = cell?.source === 'manual';
                  const isBase = cell?.source === 'base';
                  const isFallback = !isManual && cell?.fallback === true;
                  let title = 'No data yet';
                  if (isManual) title = 'Entered manually - kept when prices refresh';
                  else if (isBase) title = `Base diesel price for ${state} - the Price Escalation reference of the Rate/KM/Ton tables (edit to override)`;
                  else if (isFallback) title = `No ${city || 'city'} price available this month - ${state} state-level price used`;
                  else if (cell) title = `Average of ${city || state} daily diesel prices`;
                  const className = isManual ? 'diesel-price-manual' : isFallback ? 'diesel-price-fallback' : '';
                  return (
                    <td key={month} className={className} title={title}>
                      {editMode ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draftValue(state, month)}
                          onChange={(e) => updateDraft(state, month, e.target.value)}
                          aria-label={`${state} ${formatMonthLabel(month)} average diesel price`}
                        />
                      ) : (
                        formatPrice(cell?.value)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={months.length + 1} style={{ textAlign: 'center' }}>
                  {loading ? 'Loading...' : 'No diesel price data yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
      {table?.lastSyncError && !error && (
        <p className="error-text" style={{ marginTop: 12 }}>Last refresh had issues: {table.lastSyncError}</p>
      )}
      <p className="diesel-price-note">
        Each state is priced from its reference city; a month with no city price at all uses the state-level
        price instead (shown in italics). Daily diesel prices are taken from fuelpricetoday.in
        (with v3cars.com filling gaps and older months) and averaged per month; refreshed daily and a new month
        column is added automatically on the 1st of every month
        {lastSyncedAt ? ` (last refreshed ${lastSyncedAt})` : ''}. Scroll left for older months.
        Months with no published data can be entered manually; manual values are highlighted and kept on refresh -
        clear a cell to let it auto-fill again. The first column ({months.length ? formatMonthLabel(months[0]) : 'Dec-24'}) holds
        each state&apos;s base diesel price, the Price Escalation reference of the Rate/KM/Ton tables.
      </p>
    </div>
  );
}
