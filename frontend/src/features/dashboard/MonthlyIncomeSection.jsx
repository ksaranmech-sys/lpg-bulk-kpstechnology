import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { previousMonth, formatMonthLabel, formatDateLong } from '@kps/shared';
import * as api from '../../api/api';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value) => (Number.isFinite(value) ? money.format(value) : 'NA');

// "BPC up to the 5th of the next month; others the calendar month"
function cutoffText(cutoffDays) {
  const entries = Object.entries(cutoffDays || {}).filter(([, day]) => day > 0);
  if (!entries.length) return 'all corporations use the calendar month';
  const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };
  return `${entries.map(([corp, day]) => `${corp} vehicles up to the ${ordinal(day)} of the next month`).join(', ')}; other corporations (IOC, HPC, ...) the calendar month`;
}

// The three most recent completed months admins can open directly without the archive.
function recentMonths(today = new Date()) {
  const last = previousMonth(today);
  const [year, month] = last.split('-').map(Number);
  const beforeLast = previousMonth(new Date(year, month - 1, 1));
  const [beforeYear, beforeMonth] = beforeLast.split('-').map(Number);
  return [last, beforeLast, previousMonth(new Date(beforeYear, beforeMonth - 1, 1))];
}

const cell = { padding: '8px 10px', border: '1px solid #1f4d2b', verticalAlign: 'top' };
const right = { ...cell, textAlign: 'right' };
const head = { ...cell, textAlign: 'left', fontSize: 12 };

