import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { EMPTY_DRIVER_FORM } from '@kps/shared';
import * as api from '../../api/api';
import AddDriverModal from './AddDriverModal';
import CustomerDriverEditForm from './CustomerDriverEditForm';

export default function DriversTable({ customerId, data, setData }) {
  const [driverForm, setDriverForm] = useState(EMPTY_DRIVER_FORM);
  const [driverError, setDriverError] = useState('');
  const [driverSaving, setDriverSaving] = useState(false);
  const [driverEditId, setDriverEditId] = useState('');
  const [driverEditForm, setDriverEditForm] = useState(EMPTY_DRIVER_FORM);
  const [driverEditError, setDriverEditError] = useState('');
  const [driverEditSaving, setDriverEditSaving] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [driverBulkEditMode, setDriverBulkEditMode] = useState(false);
  const [driverDrafts, setDriverDrafts] = useState({});
  const [driverBulkSaving, setDriverBulkSaving] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);

  async function addDriver(e) {
    e.preventDefault();
    setDriverError('');
    setDriverSaving(true);
    try {
      const { temporaryDriverRequired, temporaryDriverName, temporaryDriverJoiningDate, temporaryDriverReturningDate, ...rest } = driverForm;
      const res = await api.createVehicleUser(customerId, {
        ...rest,
        temporaryDriver: {
          required: temporaryDriverRequired,
          name: temporaryDriverName,
          joiningDate: temporaryDriverJoiningDate || undefined,
          returningDate: temporaryDriverReturningDate || undefined,
        },
      });
      setData((current) => ({
        ...current,
        vehicles: current.vehicles.map((vehicle) => (
          String(vehicle._id) === String(res.data.user.vehicle)
            ? { ...vehicle, driverName: res.data.user.displayName || res.data.user.name, driverMobile: res.data.user.mobileNumber }
            : vehicle
        )),
        users: [...current.users, res.data.user].sort((a, b) => a.username.localeCompare(b.username)),
      }));
      setDriverForm({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '', temporaryDriverRequired: false, temporaryDriverName: '', temporaryDriverJoiningDate: '', temporaryDriverReturningDate: '' });
      setShowAddDriverModal(false);
    } catch (err) {
      setDriverError(err.response?.data?.error || 'Failed to add driver');
    } finally {
      setDriverSaving(false);
    }
  }

  function editSelectedDrivers() {
    if (!selectedDrivers.length) return;
    setDriverDrafts(Object.fromEntries(
      (data?.users || [])
        .filter((entry) => selectedDrivers.includes(String(entry.id || entry._id)))
        .map((entry) => [String(entry.id || entry._id), {
          name: entry.name || '',
          mobileNumber: entry.mobileNumber || '',
        }])
    ));
    setDriverBulkEditMode(true);
  }

  async function saveSelectedDrivers() {
    if (!selectedDrivers.length) return;
    setDriverBulkSaving(true);
    setDriverEditError('');
    try {
      const updates = selectedDrivers.map((userId) => ({ userId, ...driverDrafts[userId] }));
      const res = await api.bulkUpdateVehicleUsers(customerId, updates);
      const updatedById = Object.fromEntries(res.data.users.map((entry) => [String(entry.id || entry._id), entry]));
      setData((current) => ({
        ...current,
        users: current.users.map((entry) => updatedById[String(entry.id || entry._id)] || entry),
        vehicles: current.vehicles.map((vehicle) => {
          const updated = updatedById[String(current.users.find((entry) => String(entry.vehicle) === String(vehicle._id))?.id || '')];
          return updated ? { ...vehicle, driverName: updated.name, driverMobile: updated.mobileNumber } : vehicle;
        }),
      }));
      setSelectedDrivers([]);
      setDriverDrafts({});
      setDriverBulkEditMode(false);
    } catch (err) {
      setDriverEditError(err.response?.data?.error || 'Failed to save selected drivers');
    } finally {
      setDriverBulkSaving(false);
    }
  }

  async function deleteSelectedDrivers() {
    if (!selectedDrivers.length) return;
    if (!window.confirm(`Delete ${selectedDrivers.length} selected driver(s)?`)) return;
    setDriverBulkSaving(true);
    setDriverEditError('');
    try {
      await api.bulkDeleteVehicleUsers(customerId, selectedDrivers);
      setData((current) => ({
        ...current,
        users: current.users.filter((entry) => !selectedDrivers.includes(String(entry.id || entry._id))),
        vehicles: current.vehicles.map((vehicle) => (
          selectedDrivers.includes(String(current.users.find((entry) => String(entry.vehicle) === String(vehicle._id))?.id || ''))
            ? { ...vehicle, driverName: null, driverMobile: null }
            : vehicle
        )),
      }));
      setSelectedDrivers([]);
      setDriverDrafts({});
      setDriverBulkEditMode(false);
    } catch (err) {
      setDriverEditError(err.response?.data?.error || 'Failed to delete selected drivers');
    } finally {
      setDriverBulkSaving(false);
    }
  }

  async function saveDriverEdit(e) {
    e.preventDefault();
    if (!driverEditId) return;
    setDriverEditError('');
    setDriverEditSaving(true);
    try {
      const { temporaryDriverRequired, temporaryDriverName, temporaryDriverJoiningDate, temporaryDriverReturningDate } = driverEditForm;
      const res = await api.updateVehicleUser(customerId, driverEditId, {
        name: driverEditForm.name,
        mobileNumber: driverEditForm.mobileNumber,
        joiningDate: driverEditForm.joiningDate || null,
        resigningDate: driverEditForm.resigningDate || null,
        username: driverEditForm.username,
        password: driverEditForm.password || undefined,
        vehicleId: driverEditForm.vehicleId || '',
        basicSalary: Number(driverEditForm.basicSalary || 0),
        kmCharges: Number(driverEditForm.kmCharges || 0),
        minKmCharges: Number(driverEditForm.minKmCharges || 0),
        temporaryDriver: {
          required: temporaryDriverRequired,
          name: temporaryDriverName,
          joiningDate: temporaryDriverJoiningDate || undefined,
          returningDate: temporaryDriverReturningDate || undefined,
        },
      });
      setData((current) => ({
        ...current,
        users: current.users.map((user) => (
          String(user._id) === String(res.data.user.id) ? res.data.user : user
        )),
        vehicles: current.vehicles.map((vehicle) => {
          const updated = res.data.user;
          if (String(vehicle._id) === String(updated.vehicle)) {
            return { ...vehicle, driverName: updated.name, driverMobile: updated.mobileNumber };
          }
          if (String(vehicle.driverName || '') === String(updated.name) || String(vehicle.driverMobile || '') === String(updated.mobileNumber)) {
            return { ...vehicle, driverName: updated.name, driverMobile: updated.mobileNumber };
          }
          return vehicle;
        }),
      }));
      setDriverEditId('');
      setDriverEditForm({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '', temporaryDriverRequired: false, temporaryDriverName: '', temporaryDriverJoiningDate: '', temporaryDriverReturningDate: '' });
    } catch (err) {
      setDriverEditError(err.response?.data?.error || 'Failed to update driver');
    } finally {
      setDriverEditSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Driver List</h3>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', margin: '0 0 14px' }}>
        <button type="button" className="btn" onClick={() => setShowAddDriverModal(true)}>
          Add Driver
        </button>
        <button type="button" className="btn secondary" disabled={!selectedDrivers.length} onClick={editSelectedDrivers}>
          Edit
        </button>
        <button type="button" className="btn danger" disabled={!selectedDrivers.length || driverBulkSaving} onClick={deleteSelectedDrivers}>
          Delete selected
        </button>
        <button type="button" className="btn" disabled={!driverBulkEditMode || driverBulkSaving} onClick={saveSelectedDrivers}>
          {driverBulkSaving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {(() => {
          const driverUsers = data?.users?.filter((item) => item.role === 'vehicle_user' && item.isActive !== false) || [];
          if (driverUsers.length === 0) return <p>No drivers found.</p>;
          return driverUsers.map((driver) => (
            <div key={driver.id || driver._id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <input
                type="checkbox"
                checked={selectedDrivers.includes(String(driver.id || driver._id))}
                onChange={() => setSelectedDrivers((current) => {
                  const driverId = String(driver.id || driver._id);
                  return current.includes(driverId)
                    ? current.filter((id) => id !== driverId)
                    : [...current, driverId];
                })}
                aria-label={`Select ${driver.name || driver.username}`}
                style={{ width: 'auto' }}
              />
              {driverBulkEditMode && selectedDrivers.includes(String(driver.id || driver._id)) ? (
                <div className="grid-2" style={{ flex: 1 }}>
                  <input
                    value={driverDrafts[String(driver.id || driver._id)]?.name || ''}
                    onChange={(event) => setDriverDrafts((current) => ({
                      ...current,
                      [String(driver.id || driver._id)]: {
                        ...current[String(driver.id || driver._id)],
                        name: event.target.value,
                      },
                    }))}
                    aria-label="Driver name"
                  />
                  <input
                    value={driverDrafts[String(driver.id || driver._id)]?.mobileNumber || ''}
                    onChange={(event) => setDriverDrafts((current) => ({
                      ...current,
                      [String(driver.id || driver._id)]: {
                        ...current[String(driver.id || driver._id)],
                        mobileNumber: event.target.value,
                      },
                    }))}
                    aria-label="Driver mobile number"
                  />
                </div>
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <Link to={`/customers/${customerId}/drivers/${driver.id || driver._id}`} style={{ color: 'var(--green-900)', fontWeight: 700 }}>
                      {driver.displayName || driver.name || 'Unnamed driver'}
                    </Link>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {driver.username} | {driver.mobileNumber || 'No phone'} | Joining Date: {driver.joiningDate ? new Date(driver.joiningDate).toLocaleDateString('en-IN') : 'Not set'}
                    </div>
                </div>
                  <div style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>
                    {data?.vehicles?.find((vehicle) => String(vehicle._id) === String(driver.vehicle))?.vehicleNumber || 'Unassigned'}
                  </div>
                </>
              )}
            </div>
          ));
        })()}
      </div>

      {driverEditId && (
        <CustomerDriverEditForm
          driverEditForm={driverEditForm}
          setDriverEditForm={setDriverEditForm}
          vehicles={data?.vehicles}
          driverEditError={driverEditError}
          driverEditSaving={driverEditSaving}
          onSubmit={saveDriverEdit}
          onCancel={() => {
            setDriverEditId('');
              setDriverEditForm({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '', temporaryDriverRequired: false, temporaryDriverName: '', temporaryDriverJoiningDate: '', temporaryDriverReturningDate: '' });
            setDriverEditError('');
          }}
        />
      )}

      {showAddDriverModal && (
        <AddDriverModal
          driverForm={driverForm}
          setDriverForm={setDriverForm}
          vehicles={data?.vehicles}
          driverError={driverError}
          driverSaving={driverSaving}
          onSubmit={addDriver}
          onClose={() => setShowAddDriverModal(false)}
        />
      )}
    </div>
  );
}
