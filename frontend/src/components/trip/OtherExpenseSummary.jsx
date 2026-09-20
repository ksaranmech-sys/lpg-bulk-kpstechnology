import React, { useState } from 'react';
import * as api from '../../api/api';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

export default function OtherExpenseSummary({ trip, tripId, onSaved }) {
  const entries = trip.otherExpenses || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  function startEdit(index, entry) {
    setEditingIndex(index);
    setAmount(String(entry.amount));
    setDate(new Date(entry.date).toISOString().slice(0, 10));
    setDescription(entry.description || '');
    setError('');
  }

  async function saveEdit(index) {
    setError('');
    try {
      await api.updateOtherExpense(tripId, index, { amount: Number(amount), date, description });
      setEditingIndex(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update other expense');
    }
  }

  return (
    <div>
      <h3 className="section-title">Other Expenses</h3>
      {error && <div className="error-text">{error}</div>}
      {entries.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No other expenses added yet.</p>
      ) : (
        <table>
          <thead><tr><th>Description</th><th>Amount</th><th>Date</th><th>Photo</th><th>Actions</th></tr></thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index}>
                {editingIndex === index ? (
                  <>
                    <td><input value={description} onChange={(e) => setDescription(e.target.value)} /></td>
                    <td><input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></td>
                    <td><input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={minDate} max={maxDate} /></td>
                    <td>{entry.photo?.url ? <a href={entry.photo.url} target="_blank" rel="noreferrer">view</a> : '-'}</td>
                    <td>
                      <button type="button" className="btn" onClick={() => saveEdit(index)}>Save</button>{' '}
                      <button type="button" className="btn secondary" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{entry.description || '-'}</td>
                    <td>Rs {entry.amount}</td>
                    <td>{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                    <td>{entry.photo?.url ? <a href={entry.photo.url} target="_blank" rel="noreferrer">view</a> : '-'}</td>
                    <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn secondary" onClick={() => startEdit(index, entry)}>Edit</button>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={async () => {
                          if (!window.confirm('Delete this other expense?')) return;
                          await api.deleteOtherExpense(tripId, index);
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
