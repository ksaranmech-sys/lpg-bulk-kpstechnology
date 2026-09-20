import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function expiresWithin30Days(date) {
  if (!date) return false;
  const expiry = new Date(date);
  const today = new Date();
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return days >= 0 && days <= 30;
}

function isExpired(date) {
  if (!date) return false;
  const expiry = new Date(date);
  const today = new Date();
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return expiry < today;
}

function getExpiringWithin7Days(reminders) {
  return Object.entries(reminders || {}).filter(([, reminder]) => {
    if (!reminder.expiryDate) return false;
    const expiry = new Date(reminder.expiryDate);
    const today = new Date();
    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return days <= 7;
  });
}

function getReminderPopupStatus(date) {
  if (isExpired(date)) return 'Expired';
  const expiry = new Date(date);
  const today = new Date();
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return `${days} day(s) remaining`;
}

function ReminderSummary({ reminders }) {
  const dates = Object.values(reminders || {}).map((reminder) => reminder.expiryDate).filter(Boolean);
  const expired = dates.filter(isExpired).length;
  return (
    <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
      Remaining dates: {dates.length - expired} | Expired dates: {expired}
    </p>
  );
}

function getReminderStatusText(date) {
  if (!date) return 'Not set';
  if (isExpired(date)) return 'Expired';
  const expiry = new Date(date);
  const today = new Date();
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return `${days} day(s) remaining`;
}

function formatTripRoute(trip) {
  const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN') : 'Date pending';
  return `${trip.loadingLocation || 'Loading pending'} (${formatDate(trip.loadingDate)}) -> ${trip.unloadingLocation || 'Unloading pending'} (${formatDate(trip.unloadingDate)})`;
}

