import React, { useState } from 'react';
import * as api from '../../api/api';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

export default function AdvanceSection({ trip, tripId, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [error, setError] = useState('');
  const advances = trip.driverAdvances || [];
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.addAdvance(tripId, { amount: Number(amount), date: date || undefined });
      setAmount(''); setDate('');
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add advance');
    }
  }

  function startEdit(index, advance) {
    setEditingIndex(index);
    setEditAmount(String(advance.amount));
    setEditDate(new Date(advance.date).toISOString().slice(0, 10));
    setError('');
  }

  async function saveEdit(index) {
    setError('');
    try {
      await api.updateAdvance(trip._id, index, { amount: Number(editAmount), date: editDate });
      setEditingIndex(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update advance');
    }
  }

  return (
    <div className="card">
      <h3 className="section-title">Advance</h3>
      {error && <div className="error-text">{error}</div>}
      {advances.length > 0 && (
        <table>
          <thead><tr><th>Amount</th><th style={{ textAlign: 'center' }}>Date</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {advances.map((advance, i) => (
              <tr key={i}>
                {editingIndex === i ? (
                  <>
                    <td><input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} min="0" /></td>
                    <td style={{ textAlign: 'center' }}><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} min={minDate} max={maxDate} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn" onClick={() => saveEdit(i)}>Save</button>{' '}
                      <button type="button" className="btn secondary" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>Rs {advance.amount}</td>
                    <td style={{ textAlign: 'center' }}>{new Date(advance.date).toLocaleDateString('en-IN')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn secondary" onClick={() => startEdit(i, advance)}>Edit</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={submit} style={{ border: 0, background: 'transparent', padding: 0, borderRadius: 0, marginTop: advances.length ? 16 : 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}><label>Amount (Rs)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
          <div className="field" style={{ margin: 0 }}><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={minDate} max={maxDate} /></div>
          <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Add</button>
        </div>
      </form>
    </div>
  );
}
