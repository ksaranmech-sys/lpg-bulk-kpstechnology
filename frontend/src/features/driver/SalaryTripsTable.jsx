import React from 'react';

// Shared trip-rows table for both the regular driver's and the temporary driver's salary
// breakdown - each shows only the trip entries attributed to that side, but both keep the same
// per-trip "Closed" checkbox since Trip Close still acts on the whole trip.
export default function SalaryTripsTable({ trips, closingTripId, onCloseTrip, totals }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ width: '4%', textAlign: 'right', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>S.No</th>
            <th style={{ width: '11%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Loading Location</th>
            <th style={{ width: '9%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Loading Date</th>
            <th style={{ width: '11%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Unloading Location</th>
            <th style={{ width: '9%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Unloading Date</th>
            <th style={{ width: '11%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Divert Location</th>
            <th style={{ width: '8%', textAlign: 'right', padding: '8px 8px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Driver KM</th>
            <th style={{ width: '8%', textAlign: 'right', padding: '8px 8px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Diesel (Litres)</th>
            <th style={{ width: '9%', textAlign: 'right', padding: '8px 8px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Trip Diesel</th>
            <th style={{ width: '9%', textAlign: 'right', padding: '8px 8px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Trip Advance</th>
            <th style={{ width: '9%', textAlign: 'right', padding: '8px 8px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Trip Expense</th>
            <th style={{ width: '11%', textAlign: 'right', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }} title="Trip Advance - Trip Expenses">Trip balance</th>
            <th style={{ width: '6%', textAlign: 'center', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Closed</th>
          </tr>
        </thead>
        <tbody>
          {(trips || []).length === 0 ? (
            <tr><td colSpan="13" style={{ padding: '8px 12px', color: '#666', border: '1px solid #d0d7de' }}>No trips for this month.</td></tr>
          ) : (trips || []).map((trip, index) => (
            <tr key={trip._id || index}>
              <td style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid #d0d7de' }}>{index + 1}</td>
              <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.loadingLocation || '-'}</td>
              <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}</td>
              <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.unloadingLocation || '-'}</td>
              <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.unloadingDate ? new Date(trip.unloadingDate).toLocaleDateString('en-IN') : '-'}</td>
              <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.isDiverted ? trip.divertUnloadingLocation || '-' : '-'}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>{trip.corporationKm != null && trip.corporationKm > 0 ? `${Math.round(trip.corporationKm)} km` : '-'}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>{trip.dieselLitres ?? 0} L</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>Rs {trip.dieselTotal ?? 0}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>Rs {trip.advanceTotal ?? 0}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>Rs {trip.expenseTotal ?? 0}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>Rs {trip.balance ?? 0}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #d0d7de' }}>
                <input
                  type="checkbox"
                  checked={trip.status === 'closed'}
                  disabled={trip.status === 'closed' || closingTripId === trip._id}
                  title={trip.status === 'closed' ? 'Trip already closed' : 'Mark this trip as closed'}
                  onChange={() => onCloseTrip(trip._id)}
                />
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan="6" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, border: '1px solid #d0d7de' }}>Total</td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, border: '1px solid #d0d7de' }}>{Math.round(totals.corporationKm || 0)} km</td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, border: '1px solid #d0d7de' }}>{totals.totalDieselLitres || 0} L</td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, border: '1px solid #d0d7de' }}>Rs {totals.totalDiesel}</td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, border: '1px solid #d0d7de' }}>Rs {totals.totalAdvance}</td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, border: '1px solid #d0d7de' }}>Rs {totals.totalExpense}</td>
            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, border: '1px solid #d0d7de' }}>Rs {totals.totalBalance}</td>
            <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
