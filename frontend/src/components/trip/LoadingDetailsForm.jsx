import React, { useState } from 'react';
import { toDateInputValue } from '@kps/shared';
import * as api from '../../api/api';
import ComboBoxInput from '../ComboBoxInput';

export default function LoadingDetailsForm({ tripId, trip, meta, onSaved }) {
  const [loadingLocation, setLocation] = useState(trip.loadingLocation || '');
  const [loadingDate, setDate] = useState(trip.loadingDate ? new Date(trip.loadingDate).toISOString().slice(0, 10) : '');
  const [cleanerExpense, setCleanerExpense] = useState(trip.loadingExpense || '');
  const [turn, setTurn] = useState(trip.turnExpense || '');
  const [parking, setParking] = useState(trip.parkingExpense || '');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const loadingOptions = Array.from(new Set((meta.routeKmTable || []).map((row) => row.loadingLocation).filter(Boolean)));

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.setLoadingDetailsWithPhoto(
        tripId,
        {
          loadingLocation,
          loadingDate,
          loadingExpense: Number(cleanerExpense || 0),
          turnExpense: Number(turn || 0),
          parkingExpense: Number(parking || 0),
        },
        photo
      );
      setPhoto(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save loading details.');
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="error-text">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(140px, auto)', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Loading Location</label>
          <ComboBoxInput
            value={loadingLocation}
            onChange={setLocation}
            options={loadingOptions}
            placeholder="Select or enter loading location"
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Date of Loading</label>
          <input type="date" value={loadingDate} onChange={(e) => setDate(e.target.value)} min={toDateInputValue(trip.entryMinDate)} required />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Loading Cleaner Expense (Rs)</label>
          <input type="number" min="0" value={cleanerExpense} onChange={(e) => setCleanerExpense(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(140px, auto)', gap: 14, alignItems: 'end', marginTop: 14 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Turn (Rs)</label>
          <input type="number" min="0" value={turn} onChange={(e) => setTurn(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Parking (Rs)</label>
          <input type="number" min="0" value={parking} onChange={(e) => setParking(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Parking Photo</label>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Save</button>
      </div>
    </form>
  );
}
