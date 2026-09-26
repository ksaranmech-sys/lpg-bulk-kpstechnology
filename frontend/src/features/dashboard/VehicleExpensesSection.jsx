import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMonthLabel, monthKey } from '@kps/shared';

const cell = { padding: '8px 12px' };

function formatRs(value) {
  return `Rs ${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

// One row per expense month for the selected vehicle; entries are managed on the driver's page.
export default function VehicleExpensesSection({ user, vehicles, driverUsers = [], expenses, loading, error }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const vehicleId = selectedVehicleId && vehicles.some((vehicle) => String(vehicle._id) === selectedVehicleId)
    ? selectedVehicleId
    : String(vehicles[0]?._id || '');
  const vehicle = vehicles.find((entry) => String(entry._id) === vehicleId);
  const driver = driverUsers.find((entry) => String(entry.vehicle) === vehicleId);

  // Months (newest first) with totals and the expense types logged, grouped by year.
  const years = useMemo(() => {
    const months = {};
    expenses.forEach((expense) => {
      if (String(expense.vehicle?._id || expense.vehicle || '') !== vehicleId) return;
      const key = monthKey(expense.date);
      if (!key) return;
      const entry = months[key] || (months[key] = { key, total: 0, categories: new Set() });
      entry.total += Number(expense.amount) || 0;
      if (expense.category) entry.categories.add(expense.category);
    });
    const byYear = {};
    Object.values(months).forEach((entry) => {
      const year = entry.key.slice(0, 4);
      (byYear[year] || (byYear[year] = [])).push(entry);
    });
    return Object.entries(byYear)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, list]) => ({
        year,
        months: list.sort((a, b) => b.key.localeCompare(a.key)),
        total: list.reduce((sum, entry) => sum + entry.total, 0),
      }));
  }, [expenses, vehicleId]);

  const currentYear = String(new Date().getFullYear());
  const currentYearTotal = years.find((entry) => entry.year === currentYear)?.total || 0;

  return (
    <div className="card customer-admin-vehicle-expenses" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Vehicle Expenses</h3>
        <div style={{ display: 'flex', alignItems: 'end', gap: 14, flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="vehicle-expense-vehicle">Vehicle Number</label>
            <select id="vehicle-expense-vehicle" value={vehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} style={{ minWidth: 180 }}>
              {vehicles.map((entry) => (
                <option key={entry._id} value={String(entry._id)}>{entry.vehicleNumber}</option>
              ))}
            </select>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, paddingBottom: 10 }}>Total {currentYear}: {formatRs(currentYearTotal)}</span>
        </div>
      </div>
      {vehicle && (
        <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
          Driver:{' '}
          {driver ? (
            <Link to={`/drivers/${user.customer}/${driver.id || driver._id}`}>{driver.displayName || driver.name || driver.username}</Link>
          ) : 'Unassigned'}
          {driver && ' - add or edit expenses from the driver\'s page.'}
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
      {loading ? <p>Loading vehicle expenses...</p> : vehicles.length === 0 ? (
        <p>No vehicles found.</p>
      ) : years.length === 0 ? (
        <p>No vehicle expenses recorded for {vehicle?.vehicleNumber}.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', ...cell }}>Expense Month</th>
                <th style={{ textAlign: 'left', ...cell }}>Expense Types</th>
                <th style={{ textAlign: 'right', ...cell }}>Month Total</th>
              </tr>
            </thead>
            {years.map(({ year, months, total }) => (
              <tbody key={year}>
                {months.map((entry) => (
                  <tr key={entry.key}>
                    <td style={{ ...cell, fontWeight: 700 }}>{formatMonthLabel(entry.key)}</td>
                    <td style={{ ...cell, color: '#4b6470' }}>{Array.from(entry.categories).join(', ')}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{formatRs(entry.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ ...cell, textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--border)' }}>Total {year}</td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--border)' }}>{formatRs(total)}</td>
                </tr>
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
