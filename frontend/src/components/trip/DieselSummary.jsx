import React, { useState } from 'react';
import * as api from '../../api/api';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

export default function DieselSummary({ trip, tripId, onSaved }) {
  const entries = trip.dieselEntries || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [volume, setVolume] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('diesel_card');
  const [loadingPointTankFill, setLoadingPointTankFill] = useState(false);
  const [odometerKm, setOdometerKm] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  function startEdit(index, entry) {
    setEditingIndex(index);
    setVolume(String(entry.volumeLitres));
    setTotalValue(String(entry.amount));
    setPaymentMethod(entry.paymentMethod || 'diesel_card');
    setLoadingPointTankFill(Boolean(entry.loadingPointTankFill));
    setOdometerKm(entry.odometerKm == null ? '' : String(entry.odometerKm));
    setDate(entry.filledAt ? new Date(entry.filledAt).toISOString().slice(0, 10) : '');
    setError('');
  }

  async function saveEdit(index) {
    setError('');
    try {
      await api.updateDieselEntry(tripId, index, {
        volumeLitres: Number(volume),
        totalValue: Number(totalValue),
        paymentMethod,
        loadingPointTankFill,
        odometerKm: odometerKm === '' ? undefined : Number(odometerKm),
        filledAt: date || undefined,
      });
      setEditingIndex(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update diesel entry');
    }
  }

  return (
    <div>
      <h3 className="section-title">Diesel</h3>
      {error && <div className="error-text">{error}</div>}
      {entries.length === 0 ? null : (
        <table>
          <thead><tr><th>Volume (L)</th><th>Total Value</th><th>Odometer KM</th><th>Date</th><th>Payment</th><th>Tank Fill</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                {editingIndex === index ? (
                  <>
                    <td><input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} min="0" /></td>
                    <td><input type="number" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} min="0" /></td>
                    <td><input type="number" value={odometerKm} onChange={(e) => setOdometerKm(e.target.value)} min="0" /></td>
                    <td><input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={minDate} max={maxDate} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        <option value="diesel_card">Diesel Card</option>
                        <option value="cash">Cash</option>
                      </select>
                    </td>
                    <td>
                      <label className="tank-fill-control" style={{ justifyContent: 'flex-start' }}>
                        <input type="checkbox" checked={loadingPointTankFill} onChange={(e) => setLoadingPointTankFill(e.target.checked)} />
                        Tank Fill
                      </label>
                    </td>
                    <td>
                      <button type="button" className="btn" onClick={() => saveEdit(index)}>Save</button>{' '}
                      <button type="button" className="btn secondary" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{entry.volumeLitres}</td>
                    <td>Rs {entry.amount}</td>
                    <td>{entry.odometerKm ?? '-'}</td>
                    <td>{new Date(entry.filledAt).toLocaleDateString('en-IN')}</td>
                    <td>{entry.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card'}</td>
                    <td>{entry.loadingPointTankFill ? '✓' : '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn secondary" onClick={() => startEdit(index, entry)}>Edit</button>{' '}
                      <button
                        type="button"
                        className="btn danger"
                        onClick={async () => {
                          if (!window.confirm('Delete this diesel entry?')) return;
                          await api.deleteDieselEntry(tripId, index);
                          onSaved();
                        }}
                      >Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
