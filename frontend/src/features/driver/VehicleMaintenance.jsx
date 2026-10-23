import React, { useEffect, useState } from 'react';
import * as api from '../../api/api';
import VehicleTyreDetails from './VehicleTyreDetails';

const STANDARD_COMPONENTS = [
  'Engine Oil',
  'Gear Oil',
  'Clutch Oil',
  'Crown Oil',
  'Wheel Grease',
  'Battery',
  'Tyre Powder',
];

function maintenanceRows(components = []) {
  const byName = new Map(components.map((component) => [String(component.name || '').trim().toLowerCase(), component]));
  const standardRows = STANDARD_COMPONENTS.map((name) => {
    const component = byName.get(name.toLowerCase()) || {};
    byName.delete(name.toLowerCase());
    return {
      name,
      startingOdometerKm: component.startingOdometerKm == null ? '' : String(component.startingOdometerKm),
      expectedKm: component.expectedKm == null ? '' : String(component.expectedKm),
      reminderKm: component.reminderKm == null ? '' : String(component.reminderKm),
      isStandard: true,
    };
  });
  const customRows = [...byName.values()].map((component) => ({
    name: String(component.name || '').trim(),
    startingOdometerKm: component.startingOdometerKm == null ? '' : String(component.startingOdometerKm),
    expectedKm: component.expectedKm == null ? '' : String(component.expectedKm),
    reminderKm: component.reminderKm == null ? '' : String(component.reminderKm),
    isStandard: false,
  }));
  return [...standardRows, ...customRows];
}

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

function usedKm(component, currentOdometer) {
  if (component.startingOdometerKm === '' || currentOdometer == null) return null;
  const usage = Number(currentOdometer) - Number(component.startingOdometerKm);
  return Number.isFinite(usage) && usage >= 0 ? usage : null;
}

export default function VehicleMaintenance({ vehicle, onVehicleUpdated }) {
  const [components, setComponents] = useState(() => maintenanceRows(vehicle?.maintenanceComponents));
  const [newComponentName, setNewComponentName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setComponents(maintenanceRows(vehicle?.maintenanceComponents));
  }, [vehicle?._id, vehicle?.maintenanceComponents]);

  if (!vehicle) return null;

  function updateComponent(index, field, value) {
    setComponents((current) => current.map((component, rowIndex) => (
      rowIndex === index ? { ...component, [field]: value } : component
    )));
  }

  function addComponent(event) {
    event.preventDefault();
    const name = newComponentName.trim();
    if (!name) return;
    if (components.some((component) => component.name.trim().toLowerCase() === name.toLowerCase())) {
      setError('That maintenance component is already listed.');
      return;
    }
    setComponents((current) => [...current, {
      name,
      startingOdometerKm: '',
      expectedKm: '',
      reminderKm: '',
      isStandard: false,
    }]);
    setNewComponentName('');
    setError('');
    setMessage('');
  }

  async function saveMaintenance(event) {
    event.preventDefault();
    const names = components.map((component) => component.name.trim().toLowerCase());
    if (names.some((name, index) => !name || names.indexOf(name) !== index)) {
      setError('Each maintenance component must have a unique name.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.updateVehicleMaintenance(vehicle._id, components.map((component) => ({
        name: component.name.trim(),
        startingOdometerKm: numberOrNull(component.startingOdometerKm),
        expectedKm: numberOrNull(component.expectedKm),
        reminderKm: numberOrNull(component.reminderKm),
      })));
      onVehicleUpdated?.(response.data.vehicle);
      setMessage('Vehicle maintenance reminders saved.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save vehicle maintenance reminders.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="vehicle-maintenance-title">
      <h3 id="vehicle-maintenance-title" className="section-title" style={{ marginTop: 0 }}>
        Vehicle Maintenance - {vehicle.vehicleNumber}
      </h3>
      <p style={{ color: '#666', marginTop: -4 }}>
        Enter the odometer reading when each component was serviced and its expected service interval.
        Till now KM is calculated from the vehicle&apos;s latest odometer.
      </p>
      <form onSubmit={saveMaintenance}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Starting Odometer (km)</th>
                <th scope="col">Till now KM</th>
                <th scope="col">Expected KM</th>
                <th scope="col">Reminder KM</th>
              </tr>
            </thead>
            <tbody>
              {components.map((component, index) => {
                const tillNowKm = usedKm(component, vehicle.lastKnownOdometer);
                return (
                  <tr key={`${component.name}-${index}`}>
                    <td>
                      {component.isStandard ? component.name : (
                        <input
                          aria-label="Maintenance component name"
                          maxLength={50}
                          value={component.name}
                          onChange={(event) => updateComponent(index, 'name', event.target.value)}
                        />
                      )}
                    </td>
                    <td>
                      <input
                        aria-label={`${component.name} starting odometer`}
                        type="number"
                        min="0"
                        step="1"
                        value={component.startingOdometerKm}
                        onChange={(event) => updateComponent(index, 'startingOdometerKm', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${component.name} till now KM`}
                        type="number"
                        value={tillNowKm == null ? '' : String(tillNowKm)}
                        readOnly
                        aria-readonly="true"
                        placeholder="Calculated automatically"
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${component.name} expected KM`}
                        type="number"
                        min="0"
                        step="1"
                        value={component.expectedKm}
                        onChange={(event) => updateComponent(index, 'expectedKm', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${component.name} reminder KM`}
                        type="number"
                        min="0"
                        step="1"
                        value={component.reminderKm}
                        onChange={(event) => updateComponent(index, 'reminderKm', event.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          <div className="field" style={{ minWidth: 220, marginBottom: 0 }}>
            <label htmlFor={`maintenance-component-${vehicle._id}`}>Manual Entry</label>
            <input
              id={`maintenance-component-${vehicle._id}`}
              value={newComponentName}
              maxLength={50}
              onChange={(event) => setNewComponentName(event.target.value)}
              placeholder="Enter component name"
            />
          </div>
          <button className="btn secondary" type="button" onClick={addComponent}>
            Add Component
          </button>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Maintenance'}
          </button>
        </div>
      </form>
      {error && <p className="error-text" role="alert">{error}</p>}
      {message && <p role="status" style={{ color: '#2f855a' }}>{message}</p>}
      <h4 style={{ margin: '20px 0 8px', color: 'var(--green-900)' }}>Tyre Details</h4>
      <div>
        <VehicleTyreDetails vehicle={vehicle} />
      </div>
    </section>
  );
}
