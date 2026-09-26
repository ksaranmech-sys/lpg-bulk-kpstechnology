import React, { useState } from 'react';
import * as api from '../../api/api';
import ComboBoxInput from '../ComboBoxInput';

export default function UnloadingForm({ tripId, meta, trip, routeUnloadingOptions, onSaved }) {
  const [unloadingLocation, setLoc] = useState(trip.unloadingLocation || '');
  const [unloadingWeightTons, setWeightTons] = useState(trip.unloadingWeightTons != null ? String(trip.unloadingWeightTons) : '');
  const [unloadingDate, setDate] = useState(trip.unloadingDate ? new Date(trip.unloadingDate).toISOString().slice(0, 10) : '');
  const [manualKm, setManualKm] = useState(trip.manualKm != null ? String(trip.manualKm) : '');
  const [manualKmDivert, setManualKmDivert] = useState(trip.manualKmDivert != null ? String(trip.manualKmDivert) : '');
  const [error, setError] = useState('');
  const [isDiverted, setIsDiverted] = useState(Boolean(trip.isDiverted));
  const [divertUnloadingLocation, setDivertUnloadingLocation] = useState(trip.divertUnloadingLocation || '');
  const [divertDate, setDivertDate] = useState(trip.divertDate ? new Date(trip.divertDate).toISOString().slice(0, 10) : '');
  const [selectedCorporation, setSelectedCorporation] = useState(
    (() => {
      const currentLocation = trip.unloadingLocation || unloadingLocation;
      if (!currentLocation) return '';
      const match = (meta.routeKmTable || []).find((row) => String(row?.unloadingLocation || '').trim() === String(currentLocation).trim());
      return match?.corporation || '';
    })()
  );

  const filteredUnloadingOptions = (routeUnloadingOptions || []).filter((loc) => {
    if (!selectedCorporation) return true;
    return (meta.routeKmTable || []).some((row) =>
      String(row?.unloadingLocation || '').trim() === String(loc).trim() &&
      String(row?.corporation || '').trim() === String(selectedCorporation).trim()
    );
  });

  const hasFirstLegInTable = (meta.routeKmTable || []).some((row) => (
    String(row?.loadingLocation || '').trim() === String(trip.loadingLocation || '').trim() &&
    String(row?.unloadingLocation || '').trim() === String(unloadingLocation || '').trim()
  ));
  const hasSecondLegInTable = (meta.routeKmTable || []).some((row) => (
    String(row?.loadingLocation || '').trim() === String(unloadingLocation || '').trim() &&
    String(row?.unloadingLocation || '').trim() === String(divertUnloadingLocation || '').trim()
  ));
  // The two manual KM fields cover different legs and are required independently of each other.
  const manualKmLoadRequired = trip.manualKm == null && Boolean(String(unloadingLocation || '').trim()) && !hasFirstLegInTable;
  const manualKmDivertRequired = trip.manualKmDivert == null && isDiverted && Boolean(String(divertUnloadingLocation || '').trim()) && !hasSecondLegInTable;
  // Once a manual KM value has been saved, keep the field visible so it stays editable.
  const manualKmLoadVisible = manualKmLoadRequired || trip.manualKm != null;
  const manualKmDivertVisible = isDiverted && (manualKmDivertRequired || trip.manualKmDivert != null);

  async function submit(e) {
    e.preventDefault();
    if (manualKmLoadRequired && manualKm === '') {
      setError('Please enter Manual KM Load between the loading and unloading location (Round trip).');
      return;
    }
    if (manualKmDivertRequired && manualKmDivert === '') {
      setError('Please enter Manual KM Divert between the unloading location and divert location (Round trip).');
      return;
    }
    setError('');
    try {
      await api.setUnloading(tripId, {
        unloadingLocation,
        unloadingWeightTons: unloadingWeightTons === '' ? null : Number(unloadingWeightTons),
        unloadingDate,
        manualKm: manualKm === '' ? undefined : Number(manualKm),
        manualKmDivert: manualKmDivert === '' ? undefined : Number(manualKmDivert),
        isDiverted,
        divertUnloadingLocation: isDiverted ? divertUnloadingLocation : undefined,
        divertDate: isDiverted ? divertDate : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save unloading details.');
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Unloading Details</h3>
      {error && <div className="error-text">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: manualKmLoadVisible ? 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto auto' : 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Corporation</label>
          <select
            value={selectedCorporation}
            onChange={(e) => {
              const nextCorporation = e.target.value;
              setSelectedCorporation(nextCorporation);
              setLoc('');
            }}
          >
            <option value="">Select corporation...</option>
            {(meta.routeKmTable || []).map((row) => row.corporation).filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).map((corporation) => (
              <option key={corporation} value={corporation}>{corporation}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Unloading Location</label>
          <ComboBoxInput
            value={unloadingLocation}
            onChange={setLoc}
            options={filteredUnloadingOptions}
            placeholder="Select or enter unloading location"
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Weight (tons)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={unloadingWeightTons}
            onChange={(e) => setWeightTons(e.target.value)}
            placeholder="Optional"
          />
        </div>
        {manualKmLoadVisible && (
          <div className="field" style={{ margin: 0 }}>
            <label>Manual KM Load{manualKmLoadRequired ? ' (required)' : ''}</label>
            <input
              type="number"
              min="0"
              value={manualKm}
              onChange={(e) => setManualKm(e.target.value)}
              placeholder={manualKmLoadRequired ? 'Required' : 'Optional'}
              title={`Enter KM between ${trip.loadingLocation || 'loading location'} and ${unloadingLocation || 'unloading location'} (One Way)`}
              required={manualKmLoadRequired}
            />
          </div>
        )}
        <div className="field" style={{ margin: 0 }}>
          <label>Date</label>
          <input
            type="date"
            value={unloadingDate}
            onChange={(e) => setDate(e.target.value)}
            min={trip.unTurnDate ? new Date(trip.unTurnDate).toISOString().slice(0, 10) : undefined}
            required
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Divert</label>
          <div style={{ display: 'flex', alignItems: 'center', height: 42, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
            <input
              type="checkbox"
              style={{ width: 20, height: 20, margin: 0, accentColor: 'var(--green-500)', cursor: 'pointer' }}
              checked={isDiverted}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsDiverted(checked);
                // Manual KM Divert only applies while diverted - clear the stale value once undone.
                if (!checked) {
                  setManualKmDivert('');
                  setDivertUnloadingLocation('');
                  setDivertDate('');
                }
              }}
            />
          </div>
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }} disabled={(manualKmLoadRequired && manualKm === '') || (manualKmDivertRequired && manualKmDivert === '')}>Save</button>
      </div>
      {isDiverted && (
        <div className="divert-fields" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Divert Location</label>
            <ComboBoxInput
              value={divertUnloadingLocation}
              onChange={setDivertUnloadingLocation}
              options={(routeUnloadingOptions || []).filter(Boolean)}
              placeholder="Select or enter divert location"
              required
            />
          </div>
          {manualKmDivertVisible && (
            <div className="field">
              <label>Manual KM Divert{manualKmDivertRequired ? ' (required)' : ''}</label>
              <input
                type="number"
                min="0"
                value={manualKmDivert}
                onChange={(e) => setManualKmDivert(e.target.value)}
                placeholder={manualKmDivertRequired ? 'Required' : 'Optional'}
                title={`Enter KM between ${unloadingLocation || 'unloading location'} and ${divertUnloadingLocation || 'divert location'} (One Way)`}
                required={manualKmDivertRequired}
              />
            </div>
          )}
          <div className="field">
            <label>Divert Unloading Date</label>
            <input
              type="date"
              value={divertDate}
              onChange={(e) => setDivertDate(e.target.value)}
              min={unloadingDate || undefined}
              required
            />
          </div>
        </div>
      )}
    </form>
  );
}
