import React, { useEffect, useState } from 'react';
import { VEHICLE_TYRE_POSITIONS } from '@kps/shared';
import * as api from '../../api/api';

const MAX_MILEAGE_DIGITS = 7;

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
      manualMileageKm: tyre.manualMileageKm == null ? '' : String(tyre.manualMileageKm),
      mileageKm: tyre.mileageKm == null ? '' : String(tyre.mileageKm),
      expectedMileageKm: tyre.expectedMileageKm == null ? '' : String(tyre.expectedMileageKm),
    };
  });
}

function mileageUntilNow(tyre, currentOdometer) {
  if (tyre.manualMileageKm !== '') return tyre.manualMileageKm;
  if (tyre.installedOdometerKm === '' || currentOdometer == null) return '';
  const mileage = Number(currentOdometer) - Number(tyre.installedOdometerKm);
  return Number.isFinite(mileage) && mileage >= 0 ? String(mileage) : '';
}

function mileageInputValue(value) {
  return value.replace(/\D/g, '').slice(0, MAX_MILEAGE_DIGITS);
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
        manualMileageKm: tyre.manualMileageKm === '' ? null : Number(tyre.manualMileageKm),
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
        Enter tyre numbers and ODO readings. Mileage is calculated using the vehicle's latest ODO and can be edited.
      </p>
      <div className="tyre-details-scroll">
        <table className="tyre-details-table">
          <colgroup>
            <col className="tyre-position-column" />
            <col className="tyre-numbers-column" />
            <col className="tyre-mileage-column" />
            <col className="tyre-mileage-column" />
            <col className="tyre-mileage-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Tyre Position</th>
              <th scope="col">Tyre Numbers (1 &amp; 2)</th>
              <th scope="col">Installed ODO (km)</th>
              <th scope="col">Mileage upto now (km)</th>
              <th scope="col">Expected Mileage (km)</th>
            </tr>
          </thead>
          <tbody>
            {tyres.map((tyre) => (
              <tr key={tyre.position}>
                <th scope="row">{VEHICLE_TYRE_POSITIONS[tyre.position - 1]}</th>
                <td data-label="Tyre Numbers">
                  <div className="tyre-number-fields">
                    <label className="tyre-number-field">
                      <input
                        id={`tyre-number-${tyre.position}`}
                        className="tyre-details-input"
                        aria-label={`Tyre Number 1 for ${VEHICLE_TYRE_POSITIONS[tyre.position - 1]}`}
                        value={tyre.tyreNumber}
                        maxLength={50}
                        onChange={(event) => updateTyre(tyre.position, 'tyreNumber', event.target.value)}
                      />
                    </label>
                    <label className="tyre-number-field">
                      <input
                        id={`tyre-number-2-${tyre.position}`}
                        className="tyre-details-input"
                        aria-label={`Tyre Number 2 for ${VEHICLE_TYRE_POSITIONS[tyre.position - 1]}`}
                        value={tyre.tyreNumber2}
                        maxLength={50}
                        onChange={(event) => updateTyre(tyre.position, 'tyreNumber2', event.target.value)}
                      />
                    </label>
                  </div>
                </td>
                <td data-label="Installed ODO (km)">
                  <input
                    id={`tyre-installed-odometer-${tyre.position}`}
                    className="tyre-details-input"
                    aria-label={`Installed ODO for ${VEHICLE_TYRE_POSITIONS[tyre.position - 1]} (km)`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={MAX_MILEAGE_DIGITS}
                    value={tyre.installedOdometerKm}
                    onChange={(event) => updateTyre(
                      tyre.position,
                      'installedOdometerKm',
                      mileageInputValue(event.target.value)
                    )}
                  />
                </td>
                <td data-label="Mileage upto now (km)">
                  <input
                    id={`tyre-mileage-${tyre.position}`}
                    className="tyre-details-input"
                    aria-label={`Mileage upto now for ${VEHICLE_TYRE_POSITIONS[tyre.position - 1]} (km)`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={MAX_MILEAGE_DIGITS}
                    value={mileageUntilNow(tyre, vehicle.lastKnownOdometer)}
                    placeholder="Calculated automatically"
                    onChange={(event) => updateTyre(
                      tyre.position,
                      'manualMileageKm',
                      mileageInputValue(event.target.value)
                    )}
                  />
                </td>
                <td data-label="Expected Mileage (km)">
                  <input
                    id={`tyre-expected-mileage-${tyre.position}`}
                    className="tyre-details-input"
                    aria-label={`Expected Mileage for ${VEHICLE_TYRE_POSITIONS[tyre.position - 1]} (km)`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={MAX_MILEAGE_DIGITS}
                    value={tyre.expectedMileageKm}
                    onChange={(event) => updateTyre(
                      tyre.position,
                      'expectedMileageKm',
                      mileageInputValue(event.target.value)
                    )}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="error-text">{error}</p>}
      {message && <p role="status" style={{ color: '#2f855a' }}>{message}</p>}
      <button className="btn" type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save Tyre Details'}
      </button>
    </form>
  );
}
