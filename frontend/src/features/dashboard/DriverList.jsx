import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { EMPTY_DRIVER_FORM } from '@kps/shared';
import * as api from '../../api/api';
import AddDriverForm from './AddDriverForm';
import DriverEditForm from './DriverEditForm';

export default function DriverList({ user, vehicles, setVehicles, customerData, setCustomerData, driverUsers, vehicleExpenses = [] }) {
  const [driverForm, setDriverForm] = useState(EMPTY_DRIVER_FORM);
  const [driverError, setDriverError] = useState('');
  const [driverSaving, setDriverSaving] = useState(false);
  const [driverEditId, setDriverEditId] = useState('');
  const [driverEditForm, setDriverEditForm] = useState(EMPTY_DRIVER_FORM);
  const [driverEditError, setDriverEditError] = useState('');
  const [driverEditSaving, setDriverEditSaving] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [showAddDriverForm, setShowAddDriverForm] = useState(false);

  async function addDriver(e) {
    e.preventDefault();
    if (!user?.customer) return;

    setDriverError('');
    setDriverSaving(true);
    try {
      const { temporaryDriverRequired, temporaryDriverName, temporaryDriverJoiningDate, temporaryDriverReturningDate, ...rest } = driverForm;
      const res = await api.createVehicleUser(user.customer, {
        ...rest,
        temporaryDriver: {
          required: temporaryDriverRequired,
          name: temporaryDriverName,
          joiningDate: temporaryDriverJoiningDate || undefined,
          returningDate: temporaryDriverReturningDate || undefined,
        },
      });
      setVehicles((current) => current.map((vehicle) => (
        String(vehicle._id) === String(res.data.user.vehicle)
          ? { ...vehicle, driverName: res.data.user.name, driverMobile: res.data.user.mobileNumber }
          : vehicle
      )));
      setCustomerData((current) => {
        if (!current) return current;
        return {
          ...current,
          users: [...current.users, res.data.user].sort((a, b) => (a.username || '').localeCompare(b.username || '')),
          vehicles: current.vehicles.map((vehicle) => (
            String(vehicle._id) === String(res.data.user.vehicle)
              ? { ...vehicle, driverName: res.data.user.displayName || res.data.user.name, driverMobile: res.data.user.mobileNumber }
              : vehicle
          )),
        };
      });
      setDriverForm({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '', temporaryDriverRequired: false, temporaryDriverName: '', temporaryDriverJoiningDate: '', temporaryDriverReturningDate: '' });
      setShowAddDriverForm(false);
    } catch (err) {
      setDriverError(err.response?.data?.error || 'Failed to add driver');
    } finally {
      setDriverSaving(false);
    }
  }

  async function saveDriverEdit(event) {
    event?.preventDefault();
    if (!user?.customer || !driverEditId) return;

    setDriverEditError('');
    setDriverEditSaving(true);
    try {
      const { temporaryDriverRequired, temporaryDriverName, temporaryDriverJoiningDate, temporaryDriverReturningDate } = driverEditForm;
      const res = await api.updateVehicleUser(user.customer, driverEditId, {
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

      setVehicleIdAndDriverState(res.data.user);
      setCustomerData((current) => {
        if (!current) return current;
        return {
          ...current,
          users: current.users.map((userEntry) => (
            String(userEntry._id) === String(res.data.user.id || res.data.user._id) ? res.data.user : userEntry
          )),
          vehicles: current.vehicles.map((vehicle) => {
            if (String(vehicle._id) === String(res.data.user.vehicle)) {
              return { ...vehicle, driverName: res.data.user.displayName || res.data.user.name, driverMobile: res.data.user.mobileNumber };
            }
            if (String(vehicle.driverName || '') === String(res.data.user.name) && String(vehicle.driverMobile || '') === String(res.data.user.mobileNumber)) {
              return { ...vehicle, driverName: res.data.user.displayName || res.data.user.name, driverMobile: res.data.user.mobileNumber };
            }
            return vehicle;
          }),
        };
      });
      setDriverEditId('');
      setSelectedDrivers([]);
      setDriverEditForm({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '', temporaryDriverRequired: false, temporaryDriverName: '', temporaryDriverJoiningDate: '', temporaryDriverReturningDate: '' });
    } catch (err) {
      setDriverEditError(err.response?.data?.error || 'Failed to update driver');
    } finally {
      setDriverEditSaving(false);
    }
  }

  function setVehicleIdAndDriverState(updatedUser) {
    setVehicles((current) => current.map((vehicle) => {
      if (String(vehicle._id) === String(updatedUser.vehicle)) {
        return { ...vehicle, driverName: updatedUser.displayName || updatedUser.name, driverMobile: updatedUser.mobileNumber };
      }
      if (String(vehicle.driverName || '') === String(updatedUser.name) && String(vehicle.driverMobile || '') === String(updatedUser.mobileNumber)) {
        return { ...vehicle, driverName: updatedUser.displayName || updatedUser.name, driverMobile: updatedUser.mobileNumber };
      }
      return vehicle;
    }));
  }

  function editSelectedDriver() {
    if (selectedDrivers.length !== 1) return;
    const driver = driverUsers.find((entry) => String(entry.id || entry._id) === selectedDrivers[0]);
    if (!driver) return;

    setDriverEditId(driver.id || driver._id);
    setDriverEditForm({
      name: driver.name || '',
      mobileNumber: driver.mobileNumber || '',
      joiningDate: driver.joiningDate ? new Date(driver.joiningDate).toISOString().slice(0, 10) : '',
      resigningDate: driver.resigningDate ? new Date(driver.resigningDate).toISOString().slice(0, 10) : '',
      username: driver.username || '',
      password: '',
      vehicleId: String(driver.vehicle || ''),
      basicSalary: String(driver.basicSalary ?? 0),
      kmCharges: String(driver.kmCharges ?? 0),
      minKmCharges: String(driver.minKmCharges ?? 0),
      temporaryDriverRequired: Boolean(driver.temporaryDriver?.required),
      temporaryDriverName: driver.temporaryDriver?.name || '',
      temporaryDriverJoiningDate: driver.temporaryDriver?.joiningDate ? new Date(driver.temporaryDriver.joiningDate).toISOString().slice(0, 10) : '',
      temporaryDriverReturningDate: driver.temporaryDriver?.returningDate ? new Date(driver.temporaryDriver.returningDate).toISOString().slice(0, 10) : '',
    });
    setDriverEditError('');
  }

  async function deleteSelectedDriver() {
    if (selectedDrivers.length !== 1) return;
    const driver = driverUsers.find((entry) => String(entry.id || entry._id) === selectedDrivers[0]);
    if (!driver) return;
    await removeDriver(driver);
    setSelectedDrivers([]);
  }

  async function removeDriver(driver) {
    if (!user?.customer || !window.confirm(`Delete driver ${driver.name || driver.username}?`)) return;

    setDriverEditError('');
    try {
      await api.deleteVehicleUser(user.customer, driver.id || driver._id);
      setVehicles((current) => current.map((vehicle) => (
        String(vehicle._id) === String(driver.vehicle)
          ? { ...vehicle, driverName: null, driverMobile: null }
          : vehicle
      )));
      setCustomerData((current) => {
        if (!current) return current;
        return {
          ...current,
          users: current.users.filter((item) => String(item.id || item._id) !== String(driver.id || driver._id)),
          vehicles: current.vehicles.map((vehicle) => (
            String(vehicle._id) === String(driver.vehicle)
              ? { ...vehicle, driverName: null, driverMobile: null }
              : vehicle
          )),
        };
      });
    } catch (err) {
      setDriverEditError(err.response?.data?.error || 'Failed to delete driver');
    }
  }

  const customerVehicles = customerData?.vehicles || vehicles;
  const currentYear = new Date().getFullYear();
  const yearExpenseByVehicle = vehicleExpenses.reduce((acc, expense) => {
    if (new Date(expense.date).getFullYear() !== currentYear) return acc;
    const vehicleId = String(expense.vehicle?._id || expense.vehicle || '');
    acc[vehicleId] = (acc[vehicleId] || 0) + (Number(expense.amount) || 0);
    return acc;
  }, {});

  return (
    <div className="card customer-admin-driver-list" style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Vehicle & Driver List</h3>
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {customerVehicles.length === 0 ? (
          <p>No vehicles found.</p>
        ) : (
          customerVehicles.map((vehicle) => {
            const driver = driverUsers.find((entry) => String(entry.vehicle) === String(vehicle._id));
            return (
            <div key={vehicle._id} className="list-item" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', alignItems: 'center', gap: 16 }}>
              <input
                type="checkbox"
                checked={driver ? selectedDrivers.includes(String(driver.id || driver._id)) : false}
                onChange={() => {
                  if (!driver) return;
                  const driverId = String(driver.id || driver._id);
                  setSelectedDrivers((current) => (
                    current.includes(driverId)
                      ? current.filter((id) => id !== driverId)
                      : [...current, driverId]
                  ));
                }}
                disabled={!driver}
                aria-label={driver ? `Select ${driver.name || driver.username}` : 'Unassigned vehicle'}
                style={{ width: 'auto' }}
              />
              <div>
                <strong>{vehicle.vehicleNumber}</strong>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Expenses {currentYear}: Rs {Math.round(yearExpenseByVehicle[String(vehicle._id)] || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ textAlign: 'center', color: '#4b6470' }}>
                {driver?.mobileNumber || 'No phone'}
              </div>
              <div style={{ textAlign: 'right' }}>
                {driver ? (
                  <>
                    <Link to={`/drivers/${user.customer}/${driver.id || driver._id}`} style={{ color: 'var(--green-900)', fontWeight: 700 }}>
                      {driver.displayName || driver.name || 'Unnamed driver'}
                    </Link>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {driver.username} | Joining Date: {driver.joiningDate ? new Date(driver.joiningDate).toLocaleDateString('en-IN') : 'Not set'}
                    </div>
                  </>
                ) : (
                  <span style={{ color: '#666' }}>Unassigned vehicle</span>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <button type="button" className="btn" onClick={() => setShowAddDriverForm(true)}>
          Add Driver
        </button>
        <button type="button" className="btn secondary" disabled={selectedDrivers.length !== 1} onClick={editSelectedDriver}>
          Edit
        </button>
        <button type="button" className="btn danger" disabled={selectedDrivers.length !== 1} onClick={deleteSelectedDriver}>
          Delete
        </button>
        <button type="button" className="btn" disabled={!driverEditId || driverEditSaving} onClick={() => saveDriverEdit()}>
          {driverEditSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {driverEditId && (
        <DriverEditForm
          driverEditForm={driverEditForm}
          setDriverEditForm={setDriverEditForm}
          vehicles={vehicles}
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

      {showAddDriverForm && (
        <AddDriverForm
          driverForm={driverForm}
          setDriverForm={setDriverForm}
          vehicles={vehicles}
          driverError={driverError}
          driverSaving={driverSaving}
          onSubmit={addDriver}
        />
      )}
    </div>
  );
}
