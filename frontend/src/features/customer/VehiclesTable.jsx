import React, { useState } from 'react';
import * as api from '../../api/api';

export default function VehiclesTable({ customerId, data, setData, user, vehicleExpenses = [] }) {
  const [vehicleForm, setVehicleForm] = useState({ vehicleNumber: '' });
  const [vehicleError, setVehicleError] = useState('');
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleEditError, setVehicleEditError] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [vehicleBulkEditMode, setVehicleBulkEditMode] = useState(false);
  const [vehicleDrafts, setVehicleDrafts] = useState({});
  const [vehicleBulkSaving, setVehicleBulkSaving] = useState(false);

  async function addVehicle(e) {
    e.preventDefault();
    setVehicleError('');
    setVehicleSaving(true);
    try {
      const res = await api.addVehicleToCustomer(customerId, { vehicleNumber: vehicleForm.vehicleNumber });
      setData((current) => ({ ...current, vehicles: [...current.vehicles, res.data.vehicle].sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber)) }));
      setVehicleForm({ vehicleNumber: '' });
    } catch (err) {
      setVehicleError(err.response?.data?.error || 'Failed to add vehicle');
    } finally {
      setVehicleSaving(false);
    }
  }

  function editSelectedVehicles() {
    if (!selectedVehicles.length) return;
    setVehicleDrafts(Object.fromEntries(
      data.vehicles
        .filter((vehicle) => selectedVehicles.includes(vehicle._id))
        .map((vehicle) => [vehicle._id, vehicle.vehicleNumber || ''])
    ));
    setVehicleBulkEditMode(true);
  }

  async function saveSelectedVehicles() {
    if (!selectedVehicles.length) return;
    setVehicleBulkSaving(true);
    setVehicleEditError('');
    try {
      const updatedVehicles = await Promise.all(selectedVehicles.map(async (vehicleId) => {
        const res = await api.updateVehicle(vehicleId, { vehicleNumber: vehicleDrafts[vehicleId] });
        return res.data.vehicle;
      }));
      const updatedById = Object.fromEntries(updatedVehicles.map((vehicle) => [vehicle._id, vehicle]));
      setData((current) => ({
        ...current,
        vehicles: current.vehicles
          .map((vehicle) => updatedById[vehicle._id] || vehicle)
          .sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber)),
      }));
      setSelectedVehicles([]);
      setVehicleDrafts({});
      setVehicleBulkEditMode(false);
    } catch (err) {
      setVehicleEditError(err.response?.data?.error || 'Failed to save vehicle changes');
    } finally {
      setVehicleBulkSaving(false);
    }
  }

  async function deleteSelectedVehicles() {
    if (!selectedVehicles.length) return;
    if (!window.confirm(`Delete ${selectedVehicles.length} selected vehicle(s) and their trip records?`)) return;
    setVehicleEditError('');
    setVehicleBulkSaving(true);
    try {
      await Promise.all(selectedVehicles.map((vehicleId) => api.deleteVehicle(vehicleId)));
      setData((current) => ({
        ...current,
        vehicles: current.vehicles.filter((vehicle) => !selectedVehicles.includes(vehicle._id)),
      }));
      setSelectedVehicles([]);
      setVehicleDrafts({});
      setVehicleBulkEditMode(false);
    } catch (err) {
      setVehicleEditError(err.response?.data?.error || 'Failed to delete selected vehicles');
    } finally {
      setVehicleBulkSaving(false);
    }
  }

  const currentYear = new Date().getFullYear();
  const yearExpenseByVehicle = vehicleExpenses.reduce((acc, expense) => {
    if (new Date(expense.date).getFullYear() !== currentYear) return acc;
    const vehicleId = String(expense.vehicle?._id || expense.vehicle || '');
    acc[vehicleId] = (acc[vehicleId] || 0) + (Number(expense.amount) || 0);
    return acc;
  }, {});

  return (
    <>
      {user?.role === 'super_admin' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Add Vehicle</h3>
          <form onSubmit={addVehicle} style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
              <label>Vehicle Number</label>
              <input
                value={vehicleForm.vehicleNumber}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleNumber: e.target.value })}
                required
              />
            </div>
            <button className="btn" disabled={vehicleSaving} style={{ marginBottom: 0 }}>
              {vehicleSaving ? 'Adding...' : 'Add Vehicle'}
            </button>
          </form>
          {vehicleError && <div className="error-text" style={{ marginTop: 12 }}>{vehicleError}</div>}
        </div>
      )}

      <h3 className="section-title" style={{ marginTop: 24 }}>Vehicle Number | Driver Name</h3>
      {!data && <p>Loading customer details...</p>}
      {data?.vehicles.length === 0 && <p>No vehicles found.</p>}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {data?.vehicles.map((vehicle) => (
          <div key={vehicle._id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <input
              type="checkbox"
              checked={selectedVehicles.includes(vehicle._id)}
              onChange={() => setSelectedVehicles((current) => (
                current.includes(vehicle._id)
                  ? current.filter((id) => id !== vehicle._id)
                  : [...current, vehicle._id]
              ))}
              aria-label={`Select ${vehicle.vehicleNumber}`}
              style={{ width: 'auto' }}
            />
            {vehicleBulkEditMode && selectedVehicles.includes(vehicle._id) ? (
              <div style={{ display: 'flex', flex: 1 }}>
                  <input
                    value={vehicleDrafts[vehicle._id] || ''}
                    onChange={(e) => setVehicleDrafts((current) => ({ ...current, [vehicle._id]: e.target.value }))}
                    placeholder="Vehicle number"
                    required
                  />
              </div>
            ) : (
              <div style={{ flex: 1, color: 'inherit' }}>
                <strong>{vehicle.vehicleNumber} | {vehicle.driverName || 'Not assigned'}</strong>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Expenses {currentYear}: Rs {Math.round(yearExpenseByVehicle[String(vehicle._id)] || 0).toLocaleString('en-IN')}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {vehicleEditError && <div className="error-text" style={{ marginTop: 12 }}>{vehicleEditError}</div>}
      {user?.role === 'super_admin' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <button type="button" className="btn secondary" disabled={!selectedVehicles.length} onClick={editSelectedVehicles}>
            Edit selected
          </button>
          <button type="button" className="btn danger" disabled={!selectedVehicles.length || vehicleBulkSaving} onClick={deleteSelectedVehicles}>
            Delete selected
          </button>
          <button type="button" className="btn" disabled={!vehicleBulkEditMode || vehicleBulkSaving} onClick={saveSelectedVehicles}>
            {vehicleBulkSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      )}
    </>
  );
}
