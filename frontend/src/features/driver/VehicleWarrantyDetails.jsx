import React, { useEffect, useState } from 'react';
import { toDateInputValue } from '@kps/shared';
import * as api from '../../api/api';

function warrantyRows(details = []) {
  return details.map((detail) => ({
    name: String(detail.name || '').trim(),
    installationDate: toDateInputValue(detail.installationDate) || '',
    warrantyPeriod: String(detail.warrantyPeriod || ''),
    odometerReading: detail.odometerReading == null ? '' : String(detail.odometerReading),
  }));
}

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

export default function VehicleWarrantyDetails({ vehicle, onVehicleUpdated }) {
  const [details, setDetails] = useState(() => warrantyRows(vehicle?.warrantyDetails));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDetails(warrantyRows(vehicle?.warrantyDetails));
    setEditing(false);
    setError('');
  }, [vehicle?._id, vehicle?.warrantyDetails]);

  if (!vehicle) return null;

  function updateDetail(index, field, value) {
    setDetails((current) => current.map((detail, rowIndex) => (
      rowIndex === index ? { ...detail, [field]: value } : detail
    )));
  }

  function addComponent() {
    setDetails((current) => [...current, {
      name: '',
      installationDate: '',
      warrantyPeriod: '',
      odometerReading: '',
    }]);
    setError('');
    setMessage('');
  }

  function cancelEditing() {
    setDetails(warrantyRows(vehicle.warrantyDetails));
    setError('');
    setMessage('');
    setEditing(false);
  }

  async function saveWarranties(event) {
    event.preventDefault();
    if (!editing) return;
    const names = details.map((detail) => detail.name.trim().toLowerCase());
    if (names.some((name, index) => !name || names.indexOf(name) !== index)) {
      setError('Each warranty detail must have a unique name.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.updateVehicleWarranties(vehicle._id, details.map((detail) => ({
        name: detail.name.trim(),
        installationDate: detail.installationDate || null,
        warrantyPeriod: detail.warrantyPeriod.trim(),
        odometerReading: numberOrNull(detail.odometerReading),
      })));
      onVehicleUpdated?.(response.data.vehicle);
      setEditing(false);
      setMessage('Warranty details saved.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save warranty details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="vehicle-warranty-title">
      <h4 id="vehicle-warranty-title" className="section-title" style={{ marginTop: 0 }}>
        Warranty Details - {vehicle.vehicleNumber}
      </h4>
      {details.length === 0 && !editing ? <p>No warranty details added.</p> : (
        <form onSubmit={saveWarranties}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Installation Date</th>
                  <th scope="col">Warranty Period</th>
                  <th scope="col">Odometer Reading</th>
                  {editing ? <th scope="col">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {details.map((detail, index) => (
                  <tr key={`warranty-${index}`}>
                    <td>
                      <input
                        aria-label={`Warranty name ${index + 1}`}
                        maxLength={50}
                        readOnly={!editing}
                        value={detail.name}
                        onChange={(event) => updateDetail(index, 'name', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Warranty installation date ${index + 1}`}
                        type="date"
                        readOnly={!editing}
                        value={detail.installationDate}
                        onChange={(event) => updateDetail(index, 'installationDate', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Warranty period ${index + 1}`}
                        maxLength={50}
                        readOnly={!editing}
                        value={detail.warrantyPeriod}
                        onChange={(event) => updateDetail(index, 'warrantyPeriod', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Warranty odometer reading ${index + 1}`}
                        type="number"
                        min="0"
                        step="1"
                        readOnly={!editing}
                        value={detail.odometerReading}
                        onChange={(event) => updateDetail(index, 'odometerReading', event.target.value)}
                      />
                    </td>
                    {editing ? (
                      <td>
                        <button
                          className="btn secondary"
                          type="button"
                          aria-label={`Delete warranty component ${index + 1}`}
                          onClick={() => setDetails((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                        >
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
              <button className="btn secondary" type="button" onClick={addComponent}>Add component</button>
              <button className="btn secondary" type="button" onClick={cancelEditing} disabled={saving}>Cancel</button>
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          ) : (
            <button
              className="btn"
              type="button"
              onClick={() => { setMessage(''); setError(''); setEditing(true); }}
            >
              Edit
            </button>
          )}
        </form>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
      {message && <p role="status" style={{ color: '#2f855a' }}>{message}</p>}
      {!editing && details.length === 0 && (
        <button className="btn" type="button" onClick={() => setEditing(true)}>Edit</button>
      )}
    </section>
  );
}
