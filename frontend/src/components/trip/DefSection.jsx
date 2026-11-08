import React, { useState } from 'react';
import * as api from '../../api/api';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

export default function DefSection({ trip, tripId, onSaved }) {
  const entries = trip.defEntries || [];
  const [volume, setVolume] = useState('');
  const [date, setDate] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [error, setError] = useState('');
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  async function addEntry(event) {
    event.preventDefault();
    const litres = Number(volume);
    if (!Number.isFinite(litres) || litres <= 0) {
      setError('DEF volume must be a positive number.');
      return;
    }
    setError('');
    try {
      await api.addDefEntry(tripId, { volumeLitres: litres, filledAt: date || undefined });
      setVolume('');
      setDate('');
      await onSaved();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to add DEF entry');
    }
  }

  async function saveEntry(index) {
    const litres = Number(volume);
    if (!Number.isFinite(litres) || litres <= 0) {
      setError('DEF volume must be a positive number.');
      return;
    }
    setError('');
    try {
      await api.updateDefEntry(tripId, index, { volumeLitres: litres, filledAt: date || undefined });
      setEditingIndex(null);
      setVolume('');
      setDate('');
      await onSaved();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to update DEF entry');
    }
  }

  async function deleteEntry(index) {
    if (!window.confirm('Delete this DEF entry?')) return;
    setError('');
    try {
      await api.deleteDefEntry(tripId, index);
      await onSaved();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Failed to delete DEF entry');
    }
  }

  return (
    <div>
      <h3 className="section-title">DEF (AdBlue)</h3>
      {error && <div className="error-text">{error}</div>}
      {entries.length > 0 && (
        <table>
          <thead>
            <tr><th>Volume (L)</th><th>Date</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={entry._id || index}>
                {editingIndex === index ? (
                  <>
                    <td><input aria-label="DEF volume (litres)" type="number" min="0.01" step="0.01" value={volume} onChange={(event) => setVolume(event.target.value)} /></td>
                    <td><input aria-label="DEF date" type="date" value={date} min={minDate} max={maxDate} onChange={(event) => setDate(event.target.value)} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn" onClick={() => saveEntry(index)}>Save</button>{' '}
                      <button type="button" className="btn secondary" onClick={() => setEditingIndex(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{entry.volumeLitres} L</td>
                    <td>{entry.filledAt ? new Date(entry.filledAt).toLocaleDateString('en-IN') : '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          setEditingIndex(index);
                          setVolume(String(entry.volumeLitres));
                          setDate(entry.filledAt ? new Date(entry.filledAt).toISOString().slice(0, 10) : '');
                          setError('');
                        }}
                      >Edit</button>{' '}
                      <button type="button" className="btn danger" onClick={() => deleteEntry(index)}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={addEntry} style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="def-volume-litres">DEF Volume (Litres)</label>
          <input id="def-volume-litres" type="number" min="0.01" step="0.01" required value={volume} onChange={(event) => setVolume(event.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="def-filled-at">Date</label>
          <input id="def-filled-at" type="date" required min={minDate} max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <button className="btn" type="submit">Add DEF</button>
      </form>
    </div>
  );
}
