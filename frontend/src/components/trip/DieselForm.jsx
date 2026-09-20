import React, { useState } from 'react';
import * as api from '../../api/api';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

export default function DieselForm({
  tripId,
  trip,
  onSaved,
  title = 'Diesel Filling Entry',
  submitLabel = 'Add',
  closeAfterSave = false,
}) {
  const [volumeLitres, setVolume] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('diesel_card');
  const [odometerKm, setOdo] = useState('');
  const [filledAt, setFilledAt] = useState('');
  const [photo, setPhoto] = useState(null);
  const [dieselFilledConfirmed, setDieselFilledConfirmed] = useState(false);
  const [error, setError] = useState('');
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const gps = await api.getCurrentPosition();
      if (!Number.isFinite(gps?.lat) || !Number.isFinite(gps?.lng)) {
        setError('GPS coordinates are required for diesel filling. Enable location access and try again.');
        return;
      }
      await api.addDieselEntry(
        tripId,
        { volumeLitres, totalValue, paymentMethod, loadingPointTankFill: dieselFilledConfirmed, odometerKm: odometerKm || undefined, filledAt: filledAt || undefined, lat: gps?.lat, lng: gps?.lng },
        photo
      );
      setVolume(''); setTotalValue(''); setPaymentMethod('diesel_card'); setOdo(''); setFilledAt(''); setPhoto(null); setDieselFilledConfirmed(false);
      if (closeAfterSave) {
        await onSaved();
        return;
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add diesel entry');
    }
  }

  return (
    <form onSubmit={submit} style={{ padding: '0', margin: 0, border: 0, background: 'transparent', borderRadius: 0 }}>
      {title ? <h3 className="section-title">{title}</h3> : null}
      {error && <div className="error-text">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}><label>Volume (Litres)</label><input type="number" value={volumeLitres} onChange={(e) => setVolume(e.target.value)} required /></div>
        <div className="field" style={{ margin: 0 }}><label>Total Value (Rs)</label><input type="number" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} required /></div>
        <div className="field" style={{ margin: 0 }}>
          <label>Payment Method</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="diesel_card">Diesel Card</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Tank Fill</label>
          <div style={{ display: 'flex', alignItems: 'center', height: 42, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            <input
              type="checkbox"
              style={{ width: 20, height: 20, margin: 0, accentColor: 'var(--green-500)', cursor: 'pointer' }}
              checked={dieselFilledConfirmed}
              onChange={(e) => setDieselFilledConfirmed(e.target.checked)}
            />
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'end', marginTop: 12 }}>
        <div className="field" style={{ margin: 0 }}><label>Odometer Reading</label><input type="number" value={odometerKm} onChange={(e) => setOdo(e.target.value)} placeholder="Optional" /></div>
        <div className="field" style={{ margin: 0 }}>
          <label>Date</label>
          <input type="date" value={filledAt} onChange={(e) => setFilledAt(e.target.value)} min={minDate} max={maxDate} required />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
        </div>
        <button className="btn" type="submit" style={{ marginBottom: 1, whiteSpace: 'nowrap' }}>{submitLabel}</button>
      </div>
    </form>
  );
}
