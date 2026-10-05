import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { previousMonth, formatMonthLabel, formatDateLong } from '@kps/shared';
import * as api from '../../api/api';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMoney = (value) => (Number.isFinite(value) ? money.format(value) : 'NA');
const percent = (rate) => `${Math.round(rate * 100)}%`;

// The two months admins see without opening the archive: last month and the month before it.
function recentMonths(today = new Date()) {
  const last = previousMonth(today);
  const [year, month] = last.split('-').map(Number);
  return [last, previousMonth(new Date(year, month - 1, 1))];
}

const cell = { padding: '8px 10px', border: '1px solid #1f4d2b', verticalAlign: 'top' };
const right = { ...cell, textAlign: 'right' };
const head = { ...cell, textAlign: 'left', fontSize: 12 };

function IncomeTable({ group, rates }) {
  const { rows, totals } = group;
  return (
    <div className="income-group" style={{ marginTop: 16 }} data-testid={`income-group-${group.corporation}`}>
      <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>
        {group.corporation}
        <span style={{ fontWeight: 400, color: '#4b5f52', fontSize: 12 }}> - {totals.trips} unloading{totals.trips === 1 ? '' : 's'}</span>
      </h4>
      <div style={{ overflowX: 'auto' }}>
        <table className="trip-km-table" style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <thead>
            <tr>
              <th style={{ ...head, whiteSpace: 'nowrap' }}>S.No</th>
              <th style={head}>Vehicle Number</th>
              <th style={head}>Loading location</th>
              <th style={head}>Unloading location</th>
              <th style={head}>Loading date</th>
              <th style={head}>Unloading date</th>
              <th style={{ ...right, fontSize: 12 }}>Trip Income</th>
              <th style={{ ...right, fontSize: 12 }}>
                TDS
                <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>Trip Income x {percent(rates.tds)}</div>
              </th>
              <th style={{ ...right, fontSize: 12 }}>
                Diesel
                <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>(Trip Income - TDS) x {percent(rates.diesel)}</div>
              </th>
              <th style={{ ...right, fontSize: 12 }}>
                Amount
                <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>(Trip Income - TDS) x {percent(rates.amount)}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.tripId}-${row.leg}`}>
                <td className="num" style={right}>{row.sNo}</td>
                <td style={{ ...cell, fontWeight: 600 }}>
                  <Link to={`/trips/${row.tripId}`}>{row.vehicleNumber || '-'}</Link>
                  {row.status !== 'closed' && <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>{row.status === 'open' ? 'Open' : 'Closing'}</div>}
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
                <td className="num" style={right}>{formatMoney(row.tds)}</td>
                <td className="num" style={right}>{formatMoney(row.diesel)}</td>
                <td className="num" style={right}>{formatMoney(row.amount)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...right, fontWeight: 700 }} colSpan={6}>
                Total
                {totals.pricedTrips < totals.trips && (
                  <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>{totals.trips - totals.pricedTrips} unloading(s) without income not included</div>
                )}
              </td>
              <td className="num" style={{ ...right, fontWeight: 700 }}>{formatMoney(totals.tripIncome)}</td>
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

// Admin-only: every unloading in a month (a trip's Load leg by its Unloading date, a diverted
// trip's Divert leg by its Divert date) with that leg's Trip Income -> TDS / Diesel / Amount
// split, one table per corporation. Shows last month by default; the month before it is one
// click away and older months are "archived" behind a month picker.
export default function MonthlyIncomeSection({ customerId, className = '' }) {
  const [recentLast, recentBefore] = recentMonths();
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

  const isArchivedMonth = month !== recentLast && month !== recentBefore;
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
            font-size: 9.5pt !important;
            line-height: 1.25 !important;
          }
          .monthly-income-print-area .no-print { display: none !important; }
          .monthly-income-print-area .print-only { display: block !important; }
          .monthly-income-print-area .monthly-income-header { display: block !important; margin: 0 0 6pt !important; }
          .monthly-income-print-area h3 {
            font-size: 11pt !important;
            margin: 0 !important;
            padding: 6pt 8pt !important;
            background: #f3f6f3 !important;
            border-bottom: 1px solid #1f4d2b !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .monthly-income-print-area h4 {
            font-size: 10pt !important;
            margin: 8pt 0 3pt !important;
            page-break-after: avoid;
          }
          .monthly-income-print-area div { overflow: visible !important; }
          .monthly-income-print-area .income-group { margin-top: 6pt !important; page-break-inside: avoid; }
          .monthly-income-print-area table {
            min-width: 0 !important;
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9pt !important;
          }
          .monthly-income-print-area thead { display: table-header-group; }
          .monthly-income-print-area tr { page-break-inside: avoid; }
          .monthly-income-print-area th,
          .monthly-income-print-area td {
            padding: 4pt 6px !important;
            vertical-align: top !important;
            color: #000 !important;
            border-color: #1f4d2b !important;
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
          {[recentLast, recentBefore].map(monthButton)}
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
        Printed on {formatDateLong(new Date())} - TDS = Trip Income x {percent(income?.rates?.tds ?? 0.02)},
        Diesel = (Trip Income - TDS) x {percent(income?.rates?.diesel ?? 0.4)}, Amount = (Trip Income - TDS) x {percent(income?.rates?.amount ?? 0.6)}
      </p>
      <p className="no-print" style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
        Income for all vehicles unloaded in {formatMonthLabel(month)}, grouped by corporation - a trip counts in the
        month of its Unloading date; a diverted trip&apos;s new unloading counts in the month of its Divert date.
        Last month&apos;s income is shown in the current month; older months are available under archived income.
      </p>

      {error && <p className="error-text">{error}</p>}
      {loading && <p>Loading monthly income...</p>}
      {!loading && !error && income && income.groups.length === 0 && (
        <p>No unloadings in {formatMonthLabel(month)}.</p>
      )}
      {!loading && !error && income && income.groups.map((group) => (
        <IncomeTable key={group.corporation} group={group} rates={income.rates} />
      ))}
      {!loading && !error && income && income.groups.length > 1 && (
        <div style={{ marginTop: 16, overflowX: 'auto' }}>
          <table className="trip-km-table" style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <tbody>
              <tr>
                <td style={{ ...cell, fontWeight: 700 }}>
                  Total - all corporations
                  <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>{income.totals.pricedTrips} of {income.totals.trips} unloadings priced</div>
                </td>
                <td className="num" style={{ ...right, fontWeight: 700 }}>Trip Income {formatMoney(income.totals.tripIncome)}</td>
                <td className="num" style={{ ...right, fontWeight: 700 }}>TDS {formatMoney(income.totals.tds)}</td>
                <td className="num" style={{ ...right, fontWeight: 700 }}>Diesel {formatMoney(income.totals.diesel)}</td>
                <td className="num" style={{ ...right, fontWeight: 700 }}>Amount {formatMoney(income.totals.amount)}</td>
              </tr>
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
              max={recentBefore}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
