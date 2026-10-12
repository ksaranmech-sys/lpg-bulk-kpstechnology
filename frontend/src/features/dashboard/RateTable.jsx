import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../api/api';
import { formatMonthLabel } from './DieselPriceTable';

const VISIBLE_MONTHS = 12;
const LABEL_COL_WIDTH = 150;
const BASE_COL_WIDTH = 140;
const FIXED_COLS_WIDTH = LABEL_COL_WIDTH + BASE_COL_WIDTH;
const MIN_MONTH_COL_WIDTH = 80;

function formatNumber(value, decimals) {
  return Number.isFinite(value) ? value.toFixed(decimals) : '';
}

function formatPercent(rate) {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

// Tooltip for a cell in a month where the Base was revised (contract years 4 and 5).
function revisionTitle(revision, row) {
  const avgKm = row.kind === 'band' ? `${row.averageKm ?? ''} km × ` : '';
  return `Base revised to ${formatNumber(revision.base, row.decimals)} from this month: `
    + `R ${formatNumber(revision.previousValue, row.decimals)} (${formatMonthLabel(revision.dieselMonth)} value) `
    + `− F ${formatNumber(revision.fuel, row.decimals)} (${avgKm}diesel ₹${revision.dieselPrice} ÷ km/litre × MT) `
    + `× ${formatPercent(revision.rate)} = +${formatNumber(revision.increment, row.decimals)}`;
}

const TENDER_BASE_LABEL = 'Tender base rate';

// Contract-year label for the n-th scheduled Base revision: the first (Sep-28) starts year 4, the second (Sep-29) year 5.
function ordinal(n) {
  const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

function revisionYearLabel(scheduledRevisions, scheduledMonth) {
  const index = scheduledRevisions.findIndex((rev) => rev.month === scheduledMonth);
  return index === -1 ? null : `${ordinal(index + 4)} year Base rate`;
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
  const [cellDrafts, setCellDrafts] = useState({});
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

  // Month-cell drafts: { [rowKey]: { [month]: string } }. Empty string = clear the manual value.
  function cellDraft(row, month) {
    const pending = cellDrafts[row.key]?.[month];
    if (pending !== undefined) return pending;
    const value = row.values?.[month]?.value;
    return Number.isFinite(value) ? String(value) : '';
  }

  function setCellDraft(row, month, value) {
    setCellDrafts((current) => ({ ...current, [row.key]: { ...(current[row.key] || {}), [month]: value } }));
  }

  function startEdit() {
    setError('');
    setDraft({});
    setCellDrafts({});
    setEditMode(true);
  }

  function cancelEdit() {
    setDraft({});
    setCellDrafts({});
    setEditMode(false);
  }

  async function saveChanges() {
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
    const cells = {};
    for (const [key, byMonth] of Object.entries(cellDrafts)) {
      const row = rows.find((r) => r.key === key);
      for (const [month, raw] of Object.entries(byMonth)) {
        const current = row?.values?.[month];
        const text = String(raw).trim();
        if (text === '') {
          // Blank clears a manual value; blank on a calculated cell changes nothing.
          if (current?.overridden) (cells[key] = cells[key] || {})[month] = null;
          continue;
        }
        const value = Number(text);
        if (!Number.isFinite(value) || value < 0) {
          setError(`Enter a valid value for ${row?.label || key} ${formatMonthLabel(month)}`);
          return;
        }
        if (current?.value !== value) (cells[key] = cells[key] || {})[month] = value;
      }
    }
    if (!Object.keys(bases).length && !Object.keys(cells).length) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      let next = table;
      if (Object.keys(bases).length) {
        const res = await api.updateRateTableBases(tableId, bases);
        next = res.data.rateTable || next;
      }
      if (Object.keys(cells).length) {
        const res = await api.updateRateTableCells(tableId, cells);
        next = res.data.rateTable || next;
      }
      setTable(next);
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  if (!isSuperAdmin) return null;

  const hasDraft = Object.keys(draft).length > 0 || Object.keys(cellDrafts).length > 0;
  const params = table?.params;
  const heading = table?.title || title || 'Rate/KM/Ton';
  const scheduledRevisions = params?.baseRevisions || [];
  const referenceDiesel = table?.referenceDiesel || {};
  const baseMonthLabel = params?.baseDieselMonth ? formatMonthLabel(params.baseDieselMonth) : 'Dec-24';
  const hasBaseDiesel = Number.isFinite(params?.baseDieselPrice);
  const baseHeading = TENDER_BASE_LABEL;
  // Label for a revised Base applied in `month` (which may be later than the scheduled month when diesel data was missing).
  const revisedBaseLabel = (month) => revisionYearLabel(scheduledRevisions, table?.revisions?.[month]?.scheduledMonth ?? month)
    || formatMonthLabel(month);

  return (
    <div className="card ioc-rate-card" style={{ marginBottom: 20 }} data-testid={`rate-table-${tableId}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>{heading}</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!editMode && (
            <button type="button" className="btn" onClick={startEdit} disabled={loading || !table}>
              Edit values
            </button>
          )}
          {editMode && (
            <>
              <button type="button" className="btn secondary" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={saveChanges} disabled={saving || !hasDraft}>
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
              <th className="diesel-price-sticky ioc-rate-base-col" title={`The tender's base rate per row (editable, ${baseMonthLabel} reference); KM and 451 values are calculated from it`}>{baseHeading}</th>
              {months.map((month) => (
                <th key={month} scope="col">{formatMonthLabel(month)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPriceRow = row.kind === 'price';
              const isEscalationRow = row.key === 'price-escalation';
              const revisedBases = Object.entries(row.revisions || {});
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
                    {revisedBases.map(([month, revision]) => (
                      <div key={month} className="ioc-rate-revised-base" title={`${formatMonthLabel(month)} - ${revisionTitle(revision, row)}`}>
                        {revisedBaseLabel(month)}: {formatNumber(revision.base, row.decimals)}
                      </div>
                    ))}
                  </td>
                  {months.map((month) => {
                    const cell = row.values?.[month];
                    const value = cell?.value;
                    const noData = !Number.isFinite(value);
                    const carried = !isPriceRow && cell?.carried;
                    const overridden = !isPriceRow && cell?.overridden;
                    const revision = !isPriceRow ? cell?.revision : undefined;
                    let cellTitle = '';
                    if (isEscalationRow && noData && !hasBaseDiesel) cellTitle = `No ${table?.dieselState || ''} diesel value for ${baseMonthLabel} - enter it in the Average Diesel Price table`;
                    else if (isPriceRow && noData) cellTitle = `No ${table?.dieselState || ''} diesel value for this or the previous month`;
                    else if (isEscalationRow && Number.isFinite(referenceDiesel[month]) && referenceDiesel[month] !== params?.baseDieselPrice) cellTitle = `Against the revised reference diesel ₹${referenceDiesel[month]}${Number.isFinite(cell?.exact) ? ` (exact ${cell.exact.toFixed(6)})` : ''}`;
                    else if (isPriceRow && Number.isFinite(cell?.exact)) cellTitle = `Exact value ${cell.exact.toFixed(6)} - used by the KM and 451 rows`;
                    else if (overridden) cellTitle = `Entered manually (calculated value ${formatNumber(cell.calculated, row.decimals)})`;
                    else if (revision) cellTitle = revisionTitle(revision, row);
                    else if (carried) cellTitle = 'Price 1 paise between -0.01 and 0.01 (or no diesel data) - previous value kept';
                    const className = [
                      carried ? 'ioc-rate-carried' : '',
                      overridden ? 'ioc-rate-overridden' : '',
                      revision ? 'ioc-rate-revised' : '',
                    ].filter(Boolean).join(' ');
                    if (editMode && !isPriceRow) {
                      return (
                        <td key={month} className={className} title={overridden ? `${cellTitle} - clear to use the calculated value` : 'Enter a value to replace the calculated one'}>
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={cellDraft(row, month)}
                            onChange={(e) => setCellDraft(row, month, e.target.value)}
                            aria-label={`${row.label} ${formatMonthLabel(month)} value`}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={month} className={className} title={cellTitle}>
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
      {params && !hasBaseDiesel && (
        <p className="error-text" style={{ marginTop: 12 }}>
          Price Escalation needs the {table?.dieselState || 'state'} diesel price for {baseMonthLabel}. Enter it in the Average Diesel Price
          table; until then every row keeps its Base.
        </p>
      )}
      <p className="diesel-price-note">
        Calculated from the {table?.dieselState || 'state'} column of the Average Diesel Price table
        {params ? ` (reference diesel ${baseMonthLabel} ${hasBaseDiesel ? `₹${params.baseDieselPrice}` : 'not yet entered'}, ${params.kmPerLitre} km/litre, ${params.tonnage} MT)` : ''}.
        Price 1 paise = (this month - previous month diesel) / ({params?.kmPerLitre ?? 3.2} × {params?.tonnage ?? 18});
        Price Escalation = (this month diesel - {baseMonthLabel} diesel{hasBaseDiesel ? ` ₹${params.baseDieselPrice}` : ''}) / ({params?.kmPerLitre ?? 3.2} × {params?.tonnage ?? 18}).
        KM bands = Base + Price Escalation × band midpoint (0~50 → 25, 51~100 → 75.5 ...); 451 rows = Base + Price Escalation - both recalculate only when
        Price 1 paise is at least 0.01 up or down, otherwise the previous month&apos;s value is kept (shown in grey). The Price rows are
        shown to 2 decimals but their exact values are used in the KM and 451 rows and in that check (hover a Price cell to see it). Values entered
        manually with <strong>Edit values</strong> (shown in blue) replace the calculated figure for that month and are carried into
        following months; clear a manual cell to return to the calculated value. A new month column is added automatically on the
        1st of every month.
        {scheduledRevisions.length > 0 && (
          <>
            {' '}Base revisions (shown in amber): {scheduledRevisions.map((rev) => `${revisionYearLabel(scheduledRevisions, rev.month)} on ${formatMonthLabel(rev.month)} (${formatPercent(rev.rate)})`).join(' and ')}:
            new Base = R + (R − F) × increment, where R is the row&apos;s previous-month (August) value and
            F = average KM × August diesel ÷ ({params?.kmPerLitre ?? 3.2} × {params?.tonnage ?? 18}) for KM bands (e.g. 0~50 → 25 km)
            or August diesel ÷ ({params?.kmPerLitre ?? 3.2} × {params?.tonnage ?? 18}) for the 451 rows. From that month Price Escalation
            is measured against the August diesel price and the usual calculation continues on the new Base; the {baseHeading} column lists the
            original (editable) value followed by the 4th and 5th year Base rates.
          </>
        )}
      </p>
    </div>
  );
}
