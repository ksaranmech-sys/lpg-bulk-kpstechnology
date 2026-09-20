import React, { useState } from 'react';
import * as api from '../../api/api';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

export default function RtoForm({ tripId, trip, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const gps = await api.getCurrentPosition();
      await api.addRtoEntry(tripId, { amount, date: date || undefined, lat: gps?.lat, lng: gps?.lng }, photo);
      setAmount(''); setDate(''); setPhoto(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add RTO expense');
    }
  }

  return (
    <form onSubmit={submit} style={{ border: 0, background: 'transparent', padding: 0, borderRadius: 0 }}>
      {error && <div className="error-text">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}><label>Amount (Rs)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        <div className="field" style={{ margin: 0 }}><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={minDate} max={maxDate} /></div>
        <div className="field" style={{ margin: 0 }}>
          <label>Photo (GPS auto)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>Add</button>
      </div>
    </form>
  );
}
