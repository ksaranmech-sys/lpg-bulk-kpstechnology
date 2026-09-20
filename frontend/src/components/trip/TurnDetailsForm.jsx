import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api/api';
import ComboBoxInput from '../ComboBoxInput';

export default function TurnDetailsForm({ tripId, trip, meta, onSaved }) {
  const navigate = useNavigate();
  const [turnNumber, setTurnNumber] = useState(trip.turnNumber != null ? String(trip.turnNumber) : '');
  const [turnDate, setTurnDate] = useState(trip.turnDate ? new Date(trip.turnDate).toISOString().slice(0, 10) : '');
  const [fillingOrderLocation, setFillingOrderLocation] = useState(trip.fillingOrderLocation || '');
  const [manualKmReturn, setManualKmReturn] = useState(trip.manualKmReturn != null ? String(trip.manualKmReturn) : '');
  const [error, setError] = useState('');
  const missingCloseFields = [
    !String(trip.loadingLocation || '').trim() && 'loading location',
    !trip.loadingDate && 'loading date',
    !String(trip.unloadingLocation || '').trim() && 'unloading location',
    !trip.unloadingDate && 'unloading date',
  ].filter(Boolean);
  const loadingLocations = Array.from(new Set((meta.routeKmTable || []).map((row) => row.loadingLocation).filter(Boolean)));
  // Manual KM Return covers the fillingOrder -> target leg, where target is the divert
  // unloading location for diverted trips, or the primary unloading location otherwise.
  const isDivertedReturn = Boolean(trip.isDiverted && trip.divertUnloadingLocation);
  const returnTargetLocation = isDivertedReturn ? trip.divertUnloadingLocation : trip.unloadingLocation;
  const hasReturnLegInTable = (meta.routeKmTable || []).some((row) => (
    String(row?.loadingLocation || '').trim() === String(fillingOrderLocation || '').trim() &&
    String(row?.unloadingLocation || '').trim() === String(returnTargetLocation || '').trim()
  ));
  // Reuse only applies when the reused leg targets the same destination as the return leg:
  // Manual KM Load (Loading -> Unloading) only matches a non-diverted return leg; Manual KM
  // Divert (Unloading -> divertUnloading) matches the diverted return leg's destination.
  const returnLegSameAsLoadLeg = !isDivertedReturn
    && String(fillingOrderLocation || '').trim() === String(trip.loadingLocation || '').trim();
  const returnLegSameAsDivertLeg = isDivertedReturn
    && String(fillingOrderLocation || '').trim() === String(trip.unloadingLocation || '').trim();
  const manualKmReturnRequired = trip.manualKmReturn == null
    && Boolean(String(fillingOrderLocation || '').trim())
    && Boolean(String(returnTargetLocation || '').trim())
    && !hasReturnLegInTable
    && !returnLegSameAsLoadLeg
    && !returnLegSameAsDivertLeg;
  // Once a manual KM value has been saved, keep the field visible so it stays editable.
  const manualKmReturnVisible = manualKmReturnRequired || trip.manualKmReturn != null;

  async function submit(e) {
    e.preventDefault();
    if (missingCloseFields.length > 0) {
      setError(`Add ${missingCloseFields.join(', ')} before closing this trip.`);
      return;
    }
    if (manualKmReturnRequired && manualKmReturn === '') {
      setError(trip.isDiverted
        ? 'Please enter Manual KM Return between the filling order location and divert location (Round trip).'
        : 'Please enter Manual KM Return between the filling order location and unloading location (Round trip).');
      return;
    }
    setError('');
    try {
      await api.setTurnDetails(tripId, {
        turnNumber: Number(turnNumber),
        turnDate,
        fillingOrderLocation: fillingOrderLocation || undefined,
        manualKmReturn: manualKmReturn === '' ? undefined : Number(manualKmReturn),
      });
      await api.closeTrip(tripId);
      // Trip close should return the user to the main dashboard, not stay on this trip.
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save Turn details or close trip');
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3 className="section-title">Load Turn</h3>
      {error && <div className="error-text">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: manualKmReturnVisible ? 'minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.7fr) minmax(0, 0.9fr) auto' : 'minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 0.9fr) auto', gap: 14, alignItems: 'end' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Filling Order Location</label>
          <ComboBoxInput
            value={fillingOrderLocation}
            onChange={setFillingOrderLocation}
            options={loadingLocations}
            placeholder="Select or enter filling order location"
          />
        </div>
        {manualKmReturnVisible && (
          <div className="field" style={{ margin: 0 }}>
            <label>Manual KM Return{manualKmReturnRequired ? ' (required)' : ''}</label>
            <input
              type="number"
              min="0"
              value={manualKmReturn}
              onChange={(e) => setManualKmReturn(e.target.value)}
              placeholder={manualKmReturnRequired ? 'Required' : 'Optional'}
              title={`Enter KM between ${fillingOrderLocation || 'filling order location'} and ${returnTargetLocation || 'unloading location'} (One Way)`}
              required={manualKmReturnRequired}
            />
          </div>
        )}
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
            min={(() => {
              const floor = (trip.isDiverted && trip.divertUnloadingLocation) ? trip.divertDate : trip.unloadingDate;
              return floor ? new Date(floor).toISOString().slice(0, 10) : undefined;
            })()}
            required
          />
        </div>
        <button className="btn" style={{ marginBottom: 1, whiteSpace: 'nowrap' }} disabled={missingCloseFields.length > 0 || (manualKmReturnRequired && manualKmReturn === '')}>Trip close</button>
      </div>
      {missingCloseFields.length > 0 && (
        <p className="error-text" style={{ marginTop: 12 }}>
          Add {missingCloseFields.join(', ')} before closing this trip.
        </p>
      )}
    </form>
  );
}
