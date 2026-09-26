import React, { useMemo, useState } from 'react';

function formatRs(value) {
  return `Rs ${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

// Yearly vehicle running-cost totals for the customer page (data entry lives on the dashboard).
export default function VehicleExpensesSummary({ expenses = [], error = '' }) {
  const [year, setYear] = useState(new Date().getFullYear());

  const years = useMemo(() => {
    const set = new Set(expenses.map((expense) => new Date(expense.date).getFullYear()).filter(Number.isFinite));
    set.add(new Date().getFullYear());
    return Array.from(set).sort().reverse();
  }, [expenses]);

  const yearEntries = expenses.filter((expense) => new Date(expense.date).getFullYear() === Number(year));
  const total = yearEntries.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  const byVehicle = Object.entries(yearEntries.reduce((acc, expense) => {
    const key = expense.vehicle?.vehicleNumber || 'Unknown';
    acc[key] = (acc[key] || 0) + (Number(expense.amount) || 0);
    return acc;
  }, {})).sort(([a], [b]) => a.localeCompare(b));
  const byCategory = Object.entries(yearEntries.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + (Number(expense.amount) || 0);
    return acc;
  }, {})).sort(([, a], [, b]) => b - a);

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Vehicle Expenses {year}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 'auto' }} aria-label="Expense year">
            {years.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Total: {formatRs(total)}</span>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      {yearEntries.length === 0 ? (
        <p>No vehicle expenses recorded for {year}.</p>
      ) : (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Vehicle</th>
                <th style={{ textAlign: 'right', padding: '8px 12px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {byVehicle.map(([vehicleNumber, amount]) => (
                <tr key={vehicleNumber}>
                  <td style={{ padding: '8px 12px' }}>{vehicleNumber}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatRs(amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Expense Type</th>
                <th style={{ textAlign: 'right', padding: '8px 12px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(([category, amount]) => (
                <tr key={category}>
                  <td style={{ padding: '8px 12px' }}>{category}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatRs(amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
