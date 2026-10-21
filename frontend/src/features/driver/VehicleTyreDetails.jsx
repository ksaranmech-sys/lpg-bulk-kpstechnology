import React, { useEffect, useState } from 'react';
import { VEHICLE_TYRE_POSITIONS } from '@kps/shared';
import * as api from '../../api/api';

function tyreRows(tyres = []) {
  return Array.from({ length: 7 }, (_, index) => {
    const tyre = tyres.find((entry) => Number(entry.position) === index + 1) || {};
    return {
      position: index + 1,
      tyreNumber: tyre.tyreNumber || '',
      tyreNumber2: tyre.tyreNumber2 || '',
      installedOdometerKm: tyre.installedOdometerKm == null
        ? (tyre.odometerKm == null ? '' : String(tyre.odometerKm))
        : String(tyre.installedOdometerKm),
      mileageKm: tyre.mileageKm == null ? '' : String(tyre.mileageKm),
      expectedMileageKm: tyre.expectedMileageKm == null ? '' : String(tyre.expectedMileageKm),
    };
  });
}

function mileageUntilNow(tyre, currentOdometer) {
  if (tyre.installedOdometerKm === '' || currentOdometer == null) return '';
  const mileage = Number(currentOdometer) - Number(tyre.installedOdometerKm);
  return Number.isFinite(mileage) && mileage >= 0 ? String(mileage) : '';
}

export default function VehicleTyreDetails({ vehicle }) {
  const [tyres, setTyres] = useState(() => tyreRows(vehicle?.tyres));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTyres(tyreRows(vehicle?.tyres));
  }, [vehicle?._id, vehicle?.tyres]);

  function updateTyre(position, field, value) {
    setTyres((current) => current.map((tyre) => (
      tyre.position === position ? { ...tyre, [field]: value } : tyre
    )));
  }

  async function saveTyres(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.updateVehicleTyres(vehicle._id, tyres.map((tyre) => ({
        ...tyre,
        installedOdometerKm: tyre.installedOdometerKm === '' ? null : Number(tyre.installedOdometerKm),
        expectedMileageKm: tyre.expectedMileageKm === '' ? null : Number(tyre.expectedMileageKm),
      })));
      setMessage('Tyre details saved.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save tyre details');
    } finally {
      setSaving(false);
    }
  }

  if (!vehicle) return null;

  return (
    <form className="card" style={{ marginTop: 24 }} onSubmit={saveTyres}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Tyre Details - {vehicle.vehicleNumber}</h3>
      <p style={{ color: '#666', marginTop: -4 }}>
        Enter tyre numbers and installed odometer readings. Mileage is calculated using the vehicle's latest odometer.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(120px, 0.9fr) repeat(5, minmax(0, 1fr))',
          columnGap: 8,
          rowGap: 10,
          alignItems: 'end',
          width: '100%',
        }}
      >
          {tyres.map((tyre) => (
            <React.Fragment key={tyre.position}>
            <strong style={{ alignSelf: 'center' }}>{VEHICLE_TYRE_POSITIONS[tyre.position - 1]}</strong>
            <div className="field">
              <label htmlFor={`tyre-number-${tyre.position}`}>Tyre Number 1</label>
              <input
                id={`tyre-number-${tyre.position}`}
                value={tyre.tyreNumber}
                maxLength={50}
                onChange={(event) => updateTyre(tyre.position, 'tyreNumber', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`tyre-number-2-${tyre.position}`}>Tyre Number 2</label>
              <input
                id={`tyre-number-2-${tyre.position}`}
                value={tyre.tyreNumber2}
                maxLength={50}
                onChange={(event) => updateTyre(tyre.position, 'tyreNumber2', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`tyre-installed-odometer-${tyre.position}`}>Installed Odometer (km)</label>
              <input
                id={`tyre-installed-odometer-${tyre.position}`}
                type="number"
                min="0"
                step="1"
                value={tyre.installedOdometerKm}
                onChange={(event) => updateTyre(tyre.position, 'installedOdometerKm', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`tyre-mileage-${tyre.position}`}>Mileage upto now (km)</label>
              <input
                id={`tyre-mileage-${tyre.position}`}
                type="number"
                value={mileageUntilNow(tyre, vehicle.lastKnownOdometer)}
                readOnly
                aria-readonly="true"
                placeholder="Calculated automatically"
              />
            </div>
            <div className="field">
              <label htmlFor={`tyre-expected-mileage-${tyre.position}`}>Expected Mileage (km)</label>
              <input
                id={`tyre-expected-mileage-${tyre.position}`}
                type="number"
                min="0"
                step="1"
                value={tyre.expectedMileageKm}
                onChange={(event) => updateTyre(tyre.position, 'expectedMileageKm', event.target.value)}
              />
            </div>
            </React.Fragment>
          ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      {message && <p role="status" style={{ color: '#2f855a' }}>{message}</p>}
      <button className="btn" type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save Tyre Details'}
      </button>
    </form>
  );
}
