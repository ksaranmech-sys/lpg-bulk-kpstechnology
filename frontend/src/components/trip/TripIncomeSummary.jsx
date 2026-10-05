import React from 'react';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatMoney(value) {
  return Number.isFinite(value) ? money.format(value) : 'NA';
}

function formatKm(value) {
  return Number.isFinite(value) ? `${value} km` : 'NA';
}

function formatRate(leg) {
  if (!Number.isFinite(leg.rate)) return 'NA';
  return leg.type === 'band' ? leg.rate.toFixed(4) : `${leg.rate.toFixed(4)} / km / ton`;
}

function formatRateMonth(rateMonth) {
  if (!rateMonth) return '';
  if (rateMonth === 'base') return 'Base';
  const [year, month] = rateMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }).replace(' ', '-');
}

function kmSourceText(leg) {
  if (leg.kmSource === 'km_table') return 'KM table';
  if (leg.kmSource === 'manual') return `Manual KM ${leg.leg === 'divert' ? 'Divert' : 'Load'} ${leg.manualOneWayKm} km x 2`;
  return 'Not available';
}

function incomeFormula(leg, weightTons) {
  if (!Number.isFinite(leg.income) || !Number.isFinite(leg.rate) || !Number.isFinite(weightTons)) return '';
  if (leg.type === 'band') return `${weightTons} t x ${leg.rate.toFixed(4)}`;
  return `${weightTons} t x ${leg.km} km x ${leg.rate.toFixed(4)}`;
}

// Admin-only card shown above the Single Trip PDF: the trip's income KM per leg and the income
// derived from the Rate/KM/Ton table. All figures are computed on the server (trip.tripIncome).
export default function TripIncomeSummary({ income }) {
  if (!income) return null;
  const legs = income.legs || [];
  const cell = { padding: '8px 12px', border: '1px solid #1f4d2b' };
  const right = { ...cell, textAlign: 'right' };

  return (
    <div className="card trip-income-card" style={{ border: '1px solid #1f4d2b' }} data-testid="trip-income">
      <h3 className="section-title" style={{ marginTop: 0 }}>Trip Income</h3>

      <table className="trip-km-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={{ ...cell, textAlign: 'left' }}>Trip Income KM</th>
            <th style={{ ...cell, textAlign: 'left' }}>Source</th>
            <th style={right}>KM</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg) => (
            <tr key={leg.leg}>
              <td style={{ ...cell, fontWeight: 600 }}>
                {leg.leg === 'divert' ? 'Divert' : 'Load'}
                <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>{leg.from} {'\u2192'} {leg.to}</div>
              </td>
              <td style={cell}>{kmSourceText(leg)}</td>
              <td style={right}>{formatKm(leg.km)}</td>
            </tr>
          ))}
          {legs.length > 1 && (
            <tr>
              <td style={{ ...cell, fontWeight: 600 }} colSpan={2}>Total Trip Income KM</td>
              <td style={{ ...right, fontWeight: 600 }}>{formatKm(income.totalKm)}</td>
            </tr>
          )}
          {!legs.length && (
            <tr><td style={cell} colSpan={3}>NA</td></tr>
          )}
        </tbody>
      </table>

      <table className="trip-km-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ ...cell, textAlign: 'left' }}>Trip Income</th>
            <th style={{ ...cell, textAlign: 'left' }}>Rate used</th>
            <th style={right}>Income</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg) => (
            <tr key={leg.leg}>
              <td style={{ ...cell, fontWeight: 600 }}>
                {leg.leg === 'divert' ? 'Divert' : 'Load'} ({formatKm(leg.km)})
                <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>{incomeFormula(leg, income.weightTons)}</div>
              </td>
              <td style={cell}>
                {leg.rateLabel ? `${leg.rateLabel}: ${formatRate(leg)}` : 'NA'}
                {leg.rateMonth && <div style={{ fontSize: 11, color: '#4b5f52' }}>{income.rateTable?.title} - {formatRateMonth(leg.rateMonth)}</div>}
              </td>
              <td style={right}>{formatMoney(leg.income)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, fontWeight: 600 }} colSpan={2}>
              Total Trip Income
              <div style={{ fontWeight: 400, fontSize: 11, color: '#4b5f52' }}>
                {Number.isFinite(income.weightTons) ? `${income.weightTons} t` : 'Weight NA'}
                {income.tonnageClass ? ` - ${income.tonnageClass}MT table` : ''}
                {income.corporation ? ` - ${income.corporation}` : ''}
              </div>
            </td>
            <td style={{ ...right, fontWeight: 700 }}>{formatMoney(income.totalIncome)}</td>
          </tr>
        </tbody>
      </table>

      {income.errors?.length > 0 && (
        <ul className="trip-income-notes" style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: '#8a5a00' }}>
          {income.errors.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}
    </div>
  );
}