// One state's table inside a vehicle-corporation block (e.g. IOC > TN routes).
function IncomeTable({ vehicleCorporation, group }) {
  const { rows, totals } = group;
  const routeNote = group.corporations?.length ? ` (${group.corporations.join(', ')} routes)` : '';
  return (
    <div className="income-group" style={{ marginTop: 12 }} data-testid={`income-group-${vehicleCorporation}-${group.state}`}>
      <h6 style={{ margin: '0 0 6px', fontSize: 13 }}>
        {group.state}{routeNote}
        <span style={{ fontWeight: 400, color: '#4b5f52', fontSize: 12 }}> - {totals.trips} unloading{totals.trips === 1 ? '' : 's'}</span>
      </h6>
      <div style={{ overflowX: 'auto' }}>
        <table className="trip-km-table" style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {[4, 10, 12, 12, 10, 10, 11, 7, 7, 8, 9].map((width, index) => (
              <col key={index} style={{ width: `${width}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...head, whiteSpace: 'nowrap' }}>S.No</th>
              <th style={head}>Vehicle Number</th>
              <th style={head}>Loading location</th>
              <th style={head}>Unloading location</th>
              <th style={head}>Loading date</th>
              <th style={head}>Unloading date</th>
              <th style={{ ...right, fontSize: 12 }}>Trip Income</th>
              <th style={{ ...right, fontSize: 12 }}>Shortage</th>
              <th style={{ ...right, fontSize: 12 }}>TDS</th>
              <th style={{ ...right, fontSize: 12 }}>Diesel</th>
              <th style={{ ...right, fontSize: 12 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.tripId}-${row.leg}`}>
                <td className="num" style={right}>{row.sNo}</td>
                <td style={{ ...cell, fontWeight: 600 }}>
                  <Link to={`/trips/${row.tripId}`}>{row.vehicleNumber || '-'}</Link>
                  {row.status !== 'closed' && (
                    <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>
                      {row.status === 'open' ? 'Open' : 'Closing'}
                    </div>
                  )}
                </td>
                <td style={cell}>{row.loadingLocation || '-'}</td>
                <td style={cell}>
                  {row.unloadingLocation || '-'}
                  {row.leg === 'divert' && <div style={{ fontSize: 11, color: '#4b5f52' }}>Divert (new unloading)</div>}
                </td>
                <td style={cell}>{row.loadingDate ? formatDateLong(row.loadingDate) : '-'}</td>
                <td style={cell}>{row.unloadingDate ? formatDateLong(row.unloadingDate) : '-'}</td>
                <td className="num" style={right}>
                  {formatMoney(row.tripIncome)}
                  {row.tripIncome == null && row.notes?.length > 0 && (
                    <div style={{ fontWeight: 400, fontSize: 11, color: '#8a5a00', textAlign: 'left', whiteSpace: 'normal' }}>{row.notes[0]}</div>
                  )}
                </td>
                <td className="num" style={right}>{formatMoney(row.shortage)}</td>
                <td className="num" style={right}>{formatMoney(row.tds)}</td>
                <td className="num" style={right}>{formatMoney(row.diesel)}</td>
                <td className="num" style={right}>{formatMoney(row.amount)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...right, fontWeight: 700 }} colSpan={6}>
                Total {group.state}
                {totals.pricedTrips < totals.trips && (
                  <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>{totals.trips - totals.pricedTrips} unloading(s) without income not included</div>
                )}
              </td>
              <td className="num" style={{ ...right, fontWeight: 700 }}>{formatMoney(totals.tripIncome)}</td>
              <td className="num" style={{ ...right, fontWeight: 700 }}>{formatMoney(totals.shortage)}</td>
              <td className="num" style={{ ...right, fontWeight: 700 }}>{formatMoney(totals.tds)}</td>
              <td className="num" style={{ ...right, fontWeight: 700 }}>{formatMoney(totals.diesel)}</td>
              <td className="num" style={{ ...right, fontWeight: 700 }}>{formatMoney(totals.amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TotalsRow({ label, sub, totals, strong = false }) {
  return (
    <tr>
      <td style={{ ...cell, fontWeight: 700 }}>
        {label}
        {sub && <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>{sub}</div>}
      </td>
      <td className="num" style={{ ...right, fontWeight: 700 }}>Trip Income {formatMoney(totals.tripIncome)}</td>
      <td className="num" style={{ ...right, fontWeight: 700 }}>Shortage {formatMoney(totals.shortage)}</td>
      <td className="num" style={{ ...right, fontWeight: 700 }}>TDS {formatMoney(totals.tds)}</td>
      <td className="num" style={{ ...right, fontWeight: 700 }}>Diesel {formatMoney(totals.diesel)}</td>
      <td className="num" style={{ ...right, fontWeight: strong ? 800 : 700 }}>Amount {formatMoney(totals.amount)}</td>
    </tr>
  );
}

function TotalsTable({ label, sub, totals, strong }) {
  return (
    <div style={{ marginTop: 10, overflowX: 'auto' }}>
      <table className="trip-km-table" style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <tbody>
          <TotalsRow label={label} sub={sub} totals={totals} strong={strong} />
        </tbody>
      </table>
    </div>
  );
}

// One billing period of a vehicle corporation: IOC / HPC have "1 - 15" and "16 - 30" blocks,
// everyone else a single block covering the whole (cut-off adjusted) month.
function PeriodBlock({ group, period, monthLabel }) {
  const title = `${group.vehicleCorporation} - ${period.label} ${monthLabel}`;
  return (
    <div
      className="income-period"
      style={{ marginTop: 12, padding: '10px 12px', border: '1px solid #c9d8cc', borderRadius: 8, background: '#fbfdfb' }}
      data-testid={`income-period-${group.vehicleCorporation}-${period.key}`}
    >
      <h5 style={{ margin: 0, fontSize: 14 }}>
        {title}
        <span style={{ fontWeight: 400, color: '#4b5f52', fontSize: 12 }}> - {period.totals.trips} unloading{period.totals.trips === 1 ? '' : 's'}</span>
      </h5>
      {period.states.length === 0 && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#4b5f52' }}>No unloadings in this period.</p>}
      {period.states.map((state) => (
        <IncomeTable key={state.state} vehicleCorporation={`${group.vehicleCorporation}-${period.key}`} group={state} />
      ))}
      {period.states.length > 1 && (
        <TotalsTable label={`Total ${title}`} sub={`${period.totals.pricedTrips} of ${period.totals.trips} unloadings priced`} totals={period.totals} />
      )}
    </div>
  );
}

// Main split: one block per vehicle corporation (IOC, BPC, HPC, ...), then per billing period,
// then a table per route state.
function CorporationBlock({ group, monthLabel }) {
  const cutoff = group.cutoffDay > 0 ? `cut-off: up to the ${group.cutoffDay}th of the next month` : 'cut-off: calendar month';
  const billing = group.halfMonth ? 'billed per half month' : 'billed once a month';
  return (
    <div className="income-corporation" style={{ marginTop: 20 }} data-testid={`income-corporation-${group.vehicleCorporation}`}>
      <h4 style={{ margin: '0 0 4px', fontSize: 15, paddingBottom: 4, borderBottom: '2px solid #1f4d2b' }}>
        {group.vehicleCorporation}
        <span style={{ fontWeight: 400, color: '#4b5f52', fontSize: 12 }}> - {group.totals.trips} unloading{group.totals.trips === 1 ? '' : 's'} - {billing} - {cutoff}</span>
      </h4>
      {group.periods.map((period) => (
        <PeriodBlock key={period.key} group={group} period={period} monthLabel={monthLabel} />
      ))}
      {group.periods.length > 1 && (
        <TotalsTable label={`Total ${group.vehicleCorporation} - ${monthLabel}`} sub={`${group.totals.pricedTrips} of ${group.totals.trips} unloadings priced`} totals={group.totals} />
      )}
    </div>
  );
}

// Admin-only: every unloading in a month (a trip's Load leg by its Unloading date, a diverted
// trip's Divert leg by its Divert date) with that leg's Trip Income -> TDS / Diesel / Amount
// split, one table per corporation. Shows last month by default; the month before it is one
// two clicks away and older months are "archived" behind a month picker.
export default function MonthlyIncomeSection({ customerId, className = '' }) {
  const recentMonthKeys = recentMonths();
  const [recentLast] = recentMonthKeys;
  const [month, setMonth] = useState(recentLast);
  const [showArchive, setShowArchive] = useState(false);
  const [income, setIncome] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customerId || !month) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getCustomerMonthlyIncome(customerId, month)
      .then((res) => { if (!cancelled) setIncome(res.data); })
      .catch((err) => { if (!cancelled) { setIncome(null); setError(err.response?.data?.error || 'Failed to load monthly income'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customerId, month]);

  const isArchivedMonth = !recentMonthKeys.includes(month);
  const monthButton = (key) => (
    <button
      key={key}
      type="button"
      className={`btn ${month === key ? '' : 'secondary'}`}
      onClick={() => setMonth(key)}
      style={{ padding: '6px 12px', fontSize: 13 }}
    >
      {formatMonthLabel(key)}
    </button>
  );

  // Browser print dialog, landscape A4, with only this card visible. The document title becomes
  // the default PDF filename when the user picks "Save as PDF".
  function printIncome() {
    const originalTitle = document.title;
    document.title = `Monthly-Income_${formatMonthLabel(month).replace(/\s+/g, '-')}`;
    window.addEventListener('afterprint', () => { document.title = originalTitle; }, { once: true });
    window.print();
  }

  return (
    <div className={`card monthly-income-section monthly-income-print-area ${className}`} style={{ marginTop: 24 }} data-testid="monthly-income">
      <style>{`
        @page { size: A4 landscape; margin: 10mm 12mm 12mm 12mm; }

        @media print {
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000 !important;
          }
          /* Hide everything else outright (not just visibility) so nothing keeps page height
             and the printout never ends with a blank sheet. */
          .topbar,
          .app-shell > *:not(.container),
          .container > *:not(.monthly-income-print-area) {
            display: none !important;
          }
          .monthly-income-print-area {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 6mm 10px !important;
            border: 2px solid #1f4d2b !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
            font-size: 11pt !important;
            line-height: 1.35 !important;
          }
          .monthly-income-print-area .no-print { display: none !important; }
          .monthly-income-print-area .print-only { display: block !important; }
          .monthly-income-print-area .monthly-income-header { display: block !important; margin: 0 0 2pt !important; page-break-after: avoid; break-after: avoid; }
          .monthly-income-print-area h3 {
            font-size: 14pt !important;
            margin: 0 !important;
            padding: 6pt 8pt !important;
            background: #f3f6f3 !important;
            border-bottom: 1px solid #1f4d2b !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .monthly-income-print-area h4 {
            font-size: 12pt !important;
            margin: 3pt 0 2pt !important;
            page-break-after: avoid;
            break-after: avoid;
          }
          .monthly-income-print-area h5 {
            font-size: 11pt !important;
            margin: 2pt 0 1pt !important;
            page-break-after: avoid;
            break-after: avoid;
          }
          .monthly-income-print-area .income-corporation,
          .monthly-income-print-area .income-period,
          .monthly-income-print-area .income-group {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .monthly-income-print-area .income-period { border-color: #1f4d2b !important; background: #fff !important; }
          .monthly-income-print-area h6 {
            font-size: 10.5pt !important;
            margin: 2pt 0 1pt !important;
            page-break-after: avoid;
            break-after: avoid;
          }
          .monthly-income-print-area div { overflow: visible !important; }
          .monthly-income-print-area .income-group { margin-top: 2pt !important; }
          .monthly-income-print-area table {
            min-width: 0 !important;
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10.5pt !important;
          }
          .monthly-income-print-area thead { display: table-header-group; }
          .monthly-income-print-area tr { page-break-inside: avoid; }
          .monthly-income-print-area th,
          .monthly-income-print-area td {
            padding: 5pt 6px !important;
            vertical-align: top !important;
            color: #000 !important;
            border-color: #1f4d2b !important;
          }
          .monthly-income-print-area th div,
          .monthly-income-print-area td div,
          .monthly-income-print-area h6 span {
            font-size: 9pt !important;
          }
          /* Money columns and dates never wrap mid-number. */
          .monthly-income-print-area td.num,
          .monthly-income-print-area td:nth-child(5),
          .monthly-income-print-area td:nth-child(6) { white-space: nowrap !important; }
          .monthly-income-print-area a { color: #000 !important; text-decoration: none !important; }
        }
        .monthly-income-print-area .print-only { display: none; }
      `}</style>
      <div className="monthly-income-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Monthly Income ({formatMonthLabel(month)}){isArchivedMonth ? ' - Archived' : ''}</h3>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {recentMonthKeys.map(monthButton)}
          <button
            type="button"
            className="btn secondary"
            onClick={printIncome}
            disabled={loading || !income || income.groups.length === 0}
            title="Print / Save as PDF (A4 landscape)"
            style={{ padding: '6px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {'\uD83D\uDDA8\uFE0F'} Print
          </button>
        </div>
      </div>
      <p className="print-only" style={{ margin: '0 0 8pt', fontSize: 9, color: '#4b5f52' }}>
        Printed on {formatDateLong(new Date())}
      </p>
      <p className="no-print" style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
        Income for all vehicles unloaded in {formatMonthLabel(month)}, split by the vehicle&apos;s corporation (IOC, BPC, HPC, ...)
        - IOC and HPC in two periods (1-15 and 16-month end), the rest once - and then by the route&apos;s state from the
        KM table (TN, KA, TS, PY, ...) - a trip counts in the
        month of its Unloading date; a diverted trip&apos;s new unloading counts in the month of its Divert date.
        {' '}Cut-off follows the vehicle&apos;s corporation: {cutoffText(income?.cutoffDays)}.
        The three most recent completed months are available above; older months are under archived income.
      </p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p>Loading monthly income...</p>}
      {!loading && !error && income && income.groups.length === 0 && (
        <p>No unloadings in {formatMonthLabel(month)}.</p>
      )}
      {!loading && !error && income && income.groups.map((group) => (
        <CorporationBlock key={group.vehicleCorporation} group={group} monthLabel={formatMonthLabel(month)} />
      ))}
      {!loading && !error && income && income.groups.length > 1 && (
        <div style={{ marginTop: 20, overflowX: 'auto' }}>
          <table className="trip-km-table" style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <tbody>
              <TotalsRow label="Total - all corporations" sub={`${income.totals.pricedTrips} of ${income.totals.trips} unloadings priced`} totals={income.totals} strong />
            </tbody>
          </table>
        </div>
      )}

      <div className="salary-archive-footer no-print">
        <button
          type="button"
          className="salary-archive-link"
          onClick={() => {
            setShowArchive((current) => !current);
            if (showArchive && isArchivedMonth) setMonth(recentLast);
          }}
        >
          {showArchive ? 'Hide archived income' : 'View archived income'}
        </button>
        {showArchive && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="income-month">Income Month</label>
            <input
              id="income-month"
              type="month"
              value={month}
              max={recentMonthKeys[recentMonthKeys.length - 1]}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
