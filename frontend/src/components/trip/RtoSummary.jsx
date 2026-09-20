import React, { useState } from 'react';
import * as api from '../../api/api';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

export default function RtoSummary({ trip, onSaved }) {
  const entries = trip.rtoEntries || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  function startEdit(index, entry) {
    setEditingIndex(index);
    setAmount(String(entry.amount));
    setDate(entry.date ? new Date(entry.date).toISOString().slice(0, 10) : '');
    setError('');
  }

  async function saveEdit(index) {
    setError('');
    try {
      await api.updateRtoEntry(trip._id, index, { amount: Number(amount), date });
      setEditingIndex(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update RTO expense');
    }
  }

  return (
    <div>
      <h3 className="section-title">RTO Expenses</h3>
      {error && <div className="error-text">{error}</div>}
      {entries.length === 0 ? null : (
        <table>
          <thead><tr><th>Amount</th><th>Date</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                {editingIndex === index ? (
                  <>
                    <td><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></td>
                    <td><input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={minDate} max={maxDate} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn" onClick={() => saveEdit(index)}>Save</button>{' '}
                      <button type="button" className="btn secondary" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>Rs {entry.amount}</td>
                    <td>{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn secondary" onClick={() => startEdit(index, entry)}>Edit</button>
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
