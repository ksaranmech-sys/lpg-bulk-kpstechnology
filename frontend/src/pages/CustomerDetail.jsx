import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '../api/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function formatTripRoute(trip) {
  const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN') : 'Date pending';
  return `${trip.loadingLocation || 'Loading pending'} (${formatDate(trip.loadingDate)}) -> ${trip.unloadingLocation || 'Unloading pending'} (${formatDate(trip.unloadingDate)})`;
}

function tripHistoryMonthKey(trip) {
  const date = new Date(trip.closedAt || trip.loadingDate || trip.createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isCurrentOrPreviousMonth(monthKey) {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
  return monthKey === currentMonth || monthKey === previousMonth;
}

export default function CustomerDetail() {
  const { user } = useAuth();
  const { customerId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [vehicleForm, setVehicleForm] = useState({ vehicleNumber: '' });
  const [vehicleError, setVehicleError] = useState('');
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleEditError, setVehicleEditError] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [vehicleBulkEditMode, setVehicleBulkEditMode] = useState(false);
  const [vehicleDrafts, setVehicleDrafts] = useState({});
  const [vehicleBulkSaving, setVehicleBulkSaving] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '' });
  const [driverError, setDriverError] = useState('');
  const [driverSaving, setDriverSaving] = useState(false);
  const [driverEditId, setDriverEditId] = useState('');
  const [driverEditForm, setDriverEditForm] = useState({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '' });
  const [driverEditError, setDriverEditError] = useState('');
  const [driverEditSaving, setDriverEditSaving] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [driverBulkEditMode, setDriverBulkEditMode] = useState(false);
  const [driverDrafts, setDriverDrafts] = useState({});
  const [driverBulkSaving, setDriverBulkSaving] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [customerEditForm, setCustomerEditForm] = useState({
    companyName: '',
    email: '',
    mobileNumber: '',
    address: '',
    adminUsername: '',
    adminPassword: '',
    adminName: '',
    adminMobileNumber: '',
  });
  const [customerEditError, setCustomerEditError] = useState('');
  const [customerEditSaving, setCustomerEditSaving] = useState(false);
  const [customerEditChanged, setCustomerEditChanged] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [closedTrips, setClosedTrips] = useState([]);
  const [closedTripsLoading, setClosedTripsLoading] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState('');
  const [tripHistoryError, setTripHistoryError] = useState('');
  const [showArchivedTrips, setShowArchivedTrips] = useState(false);

  useEffect(() => {
    if (!['super_admin', 'customer_admin'].includes(user?.role)) return;
    api
      .getCustomer(customerId)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load customer'));
  }, [customerId, user]);

  useEffect(() => {
    if (!selectedVehicleId) {
      setClosedTrips([]);
      return;
    }
    setClosedTripsLoading(true);
    api
      .listTripsForVehicle(selectedVehicleId)
      .then((res) => setClosedTrips(res.data.trips || []))
      .finally(() => setClosedTripsLoading(false));
  }, [selectedVehicleId]);

  useEffect(() => {
    setShowArchivedTrips(false);
  }, [selectedVehicleId]);

  async function deleteTrip(tripId) {
    if (!window.confirm('Delete this trip history entry?')) return;
    setDeletingTripId(tripId);
    setTripHistoryError('');
    try {
      await api.deleteTrip(tripId);
      setClosedTrips((current) => current.filter((trip) => trip._id !== tripId));
    } catch (err) {
      setTripHistoryError(err.response?.data?.error || 'Failed to delete trip history');
    } finally {
      setDeletingTripId('');
    }
  }

  async function closeTrip(tripId) {
    try {
      await api.closeTrip(tripId);
      setClosedTrips((current) => current.map((trip) => (
        trip._id === tripId ? { ...trip, status: 'closed' } : trip
      )));
    } catch (err) {
      setTripHistoryError(err.response?.data?.error || 'Failed to close trip');
    }
  }

  const archivedTrips = closedTrips.filter((trip) => trip.status === 'closed' && !isCurrentOrPreviousMonth(tripHistoryMonthKey(trip)));
  const visibleClosedTrips = showArchivedTrips
    ? closedTrips
    : closedTrips.filter((trip) => trip.status !== 'closed' || isCurrentOrPreviousMonth(tripHistoryMonthKey(trip)));

  useEffect(() => {
    if (!data) return;
    const adminUser = data.users?.find((user) => user.role === 'customer_admin');
    setCustomerEditForm({
      companyName: data.customer?.companyName || '',
      email: data.customer?.email || '',
      mobileNumber: data.customer?.mobileNumber || '',
      address: data.customer?.address || '',
      adminUsername: adminUser?.username || '',
      adminPassword: '',
      adminName: adminUser?.name || '',
      adminMobileNumber: adminUser?.mobileNumber || '',
    });
    setCustomerEditChanged(false);
  }, [data]);

  if (!['super_admin', 'customer_admin'].includes(user?.role)) {
    return <Layout><p>You do not have access to this page.</p></Layout>;
  }

  if (error) {
    return (
      <Layout>
        <Link to="/">&larr; Back to customers</Link>
        <p className="error-text">{error}</p>
      </Layout>
    );
  }

  const customer = data?.customer;

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

  async function addDriver(e) {
    e.preventDefault();
    setDriverError('');
    setDriverSaving(true);
    try {
      const res = await api.createVehicleUser(customerId, driverForm);
      setData((current) => ({
        ...current,
        vehicles: current.vehicles.map((vehicle) => (
          String(vehicle._id) === String(res.data.user.vehicle)
            ? { ...vehicle, driverName: res.data.user.name, driverMobile: res.data.user.mobileNumber }
            : vehicle
        )),
        users: [...current.users, res.data.user].sort((a, b) => a.username.localeCompare(b.username)),
      }));
      setDriverForm({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '' });
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

  function updateCustomerEditField(field, value) {
    setCustomerEditForm((current) => ({ ...current, [field]: value }));
    setCustomerEditChanged(true);
  }

  async function saveCustomerDetails(e) {
    e.preventDefault();
    setCustomerEditError('');
    setCustomerEditSaving(true);
    try {
      const payload = {
        companyName: customerEditForm.companyName,
        mobileNumber: customerEditForm.mobileNumber,
        email: customerEditForm.email,
        address: customerEditForm.address,
        adminUsername: customerEditForm.adminUsername,
        adminPassword: customerEditForm.adminPassword || undefined,
        adminName: customerEditForm.adminName,
        adminMobileNumber: customerEditForm.adminMobileNumber,
      };
      const res = await api.updateCustomer(customerId, payload);
      setData((current) => ({
        ...current,
        customer: res.data.customer,
        users: current.users.map((user) => (user.role === 'customer_admin' ? res.data.adminUser : user)),
      }));
      setCustomerEditChanged(false);
    } catch (err) {
      setCustomerEditError(err.response?.data?.error || 'Failed to update customer details');
    } finally {
      setCustomerEditSaving(false);
    }
  }

  async function saveDriverEdit(e) {
    e.preventDefault();
    if (!driverEditId) return;
    setDriverEditError('');
    setDriverEditSaving(true);
    try {
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
      setDriverEditForm({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '' });
    } catch (err) {
      setDriverEditError(err.response?.data?.error || 'Failed to update driver');
    } finally {
      setDriverEditSaving(false);
    }
  }

  return (
    <Layout>
      <Link to="/">&larr; Back to customers</Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          {customer ? customer.companyName : 'Loading...'}
        </h2>
        {customer && (
          <span className={`badge ${customer.isActive ? 'closed' : 'open'}`}>
            {customer.isActive ? 'Active' : 'Blocked'}
          </span>
        )}
      </div>

      {user?.role === 'super_admin' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Edit Customer Details</h3>
          <form onSubmit={saveCustomerDetails}>
            <div className="grid-2">
              <div className="field">
                <label>Company Name</label>
                <input value={customerEditForm.companyName} onChange={(e) => updateCustomerEditField('companyName', e.target.value)} required />
              </div>
              <div className="field">
                <label>Email Address</label>
                <input type="email" value={customerEditForm.email} onChange={(e) => updateCustomerEditField('email', e.target.value)} required />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Phone Number</label>
                <input value={customerEditForm.mobileNumber} onChange={(e) => updateCustomerEditField('mobileNumber', e.target.value)} required />
              </div>
              <div className="field">
                <label>Address</label>
                <input value={customerEditForm.address} onChange={(e) => updateCustomerEditField('address', e.target.value)} />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Admin Username</label>
                <input value={customerEditForm.adminUsername} onChange={(e) => updateCustomerEditField('adminUsername', e.target.value)} required />
              </div>
              <div className="field">
                <label>Admin Password</label>
                <input type="password" value={customerEditForm.adminPassword} onChange={(e) => updateCustomerEditField('adminPassword', e.target.value)} placeholder="Leave blank to keep current password" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Admin Name</label>
                <input value={customerEditForm.adminName} onChange={(e) => updateCustomerEditField('adminName', e.target.value)} />
              </div>
              <div className="field">
                <label>Admin Mobile Number</label>
                <input value={customerEditForm.adminMobileNumber} onChange={(e) => updateCustomerEditField('adminMobileNumber', e.target.value)} />
              </div>
            </div>
            {customerEditError && <div className="error-text">{customerEditError}</div>}
            {customerEditChanged && !customerEditSaving && (
              <button className="btn" type="submit">
                Save Changes
              </button>
            )}
            {customerEditSaving && (
              <button className="btn" type="button" disabled>
                Saving...
              </button>
            )}
          </form>
        </div>
      )}

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

      <div className="card" style={{ marginTop: 24 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Trip History</h3>
        <div className="field">
          <label htmlFor="customer-closed-trip-vehicle">Select Vehicle</label>
          <select
            id="customer-closed-trip-vehicle"
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
          >
            <option value="">select vehicle</option>
            {data?.vehicles.map((vehicle) => (
              <option key={vehicle._id} value={vehicle._id}>
                {vehicle.vehicleNumber} | {vehicle.driverName || 'Not assigned'}
              </option>
            ))}
          </select>
        </div>

        {closedTripsLoading && <p>Loading closed trips...</p>}
        {!closedTripsLoading && !selectedVehicleId && <p>Select a vehicle to view trip history.</p>}
        {!closedTripsLoading && selectedVehicleId && visibleClosedTrips.length === 0 && <p>No trip history found for this vehicle.</p>}
        {tripHistoryError && <p className="error-text">{tripHistoryError}</p>}
        {!closedTripsLoading && visibleClosedTrips.length > 0 && (
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {visibleClosedTrips.map((trip) => (
              <div key={trip._id} className="list-item">
                <Link to={`/trips/${trip._id}`} style={{ flex: 1, color: 'inherit', textDecoration: 'none' }}>
                    <strong>{formatTripRoute(trip)}</strong>
                </Link>
                <button type="button" className="btn danger" onClick={() => deleteTrip(trip._id)} disabled={deletingTripId === trip._id}>
                  {deletingTripId === trip._id ? 'Deleting...' : 'Delete'}
                </button>
                {trip.status === 'pending_close' && (
                  <button type="button" className="btn" onClick={() => closeTrip(trip._id)}>
                    Close Trip
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {!closedTripsLoading && archivedTrips.length > 0 && (
          <button
            type="button"
            className="btn secondary"
            style={{ marginTop: 12 }}
            onClick={() => setShowArchivedTrips((current) => !current)}
          >
            {showArchivedTrips ? 'Hide archived bills' : `View archived bills (${archivedTrips.length})`}
          </button>
        )}
      </div>
      {user?.role === 'customer_admin' && (
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
                          {driver.name || 'Unnamed driver'}
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
            <form onSubmit={saveDriverEdit}>
              <h4 style={{ marginTop: 0 }}>Edit Driver</h4>
              <div className="grid-2">
                <div className="field">
                  <label>Driver Name</label>
                  <input value={driverEditForm.name} onChange={(e) => setDriverEditForm({ ...driverEditForm, name: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Mobile Number</label>
                  <input value={driverEditForm.mobileNumber} onChange={(e) => setDriverEditForm({ ...driverEditForm, mobileNumber: e.target.value })} required />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Joining Date</label>
                  <input type="date" value={driverEditForm.joiningDate} onChange={(e) => setDriverEditForm({ ...driverEditForm, joiningDate: e.target.value })} />
                </div>
                <div className="field">
                  <label>Resigning Date</label>
                  <input type="date" value={driverEditForm.resigningDate} onChange={(e) => setDriverEditForm({ ...driverEditForm, resigningDate: e.target.value })} />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Login Username</label>
                  <input value={driverEditForm.username} onChange={(e) => setDriverEditForm({ ...driverEditForm, username: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Login Password</label>
                  <input type="password" value={driverEditForm.password} onChange={(e) => setDriverEditForm({ ...driverEditForm, password: e.target.value })} placeholder="Leave blank to keep current password" />
                </div>
              </div>
              <div className="field">
                <label>Assigned Vehicle</label>
                <select value={driverEditForm.vehicleId} onChange={(e) => setDriverEditForm({ ...driverEditForm, vehicleId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {data?.vehicles?.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.vehicleNumber}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Basic Salary</label>
                  <input type="number" min="0" step="0.01" value={driverEditForm.basicSalary} onChange={(e) => setDriverEditForm({ ...driverEditForm, basicSalary: e.target.value })} required />
                </div>
                <div className="field">
                  <label>KM Charges</label>
                  <input type="number" min="0" step="0.01" value={driverEditForm.kmCharges} onChange={(e) => setDriverEditForm({ ...driverEditForm, kmCharges: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Less than 200KM Charges</label>
                  <input type="number" min="0" step="0.01" value={driverEditForm.minKmCharges} onChange={(e) => setDriverEditForm({ ...driverEditForm, minKmCharges: e.target.value })} />
                </div>
              </div>
              {driverEditError && <div className="error-text">{driverEditError}</div>}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button className="btn" disabled={driverEditSaving} type="submit">
                  {driverEditSaving ? 'Saving...' : 'Save Driver'}
                </button>
                <button type="button" className="btn secondary" onClick={() => {
                  setDriverEditId('');
                    setDriverEditForm({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '' });
                  setDriverEditError('');
                }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {showAddDriverModal && (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-driver-title">
              <div className="card modal-panel" style={{ width: '100%', maxWidth: 760, margin: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h3 id="add-driver-title" className="section-title" style={{ marginTop: 0 }}>Add Driver and Link Vehicle</h3>
                  <button type="button" className="btn secondary" onClick={() => setShowAddDriverModal(false)}>Close</button>
                </div>
                <form onSubmit={addDriver}>
              <div className="grid-2">
                <div className="field">
                  <label>Driver Name</label>
                  <input value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Mobile Number</label>
                  <input value={driverForm.mobileNumber} onChange={(e) => setDriverForm({ ...driverForm, mobileNumber: e.target.value })} required />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Joining Date</label>
                  <input type="date" value={driverForm.joiningDate} onChange={(e) => setDriverForm({ ...driverForm, joiningDate: e.target.value })} />
                </div>
                <div className="field">
                  <label>Resigning Date</label>
                  <input type="date" value={driverForm.resigningDate} onChange={(e) => setDriverForm({ ...driverForm, resigningDate: e.target.value })} />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Login Username</label>
                  <input
                    name="driver-username"
                    autoComplete="off"
                    value={driverForm.username}
                    onChange={(e) => setDriverForm({ ...driverForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>Login Password</label>
                  <input
                    name="driver-password"
                    type="password"
                    autoComplete="new-password"
                    value={driverForm.password}
                    onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label>Link to Vehicle (optional)</label>
                <select value={driverForm.vehicleId} onChange={(e) => setDriverForm({ ...driverForm, vehicleId: e.target.value })}>
                  <option value="">Select Vehicle</option>
                  {data?.vehicles?.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.vehicleNumber}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'end' }}>
                <div className="field">
                  <label>Basic Salary</label>
                  <input type="number" min="0" step="0.01" value={driverForm.basicSalary} onChange={(e) => setDriverForm({ ...driverForm, basicSalary: e.target.value })} />
                </div>
                <div className="field">
                  <label>KM Charges</label>
                  <input type="number" min="0" step="0.01" value={driverForm.kmCharges} onChange={(e) => setDriverForm({ ...driverForm, kmCharges: e.target.value })} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input type="number" min="0" step="0.01" value={driverForm.minKmCharges} onChange={(e) => setDriverForm({ ...driverForm, minKmCharges: e.target.value })} />
                  Less than 200KM Charges
                </label>
              </div>
              {driverError && <div className="error-text">{driverError}</div>}
              <button className="btn" disabled={driverSaving}>
                {driverSaving ? 'Adding...' : 'Add Driver'}
              </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

    </Layout>
  );
}