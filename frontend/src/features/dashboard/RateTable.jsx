import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../api/api';
import { formatMonthLabel } from './DieselPriceTable';

const VISIBLE_MONTHS = 12;
const LABEL_COL_WIDTH = 150;
const BASE_COL_WIDTH = 100;
const FIXED_COLS_WIDTH = LABEL_COL_WIDTH + BASE_COL_WIDTH;
const MIN_MONTH_COL_WIDTH = 80;

function formatNumber(value, decimals) {
  return Number.isFinite(value) ? value.toFixed(decimals) : '';
}

// Sizes the table so exactly VISIBLE_MONTHS month columns fit beside the two fixed columns.
function tableSizing(monthCount) {
  const ratio = monthCount / VISIBLE_MONTHS;
  return {
    width: `calc(${ratio * 100}% + ${FIXED_COLS_WIDTH * (1 - ratio)}px)`,
    minWidth: FIXED_COLS_WIDTH + monthCount * MIN_MONTH_COL_WIDTH,
  };
}

// One "Rate/KM/Ton" card; `tableId` selects the state/tonnage configuration on the server.
// `initialTable` (from the /rate-tables list) skips the per-card fetch.
export default function RateTable({ user, tableId, title, initialTable = null }) {
  const [table, setTable] = useState(initialTable);
  const [draft, setDraft] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const isSuperAdmin = user?.role === 'super_admin';
  const months = useMemo(() => table?.months || [], [table]);
  const rows = table?.rows || [];

  useEffect(() => {
    if (!isSuperAdmin || !tableId) {
      setTable(null);
      return;
    }
    if (initialTable && initialTable.id === tableId) {
      setTable(initialTable);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getRateTable(tableId)
      .then((res) => {
        if (!cancelled) setTable(res.data.rateTable || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Failed to load rate table');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isSuperAdmin, tableId, initialTable]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && months.length) el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [months.length]);

  function baseDraft(row) {
    const pending = draft[row.key];
    return pending !== undefined ? pending : String(row.base);
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

  async function saveBases() {
    setError('');
    const bases = {};
    for (const [key, raw] of Object.entries(draft)) {
      const row = rows.find((r) => r.key === key);
      const value = Number(String(raw).trim());
      if (!Number.isFinite(value) || value < 0) {
        setError(`Enter a valid base value for ${row?.label || key}`);
        return;
      }
      if (row && row.base !== value) bases[key] = value;
    }
    if (!Object.keys(bases).length) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateRateTableBases(tableId, bases);
      setTable(res.data.rateTable || table);
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save base values');
    } finally {
      setSaving(false);
    }
  }

  if (!isSuperAdmin) return null;

  const hasDraft = Object.keys(draft).length > 0;
  const params = table?.params;
  const heading = table?.title || title || 'Rate/KM/Ton';

  return (
    <div className="card ioc-rate-card" style={{ marginBottom: 20 }} data-testid={`rate-table-${tableId}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>{heading}</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!editMode && (
            <button type="button" className="btn" onClick={startEdit} disabled={loading || !table}>
              Edit base values
            </button>
          )}
          {editMode && (
            <>
              <button type="button" className="btn secondary" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={saveBases} disabled={saving || !hasDraft}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="diesel-price-scroll" ref={scrollRef} data-testid="rate-table-scroll" style={{ marginTop: 12 }}>
        <table className="diesel-price-table ioc-rate-table" style={tableSizing(months.length)}>
          <colgroup>
            <col style={{ width: LABEL_COL_WIDTH }} />
            <col style={{ width: BASE_COL_WIDTH }} />
            {months.map((month) => <col key={month} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="diesel-price-sticky">KM</th>
              <th className="diesel-price-sticky ioc-rate-base-col">Base</th>
              {months.map((month) => (
                <th key={month} scope="col">{formatMonthLabel(month)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPriceRow = row.kind === 'price';
              return (
                <tr key={row.key} className={isPriceRow ? 'ioc-rate-price-row' : ''}>
                  <th className="diesel-price-sticky" scope="row">{row.label}</th>
                  <td className="diesel-price-sticky ioc-rate-base-col">
                    {editMode && !isPriceRow ? (
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={baseDraft(row)}
                        onChange={(e) => setDraft((current) => ({ ...current, [row.key]: e.target.value }))}
                        aria-label={`${row.label} base value`}
                      />
                    ) : (
                      formatNumber(row.base, row.decimals)
                    )}
                  </td>
                  {months.map((month) => {
                    const cell = row.values?.[month];
                    const value = cell?.value;
                    const noData = !Number.isFinite(value);
                    const carried = !isPriceRow && cell?.carried;
                    let cellTitle = '';
                    if (isPriceRow && noData) cellTitle = `No ${table?.dieselState || ''} diesel value for this or the previous month`;
                    else if (carried) cellTitle = 'Price 1 paise between -0.01 and 0.01 (or no diesel data) - previous value kept';
                    return (
                      <td key={month} className={carried ? 'ioc-rate-carried' : ''} title={cellTitle}>
                        {noData ? (isPriceRow ? '-' : '') : formatNumber(value, row.decimals)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={months.length + 2} style={{ textAlign: 'center' }}>
                  {loading ? 'Loading...' : 'No rate data yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
      <p className="diesel-price-note">
        Calculated from the {table?.dieselState || 'state'} column of the Average Diesel Price table
        {params ? ` (reference diesel ₹${params.baseDieselPrice}, ${params.kmPerLitre} km/litre, ${params.tonnage} MT)` : ''}.
        Price 1 paise = (this month - previous month diesel) / ({params?.kmPerLitre ?? 3.2} × {params?.tonnage ?? 18});
        Price Escalation = (this month diesel - {params?.baseDieselPrice ?? '-'}) / ({params?.kmPerLitre ?? 3.2} × {params?.tonnage ?? 18}).
        KM bands = Base + Price Escalation × (band midpoint ÷ 2); 451 rows = Base + Price Escalation - both recalculate only when
        Price 1 paise is at least 0.01 up or down, otherwise the previous month&apos;s value is kept (shown in grey). A new month column is added
        automatically on the 1st of every month.
      </p>
    </div>
  );
}