function completedMonth() {
  const today = new Date();
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

// Salary for a month can be calculated from the 5th of the following month.
function latestCalculableMonth() {
  const today = new Date();
  const monthsBack = today.getDate() >= 5 ? 1 : 2;
  const latest = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
  return `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function groupTripsByMonth(trips) {
  const groups = new Map();
  trips.forEach((trip) => {
    const date = new Date(trip.turnDate || trip.closedAt || trip.loadingDate || trip.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(monthKey)) groups.set(monthKey, []);
    groups.get(monthKey).push(trip);
  });
  return Array.from(groups.entries())
    .sort(([leftMonth], [rightMonth]) => (leftMonth < rightMonth ? 1 : -1))
    .map(([monthKey, monthTrips]) => ({ monthKey, monthTrips }));
}

function tripHistoryDate(trip) {
  return new Date(trip.turnDate || trip.closedAt || trip.loadingDate || trip.createdAt);
}

function tripHistoryMonthKey(trip) {
  const date = tripHistoryDate(trip);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isCurrentOrPreviousMonth(monthKey) {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  return monthKey === currentMonth || monthKey === completedMonth();
}

function isLeaveInCurrentOrPreviousMonth(leave) {
  const date = new Date(leave.startDate);
  if (Number.isNaN(date.getTime())) return false;
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return isCurrentOrPreviousMonth(monthKey);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState('');
  const [reminderDates, setReminderDates] = useState({});
  const [reminderDirty, setReminderDirty] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const [customerActionId, setCustomerActionId] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [customerEditMode, setCustomerEditMode] = useState(false);
  const [customerDrafts, setCustomerDrafts] = useState({});
  const [customerSaving, setCustomerSaving] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [closedTrips, setClosedTrips] = useState([]);
  const [closedTripsLoading, setClosedTripsLoading] = useState(false);
  const [showArchivedTrips, setShowArchivedTrips] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState('');
  const [tripHistoryError, setTripHistoryError] = useState('');
  const [expiringReminders, setExpiringReminders] = useState([]);
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const [customerData, setCustomerData] = useState(null);
  const [routeKmTable, setRouteKmTable] = useState([]);
  const [routeKmForm, setRouteKmForm] = useState({ loadingLocation: '', corporation: '', unloadingLocation: '', km: '' });
  const [routeKmError, setRouteKmError] = useState('');
  const [routeKmSaving, setRouteKmSaving] = useState(false);
  const [routeKmHasChanges, setRouteKmHasChanges] = useState(false);
  const [selectedRouteKmRows, setSelectedRouteKmRows] = useState([]);
  const [routeKmEditMode, setRouteKmEditMode] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '', temporaryDriverRequired: false, temporaryDriverName: '', temporaryDriverJoiningDate: '', temporaryDriverReturningDate: '' });
  const [driverError, setDriverError] = useState('');
  const [driverSaving, setDriverSaving] = useState(false);
  const [driverEditId, setDriverEditId] = useState('');
  const [driverEditForm, setDriverEditForm] = useState({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '', temporaryDriverRequired: false, temporaryDriverName: '', temporaryDriverJoiningDate: '', temporaryDriverReturningDate: '' });
  const [driverEditError, setDriverEditError] = useState('');
  const [driverEditSaving, setDriverEditSaving] = useState(false);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [showAddDriverForm, setShowAddDriverForm] = useState(false);
  const [driverSalaries, setDriverSalaries] = useState({});
  const [driverSalariesLoading, setDriverSalariesLoading] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState(latestCalculableMonth);
  const [showArchivedSalary, setShowArchivedSalary] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveForm, setLeaveForm] = useState({ driverId: '', startDate: '', endDate: '', reason: '' });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveEditId, setLeaveEditId] = useState('');
  const [leaveEditForm, setLeaveEditForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [leaveEditSaving, setLeaveEditSaving] = useState(false);
  const [showArchivedLeaves, setShowArchivedLeaves] = useState(false);
  const [selectedLeaves, setSelectedLeaves] = useState([]);
  const [showAddLeaveForm, setShowAddLeaveForm] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .listVehicles(
        user?.role === 'super_admin' && selectedCustomerId && selectedCustomerId !== 'all'
          ? selectedCustomerId
          : undefined
      )
      .then((res) => {
        const nextVehicles = res.data.vehicles || [];
        setVehicles(nextVehicles);
        setSelectedVehicleId((currentVehicleId) => {
          if (user?.role === 'vehicle_user') {
            return nextVehicles[0]?._id || '';
          }
          return currentVehicleId && !nextVehicles.some((vehicle) => vehicle._id === currentVehicleId)
            ? ''
            : currentVehicleId;
        });
      })
      .finally(() => setLoading(false));
  }, [selectedCustomerId, user]);

  useEffect(() => {
    if (!['vehicle_user', 'customer_admin'].includes(user?.role) || !vehicles.length) {
      setExpiringReminders([]);
      setShowReminderPopup(false);
      return;
    }
    const entries = vehicles.flatMap((vehicle) => (
      getExpiringWithin7Days(vehicle.documentReminders).map(([key, reminder]) => ({
        key: `${vehicle._id}-${key}`,
        label: reminder.label || key,
        date: reminder.expiryDate,
        vehicleNumber: vehicle.vehicleNumber,
      }))
    ));
    setExpiringReminders(entries);
    setShowReminderPopup(entries.length > 0);
  }, [user, vehicles]);

  // Seed the editable reminder date inputs from the driver's vehicle.
  const reminderVehicle = user?.role === 'vehicle_user' ? vehicles[0] : null;
  useEffect(() => {
    if (!reminderVehicle) return;
    setReminderDates(Object.fromEntries(
      Object.entries(reminderVehicle.documentReminders || {}).map(([key, reminder]) => [
        key,
        reminder.expiryDate ? new Date(reminder.expiryDate).toISOString().slice(0, 10) : '',
      ])
    ));
    setReminderDirty(false);
  }, [reminderVehicle?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveReminderDates(e) {
    e.preventDefault();
    if (!reminderVehicle) return;
    setReminderSaving(true);
    setReminderMessage('');
    try {
      const res = await api.updateVehicleReminderDates(reminderVehicle._id, {
        documentReminders: Object.fromEntries(
          Object.entries(reminderDates).map(([key, value]) => [key, { expiryDate: value || null }])
        ),
      });
      setVehicles((current) => current.map((v) => (String(v._id) === String(reminderVehicle._id) ? res.data.vehicle : v)));
      setReminderDirty(false);
      setReminderMessage('Reminder dates saved.');
    } catch (err) {
      setReminderMessage(err.response?.data?.error || 'Failed to save reminder dates');
    } finally {
      setReminderSaving(false);
    }
  }

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

  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    setCustomersLoading(true);
    api
      .listCustomers()
      .then((res) => {
        setCustomers(res.data.customers);
        setSelectedCustomers([]);
        setCustomerEditMode(false);
        setCustomerDrafts({});
      })
      .catch((err) => setCustomersError(err.response?.data?.error || 'Failed to load customers'))
      .finally(() => setCustomersLoading(false));
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'customer_admin' || !user.customer) {
      setCustomerData(null);
      return;
    }

    api
      .getCustomer(user.customer)
      .then((res) => setCustomerData(res.data))
      .catch(() => setCustomerData(null));
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      setRouteKmTable([]);
      return;
    }

    api
      .getMeta()
      .then((res) => {
        setRouteKmTable(res.data.routeKmTable || []);
        setRouteKmHasChanges(false);
      })
      .catch(() => {
        setRouteKmTable([]);
        setRouteKmHasChanges(false);
      });
  }, [user]);

  async function toggleCustomerStatus(customer) {
    setCustomersError('');
    setCustomerActionId(customer._id);
    try {
      const res = await api.setCustomerStatus(customer._id, !customer.isActive);
      setCustomers((current) => current.map((item) => (
        item._id === customer._id ? res.data.customer : item
      )));
    } catch (err) {
      setCustomersError(err.response?.data?.error || 'Failed to update customer status');
    } finally {
      setCustomerActionId(null);
    }
  }

  function editSelectedCustomers() {
    if (!selectedCustomers.length) return;
    setCustomerDrafts(Object.fromEntries(
      customers
        .filter((customer) => selectedCustomers.includes(customer._id))
        .map((customer) => [customer._id, {
          companyName: customer.companyName || '',
          email: customer.email || '',
          mobileNumber: customer.mobileNumber || '',
        }])
    ));
    setCustomerEditMode(true);
  }

  async function saveCustomerChanges() {
    if (!selectedCustomers.length) return;
    setCustomersError('');
    setCustomerSaving(true);
    try {
      const updatedCustomers = await Promise.all(selectedCustomers.map(async (customerId) => {
        const res = await api.updateCustomer(customerId, customerDrafts[customerId]);
        return res.data.customer;
      }));
      const updatedById = Object.fromEntries(updatedCustomers.map((customer) => [customer._id, customer]));
      setCustomers((current) => current.map((customer) => updatedById[customer._id] || customer));
      setSelectedCustomers([]);
      setCustomerDrafts({});
      setCustomerEditMode(false);
    } catch (err) {
      setCustomersError(err.response?.data?.error || 'Failed to save customer changes');
    } finally {
      setCustomerSaving(false);
    }
  }

  async function deleteSelectedCustomers() {
    if (!selectedCustomers.length) return;
    if (!window.confirm(`Delete ${selectedCustomers.length} selected customer(s)? This will also delete their users, vehicles, and trips.`)) return;
    setCustomersError('');
    setCustomerActionId('bulk');
    try {
      await Promise.all(selectedCustomers.map((customerId) => api.deleteCustomer(customerId)));
      setCustomers((current) => current.filter((customer) => !selectedCustomers.includes(customer._id)));
      setSelectedCustomers([]);
      setCustomerDrafts({});
      setCustomerEditMode(false);
    } catch (err) {
      setCustomersError(err.response?.data?.error || 'Failed to delete selected customers');
    } finally {
      setCustomerActionId(null);
    }
  }

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

  async function saveRouteKmTable() {
    setRouteKmError('');
    setRouteKmSaving(true);
    try {
      const nextTable = routeKmTable
        .filter((row) => row.loadingLocation || row.unloadingLocation || row.corporation || row.km !== '')
        .map((row) => ({
          ...row,
          loadingLocation: String(row.loadingLocation || '').trim(),
          corporation: String(row.corporation || '').trim(),
          unloadingLocation: String(row.unloadingLocation || '').trim(),
          km: Number(row.km),
        }));
      const res = await api.updateRouteKmTable(nextTable);
      setRouteKmTable(res.data.routeKmTable || []);
      setRouteKmHasChanges(false);
      setSelectedRouteKmRows([]);
      setRouteKmEditMode(false);
    } catch (err) {
      setRouteKmError(err.response?.data?.error || 'Failed to save route table');
    } finally {
      setRouteKmSaving(false);
    }
  }

  function addRouteKmRow() {
    if (!routeKmForm.loadingLocation || !routeKmForm.unloadingLocation || !routeKmForm.corporation || routeKmForm.km === '') return;

    setRouteKmTable((current) => [
      ...current,
      {
        id: `row-${Date.now()}`,
        loadingLocation: routeKmForm.loadingLocation.trim(),
        corporation: routeKmForm.corporation.trim(),
        unloadingLocation: routeKmForm.unloadingLocation.trim(),
        km: Number(routeKmForm.km),
      },
    ]);

    setRouteKmForm({ loadingLocation: '', corporation: '', unloadingLocation: '', km: '' });
    setRouteKmHasChanges(true);
  }

  function deleteSelectedRouteKmRows() {
    if (!selectedRouteKmRows.length) return;
    setRouteKmTable((current) => current.filter((row) => {
      const rowId = row.id || `${row.loadingLocation}-${row.unloadingLocation}`;
      return !selectedRouteKmRows.includes(rowId);
    }));
    setSelectedRouteKmRows([]);
    setRouteKmEditMode(false);
    setRouteKmHasChanges(true);
  }

  function updateRouteKmRow(rowId, field, value) {
    setRouteKmTable((current) => current.map((row) => (
      (row.id || `${row.loadingLocation}-${row.unloadingLocation}`) === rowId ? { ...row, [field]: field === 'km' ? Number(value) : value } : row
    )));
    setRouteKmHasChanges(true);
  }

  const driverUsers = customerData?.users?.filter((item) => item.role === 'vehicle_user' && item.isActive !== false) || [];
  const customerVehicles = customerData?.vehicles || vehicles;

  useEffect(() => {
    if (!['customer_admin', 'vehicle_user'].includes(user?.role)) {
      setLeaves([]);
      return;
    }
    setLeavesLoading(true);
    api
      .listLeaves(user.role === 'customer_admin' ? user.customer : undefined)
      .then((res) => setLeaves(res.data.leaves || []))
      .catch((err) => setLeaveError(err.response?.data?.error || 'Failed to load leave entries'))
      .finally(() => setLeavesLoading(false));
  }, [user]);

  async function addLeave(event) {
    event.preventDefault();
    setLeaveError('');
    setLeaveSaving(true);
    try {
      const res = await api.createLeave(leaveForm);
      setLeaves((current) => [res.data.leave, ...current]);
      setLeaveForm({ driverId: '', startDate: '', endDate: '', reason: '' });
      setShowAddLeaveForm(false);
    } catch (err) {
      setLeaveError(err.response?.data?.error || 'Failed to add leave entry');
    } finally {
      setLeaveSaving(false);
    }
  }

  async function removeLeave(leaveId) {
    if (!window.confirm('Delete this leave entry?')) return;
    setLeaveError('');
    try {
      await api.deleteLeave(leaveId);
      setLeaves((current) => current.filter((leave) => leave._id !== leaveId));
    } catch (err) {
      setLeaveError(err.response?.data?.error || 'Failed to delete leave entry');
    }
  }

  function startEditLeave(leave) {
    setLeaveEditId(leave._id);
    setLeaveEditForm({
      startDate: new Date(leave.startDate).toISOString().slice(0, 10),
      endDate: leave.endDate ? new Date(leave.endDate).toISOString().slice(0, 10) : '',
      reason: leave.reason || '',
    });
    setLeaveError('');
  }

  function cancelEditLeave() {
    setLeaveEditId('');
    setLeaveEditForm({ startDate: '', endDate: '', reason: '' });
  }

  async function saveLeaveEdit(event) {
    event.preventDefault();
    if (!leaveEditId) return;
    setLeaveError('');
    setLeaveEditSaving(true);
    try {
      const res = await api.updateLeave(leaveEditId, leaveEditForm);
      setLeaves((current) => current.map((leave) => (leave._id === leaveEditId ? res.data.leave : leave)));
      cancelEditLeave();
    } catch (err) {
      setLeaveError(err.response?.data?.error || 'Failed to update leave entry');
    } finally {
      setLeaveEditSaving(false);
    }
  }

  function editSelectedLeave() {
    if (selectedLeaves.length !== 1) return;
    const leave = leaves.find((entry) => entry._id === selectedLeaves[0]);
    if (leave) startEditLeave(leave);
  }

  async function deleteSelectedLeave() {
    if (selectedLeaves.length !== 1) return;
    await removeLeave(selectedLeaves[0]);
    setSelectedLeaves([]);
  }

  useEffect(() => {
    if (user?.role !== 'customer_admin' || !user.customer || driverUsers.length === 0) {
      setDriverSalaries({});
      return;
    }
    setDriverSalariesLoading(true);
    Promise.all(driverUsers.map((driver) => (
      api.getDriverMonthlySalary(user.customer, driver.id || driver._id, salaryMonth)
        .then((res) => [driver.id || driver._id, res.data])
        .catch(() => [driver.id || driver._id, null])
    )))
      .then((entries) => setDriverSalaries(Object.fromEntries(entries)))
      .finally(() => setDriverSalariesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, driverUsers.length, salaryMonth]);

  // Include pending_close trips here too - they must stay visible to the driver/admin
  // even before the customer admin confirms/closes them via the salary calculation screen.
  const openTrips = closedTrips.filter((trip) => trip.status !== 'closed');
  const closedTripHistory = closedTrips.filter((trip) => trip.status === 'closed');
  const archivedTrips = closedTripHistory.filter((trip) => !isCurrentOrPreviousMonth(tripHistoryMonthKey(trip)));
  const visibleClosedTrips = showArchivedTrips
    ? closedTripHistory
    : closedTripHistory.filter((trip) => isCurrentOrPreviousMonth(tripHistoryMonthKey(trip)));
  const visibleTripHistory = [...openTrips, ...visibleClosedTrips];
  const archivedLeaves = leaves.filter((leave) => !isLeaveInCurrentOrPreviousMonth(leave));
  const visibleLeaves = showArchivedLeaves ? leaves : leaves.filter(isLeaveInCurrentOrPreviousMonth);

  return (
    <Layout>
      {showReminderPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, margin: 0 }}>
            <h3 style={{ marginTop: 0 }}>Reminder: Expiry Dates</h3>
            <p style={{ color: '#555' }}>The following vehicle documents are expired or expire within 7 days:</p>
            <ul style={{ margin: '0 0 20px', paddingLeft: 18 }}>
              {expiringReminders.map(({ key, label, date, vehicleNumber }) => (
                <li key={key} style={{ marginBottom: 8 }}>
                  <strong>{vehicleNumber}</strong> - {label} - {new Date(date).toLocaleDateString('en-IN')} ({getReminderPopupStatus(date)})
                </li>
              ))}
            </ul>
            <button className="btn" type="button" onClick={() => setShowReminderPopup(false)}>Close</button>
          </div>
        </div>
      )}
      {user?.role === 'super_admin' && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>KM Table</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center', padding: '8px 12px' }}>Select</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Loading Location</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Unloading Location</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Corporation</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>KM</th>
                  </tr>
                </thead>
                <tbody>
                  {routeKmTable.map((row) => {
                    const routeRowId = row.id || `${row.loadingLocation}-${row.unloadingLocation}`;
                    return (
                      <tr key={routeRowId}>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedRouteKmRows.includes(routeRowId)}
                            onChange={() => setSelectedRouteKmRows((current) => (
                              current.includes(routeRowId)
                                ? current.filter((id) => id !== routeRowId)
                                : [...current, routeRowId]
                            ))}
                            aria-label={`Select route ${row.loadingLocation} to ${row.unloadingLocation}`}
                            style={{ width: 'auto' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            value={row.loadingLocation}
                            onChange={(e) => updateRouteKmRow(routeRowId, 'loadingLocation', e.target.value)}
                            placeholder="Loading location"
                            disabled={!routeKmEditMode || !selectedRouteKmRows.includes(routeRowId)}
                            style={{ width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            value={row.unloadingLocation}
                            onChange={(e) => updateRouteKmRow(routeRowId, 'unloadingLocation', e.target.value)}
                            placeholder="Unloading location"
                            disabled={!routeKmEditMode || !selectedRouteKmRows.includes(routeRowId)}
                            style={{ width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            value={row.corporation || ''}
                            onChange={(e) => updateRouteKmRow(routeRowId, 'corporation', e.target.value)}
                            disabled={!routeKmEditMode || !selectedRouteKmRows.includes(routeRowId)}
                            style={{ width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            min="0"
                            value={row.km}
                            onChange={(e) => updateRouteKmRow(routeRowId, 'km', e.target.value)}
                            disabled={!routeKmEditMode || !selectedRouteKmRows.includes(routeRowId)}
                            style={{ width: '100%' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={{ padding: '8px 12px' }} />
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        value={routeKmForm.loadingLocation}
                        onChange={(e) => setRouteKmForm({ ...routeKmForm, loadingLocation: e.target.value })}
                        placeholder="Loading location"
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        value={routeKmForm.unloadingLocation}
                        onChange={(e) => setRouteKmForm({ ...routeKmForm, unloadingLocation: e.target.value })}
                        placeholder="Unloading location"
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        value={routeKmForm.corporation}
                        onChange={(e) => setRouteKmForm({ ...routeKmForm, corporation: e.target.value })}
                        placeholder="Corporation"
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="number"
                        min="0"
                        value={routeKmForm.km}
                        onChange={(e) => setRouteKmForm({ ...routeKmForm, km: e.target.value })}
                        placeholder="KM"
                        style={{ width: '100%' }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {routeKmError && <p className="error-text" style={{ marginTop: 12 }}>{routeKmError}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
              <button type="button" className="btn secondary" onClick={addRouteKmRow}>
                Add route
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={!selectedRouteKmRows.length}
                  onClick={() => setRouteKmEditMode(true)}
                >
                  Edit selected
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={!selectedRouteKmRows.length}
                  onClick={deleteSelectedRouteKmRows}
                >
                  Delete selected
                </button>
                <button type="button" className="btn" disabled={!routeKmHasChanges || routeKmSaving} onClick={saveRouteKmTable}>
                  {routeKmSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>

          <div className="superadmin-customer-section">
            <h2 className="section-title">Customers ({customers.length})</h2>
            {customersLoading && <p>Loading customers...</p>}
            {customersError && <p className="error-text">{customersError}</p>}
            {!customersLoading && !customersError && customers.length === 0 && <p>No customers found yet.</p>}
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {customers.map((customer) => (
                <div key={customer._id} className="list-item">
                <input
                  type="checkbox"
                  checked={selectedCustomers.includes(customer._id)}
                  onChange={() => setSelectedCustomers((current) => (
                    current.includes(customer._id)
                      ? current.filter((id) => id !== customer._id)
                      : [...current, customer._id]
                  ))}
                  aria-label={`Select ${customer.companyName}`}
                  style={{ width: 'auto' }}
                />
              <div style={{ flex: 1, minWidth: 0 }}>
                {customerEditMode && selectedCustomers.includes(customer._id) ? (
                  <div className="grid-2" style={{ marginBottom: 8 }}>
                    <input
                      value={customerDrafts[customer._id]?.companyName || ''}
                      onChange={(event) => setCustomerDrafts((current) => ({
                        ...current,
                        [customer._id]: { ...current[customer._id], companyName: event.target.value },
                      }))}
                      aria-label="Company name"
                    />
                    <input
                      value={customerDrafts[customer._id]?.email || ''}
                      onChange={(event) => setCustomerDrafts((current) => ({
                        ...current,
                        [customer._id]: { ...current[customer._id], email: event.target.value },
                      }))}
                      aria-label="Customer email"
                    />
                    <input
                      value={customerDrafts[customer._id]?.mobileNumber || ''}
                      onChange={(event) => setCustomerDrafts((current) => ({
                        ...current,
                        [customer._id]: { ...current[customer._id], mobileNumber: event.target.value },
                      }))}
                      aria-label="Customer mobile number"
                    />
                  </div>
                ) : (
                  <>
                    <Link to={`/customers/${customer._id}`} style={{ color: 'var(--green-900)', fontWeight: 700 }}>
                      {customer.companyName}
                    </Link>
                    <div style={{ fontSize: 12, color: '#666' }}>{customer.email} | {customer.mobileNumber}</div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  className={`btn ${customer.isActive ? 'danger' : ''}`}
                  onClick={() => toggleCustomerStatus(customer)}
                  disabled={customerActionId === customer._id}
                >
                  {customerActionId === customer._id ? 'Updating...' : customer.isActive ? 'Block' : 'Unblock'}
                </button>
              </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button type="button" className="btn secondary" disabled={!selectedCustomers.length} onClick={editSelectedCustomers}>
                Edit selected
              </button>
              <button type="button" className="btn danger" disabled={!selectedCustomers.length || customerActionId === 'bulk'} onClick={deleteSelectedCustomers}>
                Delete selected
              </button>
              <button type="button" className="btn" disabled={!customerEditMode || customerSaving} onClick={saveCustomerChanges}>
                {customerSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </>
      )}
      {user?.role === 'customer_admin' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Trip History</h3>
          <h3 className="section-title" style={{ marginTop: 0 }}>Total Vehicles: {loading ? '...' : vehicles.length}</h3>
          <div className="field">
            <label htmlFor="closed-trip-vehicle">Select Vehicle</label>
            <select
              id="closed-trip-vehicle"
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
            >
              <option value="">select vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle._id} value={vehicle._id}>
                  {vehicle.vehicleNumber} | {vehicle.driverName || 'Not assigned'}
                </option>
              ))}
            </select>
          </div>

          {closedTripsLoading && <p>Loading closed trips...</p>}
          {!closedTripsLoading && !selectedVehicleId && <p>Select a vehicle to view trip history.</p>}
          {!closedTripsLoading && selectedVehicleId && visibleTripHistory.length === 0 && <p>No trip history found for this vehicle.</p>}
          {tripHistoryError && <p className="error-text">{tripHistoryError}</p>}

          {!closedTripsLoading && selectedVehicleId && visibleTripHistory.length > 0 && (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {groupTripsByMonth(visibleTripHistory).map(({ monthKey, monthTrips }) => (
                <div key={monthKey} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#4a5f52', fontSize: 13, margin: '8px 0' }}>{formatMonthLabel(monthKey)}</div>
                  {monthTrips.map((trip) => (
                    <div key={trip._id} className="list-item">
                      <Link to={`/trips/${trip._id}`} style={{ flex: 1, color: 'inherit', textDecoration: 'none' }}>
                        <strong>{formatTripRoute(trip)}</strong>
                      </Link>
                      <button type="button" className="btn danger" onClick={() => deleteTrip(trip._id)} disabled={deletingTripId === trip._id}>
                        {deletingTripId === trip._id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {!closedTripsLoading && selectedVehicleId && archivedTrips.length > 0 && (
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
      )}
      {user?.role === 'super_admin' && (
        <div className="superadmin-filter-section" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div className="field" style={{ maxWidth: 360, flex: 1 }}>
            <label htmlFor="customer-filter">Filter Vehicles by Customer</label>
            <select id="customer-filter" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
              <option value="">Select customer...</option>
              <option value="all">All vehicles</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>{customer.companyName}</option>
              ))}
            </select>
          </div>
          <div style={{ paddingBottom: 12, fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>
            Vehicles: {!selectedCustomerId ? '-' : loading ? '...' : vehicles.length}
          </div>
        </div>
      )}
      {user?.role === 'super_admin' && (
        <div className="card superadmin-vehicle-list" style={{ marginTop: 14 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Vehicles</h3>
          {!selectedCustomerId ? (
            <p style={{ margin: 0, color: '#666' }}>Select a customer to view vehicles.</p>
          ) : loading ? (
            <p style={{ margin: 0, color: '#666' }}>Loading vehicles...</p>
          ) : vehicles.length === 0 ? (
            <p style={{ margin: 0, color: '#666' }}>No vehicles found for the selected customer.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {vehicles.map((vehicle) => (
                <div key={vehicle._id} className="list-item" style={{ marginBottom: 0 }}>
                  <div>
                    <strong>{vehicle.vehicleNumber}</strong>
                    <div style={{ color: '#666', fontSize: 12 }}>
                      Driver: {vehicle.driverName || 'Not assigned'}
                      {vehicle.driverMobile ? ` | ${vehicle.driverMobile}` : ''}
                    </div>
                  </div>
                  <span className={`badge ${vehicle.driverName ? 'closed' : 'open'}`}>
                    {vehicle.driverName ? 'Assigned' : 'Unassigned'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {loading && <p>Loading...</p>}
      {!loading && vehicles.length === 0 && <p>No vehicles found for your account yet.</p>}
      {user?.role === 'vehicle_user' && vehicles[0] && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>User Account</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span><strong>Name:</strong> {user.name || 'Unnamed user'}</span>
            <span><strong>Mobile Number:</strong> {user.mobileNumber || 'No phone'}</span>
            <span><strong>Vehicle:</strong> {vehicles[0].vehicleNumber}</span>
          </div>
        </div>
      )}
      {user?.role === 'vehicle_user' && vehicles[0] && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Reminder / Expiry Dates</h3>
          <ReminderSummary reminders={vehicles[0].documentReminders} />
          <form className="reminder-form" onSubmit={saveReminderDates}>
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(vehicles[0].documentReminders || {}).map(([key, reminder]) => (
                <div key={key} className="list-item" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 0, alignItems: 'center', background: isExpired(reminder.expiryDate) ? '#ffe5e5' : expiresWithin30Days(reminder.expiryDate) ? '#fff4bf' : undefined }}>
                  <strong>{reminder.label || key}</strong>
                  <input
                    type="date"
                    value={reminderDates[key] || ''}
                    onChange={(event) => {
                      setReminderDates((current) => ({ ...current, [key]: event.target.value }));
                      setReminderDirty(true);
                      setReminderMessage('');
                    }}
                  />
                  <span style={{ color: isExpired(reminder.expiryDate) ? '#b42318' : '#4a5f52' }}>
                    {getReminderStatusText(reminder.expiryDate)}
                  </span>
                </div>
              ))}
            </div>
            {reminderMessage && <p style={{ margin: '10px 0 0', color: reminderMessage.includes('saved') ? '#1a7f4b' : '#b42318', fontSize: 13 }}>{reminderMessage}</p>}
            {reminderDirty && (
              <button className="btn" type="submit" disabled={reminderSaving} style={{ marginTop: 12 }}>
                {reminderSaving ? 'Saving...' : 'Save Reminder Dates'}
              </button>
            )}
          </form>
        </div>
      )}
      {user?.role === 'vehicle_user' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Leave Entries</h3>
          {leaveError && <div className="error-text" style={{ marginBottom: 12 }}>{leaveError}</div>}
          {leavesLoading ? <p>Loading leave entries...</p> : visibleLeaves.length === 0 ? (
            <p>No leave entries found.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
              {visibleLeaves.map((leave) => (
                <div key={leave._id} className="list-item" style={{ display: 'block' }}>
                  {leaveEditId === leave._id ? (
                    <form onSubmit={saveLeaveEdit}>
                      <div className="grid-2">
                        <div className="field">
                          <label>Start Date</label>
                          <input type="date" value={leaveEditForm.startDate} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, startDate: e.target.value })} required />
                        </div>
                        <div className="field">
                          <label>End Date</label>
                          <input type="date" value={leaveEditForm.endDate} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, endDate: e.target.value })} required />
                        </div>
                      </div>
                      <div className="field">
                        <label>Reason (optional)</label>
                        <input value={leaveEditForm.reason} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, reason: e.target.value })} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" disabled={leaveEditSaving} type="submit">
                          {leaveEditSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" className="btn secondary" onClick={cancelEditLeave}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <strong>{new Date(leave.startDate).toLocaleDateString('en-IN')} - {leave.endDate ? new Date(leave.endDate).toLocaleDateString('en-IN') : '-'}</strong>
                        <div style={{ fontSize: 12, color: '#666' }}>{leave.reason || 'No reason provided'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button type="button" className="btn secondary" onClick={() => startEditLeave(leave)}>Edit</button>
                        <button type="button" className="btn danger" onClick={() => removeLeave(leave._id)}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {archivedLeaves.length > 0 && (
            <button
              type="button"
              className="btn secondary"
              style={{ marginBottom: 20 }}
              onClick={() => setShowArchivedLeaves((current) => !current)}
            >
              {showArchivedLeaves ? 'Hide archived leaves' : `View archived leaves (${archivedLeaves.length})`}
            </button>
          )}
          <form onSubmit={addLeave}>
            <div className="grid-2">
              <div className="field">
                <label>Start Date</label>
                <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required />
              </div>
              <div className="field">
                <label>End Date</label>
                <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required />
              </div>
            </div>
            <div className="field">
              <label>Reason (optional)</label>
              <input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
            </div>
            <button className="btn" disabled={leaveSaving} type="submit">
              {leaveSaving ? 'Saving...' : 'Add Leave'}
            </button>
          </form>
        </div>
      )}
      {user?.role === 'vehicle_user' && vehicles[0] && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Trip History</h3>
          {closedTripsLoading ? <p>Loading trips...</p> : (
            <div className="grid-2">
              <div>
                <h4 className="section-title">Open Trips ({openTrips.length})</h4>
                {openTrips.length === 0 ? (
                  <p style={{ color: '#666' }}>No open trips.</p>
                ) : openTrips.map((trip) => (
                  <div key={trip._id} className="list-item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Link to={`/trips/${trip._id}`} style={{ flex: 1, color: 'inherit', textDecoration: 'none' }}>
                      <strong>{formatTripRoute(trip)}</strong>
                      {trip.status === 'pending_close' && (
                        <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>Pending customer close</div>
                      )}
                    </Link>
                    <Link className="btn secondary" to={`/trips/${trip._id}`}>Edit</Link>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="section-title">Closed Trips ({visibleClosedTrips.length})</h4>
                {visibleClosedTrips.length === 0 ? (
                  <p style={{ color: '#666' }}>No closed trips.</p>
                ) : groupTripsByMonth(visibleClosedTrips).map(({ monthKey, monthTrips }) => (
                  <div key={monthKey} style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: '#4a5f52', fontSize: 13, margin: '8px 0' }}>{formatMonthLabel(monthKey)}</div>
                    {monthTrips.map((trip) => (
                      <div key={trip._id} className="list-item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Link to={`/trips/${trip._id}`} style={{ flex: 1, color: 'inherit', textDecoration: 'none' }}>
                          <strong>{formatTripRoute(trip)}</strong>
                        </Link>
                        <a className="btn secondary" href={api.reportDownloadUrl(trip._id)} target="_blank" rel="noreferrer">Print</a>
                      </div>
                    ))}
                  </div>
                ))}
                {archivedTrips.length > 0 && (
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
            </div>
          )}
        </div>
      )}
      {user?.role === 'customer_admin' && (
        <div className="card customer-admin-salary-section" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Salary Details ({formatMonthLabel(salaryMonth)})</h3>
          </div>
          <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
            Salary for a month is calculated from the 5th of the following month (latest available: {formatMonthLabel(latestCalculableMonth())}).
          </p>
          {driverUsers.length === 0 ? (
            <p>No drivers found.</p>
          ) : driverSalariesLoading ? (
            <p>Loading salary details...</p>
          ) : (
            <div style={{ display: 'grid', gap: 20 }}>
              {driverUsers.map((driver) => {
                const driverId = driver.id || driver._id;
                const salary = driverSalaries[driverId];
                const leavesTaken = leaves.reduce((totalDays, leave) => {
                  if (String(leave.driver?._id || leave.driver?.id || leave.driver) !== String(driverId)) return totalDays;
                  const startDate = new Date(leave.startDate);
                  const monthStart = new Date(`${salaryMonth}-01T00:00:00`);
                  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
                  // No endDate yet means the leave is still ongoing - treat it as open through month end.
                  const endDate = leave.endDate ? new Date(leave.endDate) : monthEnd;
                  if (startDate > monthEnd || endDate < monthStart) return totalDays;
                  const leaveStart = startDate > monthStart ? startDate : monthStart;
                  const leaveEnd = endDate < monthEnd ? endDate : monthEnd;
                  const days = Math.floor((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1;
                  return totalDays + Math.max(days, 0);
                }, 0);
                const vehicleNumber = customerData?.vehicles?.find((vehicle) => String(vehicle._id) === String(driver.vehicle))?.vehicleNumber || 'Unassigned';
                return (
                  <div key={driverId} style={{ overflowX: 'auto' }}>
                    <div className="salary-summary-block">
                      <div className="salary-summary-identity">
                        <div><strong>Customer Name:</strong> {customerData?.customer?.companyName || '-'}</div>
                        <div>
                          <strong>Driver Name:</strong>{' '}
                          <Link to={`/drivers/${user.customer}/${driverId}`}>{driver.displayName || driver.name || 'Unnamed driver'}</Link>
                        </div>
                        <div><strong>Vehicle Number:</strong> {vehicleNumber}</div>
                        <div><strong>Driver Mobile Number:</strong> {driver.mobileNumber || 'No phone'}</div>
                      </div>
                      <table className="salary-summary" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'right', padding: '8px 12px' }}>Basic Salary Payable</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px' }}>Corporation KM</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px' }}>KM Beta</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px' }}>Special Trip Charges</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px' }}>Balance</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px' }}>Salary Balance</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px' }}>Payable Days</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px' }}>Leaves Taken</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {!salary ? (
                            <td colSpan={8} style={{ padding: '8px 12px', color: '#666' }}>
                              Not available
                            </td>
                          ) : (
                            <>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs {Math.round(salary.basicSalary || 0)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{Math.round(salary.corporationKm || 0)} km</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs {Math.round(salary.kmBeta || 0)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs {Math.round(salary.specialTripCharges || 0)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs {Math.round(salary.totalBalance || 0)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Rs {Math.round(salary.salaryBalance || 0)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{salary.payableDays}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{leavesLoading ? '...' : leavesTaken}</td>
                            </>
                          )}
                        </tr>
                      </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="salary-archive-footer">
            <button
              type="button"
              className="salary-archive-link"
              onClick={() => setShowArchivedSalary((current) => !current)}
            >
              {showArchivedSalary ? 'Hide archived salary' : 'View archived salary'}
            </button>
            {showArchivedSalary && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="salary-month">Salary Month</label>
                <input
                  id="salary-month"
                  type="month"
                  value={salaryMonth}
                  max={latestCalculableMonth()}
                  onChange={(event) => setSalaryMonth(event.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      )}
      {user?.role === 'customer_admin' && (
        <div className="card customer-admin-leave-section" style={{ marginTop: 24 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Leave Entries</h3>
          {leaveError && <p className="error-text">{leaveError}</p>}
          {leavesLoading ? <p>Loading leave entries...</p> : visibleLeaves.length === 0 ? (
            <p>No leave entries found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: 'center', padding: '8px 12px' }}>Select</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Driver</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Start Date</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>End Date</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeaves.map((leave) => (
                    <tr key={leave._id}>
                      {leaveEditId === leave._id ? (
                        <td colSpan={6} style={{ padding: '8px 12px' }}>
                          <form onSubmit={saveLeaveEdit}>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label>Start Date</label>
                                <input type="date" value={leaveEditForm.startDate} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, startDate: e.target.value })} required />
                              </div>
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label>End Date</label>
                                <input type="date" value={leaveEditForm.endDate} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, endDate: e.target.value })} required />
                              </div>
                              <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                                <label>Reason (optional)</label>
                                <input value={leaveEditForm.reason} onChange={(e) => setLeaveEditForm({ ...leaveEditForm, reason: e.target.value })} />
                              </div>
                              <button className="btn" disabled={leaveEditSaving} type="submit">
                                {leaveEditSaving ? 'Saving...' : 'Save'}
                              </button>
                              <button type="button" className="btn secondary" onClick={cancelEditLeave}>Cancel</button>
                            </div>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedLeaves.includes(leave._id)}
                              onChange={() => setSelectedLeaves((current) => (
                                current.includes(leave._id)
                                  ? current.filter((id) => id !== leave._id)
                                  : [...current, leave._id]
                              ))}
                              aria-label="Select leave entry"
                              style={{ width: 'auto' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>{leave.driver?.name || leave.driver?.username || 'Unknown driver'}</td>
                          <td style={{ padding: '8px 12px' }}>{new Date(leave.startDate).toLocaleDateString('en-IN')}</td>
                          <td style={{ padding: '8px 12px' }}>{leave.endDate ? new Date(leave.endDate).toLocaleDateString('en-IN') : '-'}</td>
                          <td style={{ padding: '8px 12px' }}>{leave.reason || '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {archivedLeaves.length > 0 && (
            <button
              type="button"
              className="btn secondary"
              style={{ marginTop: 12 }}
              onClick={() => setShowArchivedLeaves((current) => !current)}
            >
              {showArchivedLeaves ? 'Hide archived leaves' : `View archived leaves (${archivedLeaves.length})`}
            </button>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => setShowAddLeaveForm((current) => !current)}>
              {showAddLeaveForm ? 'Close Add' : 'Add'}
            </button>
            <button type="button" className="btn secondary" disabled={selectedLeaves.length !== 1} onClick={editSelectedLeave}>
              Edit
            </button>
            <button type="button" className="btn danger" disabled={selectedLeaves.length !== 1} onClick={deleteSelectedLeave}>
              Delete
            </button>
          </div>
          {showAddLeaveForm && <form onSubmit={addLeave} style={{ marginTop: 20 }}>
            <h4 style={{ marginTop: 0 }}>Apply Leave</h4>
            <div className="grid-2">
              <div className="field">
                <label>Driver</label>
                <select value={leaveForm.driverId} onChange={(e) => setLeaveForm({ ...leaveForm, driverId: e.target.value })} required>
                  <option value="">Select driver...</option>
                  {driverUsers.map((driver) => (
                    <option key={driver.id || driver._id} value={driver.id || driver._id}>{driver.name || driver.username}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Reason (optional)</label>
                <input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Start Date</label>
                <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required />
              </div>
              <div className="field">
                <label>End Date</label>
                <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required />
              </div>
            </div>
            <button className="btn" disabled={leaveSaving} type="submit">
              {leaveSaving ? 'Saving...' : 'Apply Leave'}
            </button>
          </form>}
        </div>
      )}
      {user?.role === 'customer_admin' && (
        <div className="card customer-admin-driver-list" style={{ marginTop: 24 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Driver List</h3>
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
            <form onSubmit={saveDriverEdit} style={{ marginBottom: 24 }}>
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
                  <input autoComplete="off" value={driverEditForm.username} onChange={(e) => setDriverEditForm({ ...driverEditForm, username: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Login Password</label>
                  <input type="password" autoComplete="new-password" value={driverEditForm.password} onChange={(e) => setDriverEditForm({ ...driverEditForm, password: e.target.value })} placeholder="Leave blank to keep current password" />
                </div>
              </div>
              <div className="field">
                <label>Assigned Vehicle</label>
                <select value={driverEditForm.vehicleId} onChange={(e) => setDriverEditForm({ ...driverEditForm, vehicleId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.vehicleNumber}</option>)}
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
              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={driverEditForm.temporaryDriverRequired}
                    onChange={(e) => setDriverEditForm({ ...driverEditForm, temporaryDriverRequired: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  Temporary Driver
                </label>
              </div>
              {driverEditForm.temporaryDriverRequired && (
                <div className="grid-2">
                  <div className="field">
                    <label>Temporary Driver Name</label>
                    <input value={driverEditForm.temporaryDriverName} onChange={(e) => setDriverEditForm({ ...driverEditForm, temporaryDriverName: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Joining Date</label>
                    <input type="date" value={driverEditForm.temporaryDriverJoiningDate} onChange={(e) => setDriverEditForm({ ...driverEditForm, temporaryDriverJoiningDate: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Returning Date</label>
                    <input type="date" value={driverEditForm.temporaryDriverReturningDate} onChange={(e) => setDriverEditForm({ ...driverEditForm, temporaryDriverReturningDate: e.target.value })} min={driverEditForm.temporaryDriverJoiningDate || undefined} />
                  </div>
                </div>
              )}
              {driverEditError && <div className="error-text">{driverEditError}</div>}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button className="btn" disabled={driverEditSaving} type="submit">
                  {driverEditSaving ? 'Saving...' : 'Save Driver'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setDriverEditId('');
                    setDriverEditForm({ name: '', mobileNumber: '', joiningDate: '', resigningDate: '', username: '', password: '', vehicleId: '', basicSalary: '', kmCharges: '', minKmCharges: '', temporaryDriverRequired: false, temporaryDriverName: '', temporaryDriverJoiningDate: '', temporaryDriverReturningDate: '' });
                    setDriverEditError('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {showAddDriverForm && (
          <div style={{ marginTop: 24 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Add Driver and Link Vehicle</h3>
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
                    autoComplete="off"
                    value={driverForm.username}
                    onChange={(e) => setDriverForm({ ...driverForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label>Login Password</label>
                  <input
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
                  <option value="">Select vehicle...</option>
                  {vehicles.map((vehicle) => <option key={vehicle._id} value={vehicle._id}>{vehicle.vehicleNumber}</option>)}
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
                <div className="field">
                  <label>Less than 200KM Charges</label>
                  <input type="number" min="0" step="0.01" value={driverForm.minKmCharges} onChange={(e) => setDriverForm({ ...driverForm, minKmCharges: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={driverForm.temporaryDriverRequired}
                    onChange={(e) => setDriverForm({ ...driverForm, temporaryDriverRequired: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  Temporary Driver
                </label>
              </div>
              {driverForm.temporaryDriverRequired && (
                <div className="grid-2">
                  <div className="field">
                    <label>Temporary Driver Name</label>
                    <input value={driverForm.temporaryDriverName} onChange={(e) => setDriverForm({ ...driverForm, temporaryDriverName: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Joining Date</label>
                    <input type="date" value={driverForm.temporaryDriverJoiningDate} onChange={(e) => setDriverForm({ ...driverForm, temporaryDriverJoiningDate: e.target.value })} required />
                  </div>
                  <div className="field">
                    <label>Returning Date</label>
                    <input type="date" value={driverForm.temporaryDriverReturningDate} onChange={(e) => setDriverForm({ ...driverForm, temporaryDriverReturningDate: e.target.value })} min={driverForm.temporaryDriverJoiningDate || undefined} />
                  </div>
                </div>
              )}
              {driverError && <div className="error-text">{driverError}</div>}
              <button className="btn" disabled={driverSaving}>
                {driverSaving ? 'Adding...' : 'Add Driver'}
              </button>
            </form>
          </div>
          )}
        </div>
      )}
    </Layout>
  );
}
