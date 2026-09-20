import React, { useState } from 'react';
import * as api from '../../api/api';

export default function UnloadingTurnForm({ tripId, trip, onSaved }) {
  const [turnNumber, setTurnNumber] = useState(trip.unTurnNumber != null ? String(trip.unTurnNumber) : '');
  const [turnDate, setTurnDate] = useState(trip.unTurnDate ? new Date(trip.unTurnDate).toISOString().slice(0, 10) : '');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.setUnloadingTurnDetails(tripId, { turnNumber: Number(turnNumber), turnDate });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save Unload Turn details.');
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Unload Turn</h3>
      {error && <div className="error-text">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Turn Number</label>
          <input type="number" min="0" step="1" value={turnNumber} onChange={(e) => setTurnNumber(e.target.value)} required />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Turn Date</label>
          <input
            type="date"
            value={turnDate}
            onChange={(e) => setTurnDate(e.target.value)}
            min={trip.loadingDate ? new Date(trip.loadingDate).toISOString().slice(0, 10) : undefined}
            required
          />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Save</button>
      </div>
    </form>
  );
}
