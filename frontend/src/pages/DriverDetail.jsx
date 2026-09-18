import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

function getReminderDayStatus(date) {
  if (!date) return 'Remaining days: 0 | Expired days: 0';
  const expiry = new Date(date);
  const today = new Date();
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  return days < 0
    ? `Remaining days: 0 | Expired days: ${Math.abs(days)}`
    : `Remaining days: ${days} | Expired days: 0`;
}

function ReminderSummary({ reminders }) {
  const dates = Object.values(reminders || {}).map((reminder) => reminder.expiryDate).filter(Boolean);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayTotals = dates.reduce((totals, date) => {
    const expiry = new Date(date);
    expiry.setHours(0, 0, 0, 0);
    const days = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    if (days < 0) return { ...totals, expired: totals.expired + Math.abs(days) };
    return { ...totals, remaining: totals.remaining + days };
  }, { remaining: 0, expired: 0 });
  return (
    <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
      Remaining days: {dayTotals.remaining} | Expired days: {dayTotals.expired}
    </p>
  );
}

function formatTripRoute(trip) {
  const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN') : 'Date pending';
  return `${trip.loadingLocation || 'Loading pending'} (${formatDate(trip.loadingDate)}) -> ${trip.unloadingLocation || 'Unloading pending'} (${formatDate(trip.unloadingDate)})`;
}

function previousMonth() {
  const today = new Date();
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function isCurrentOrPreviousMonth(monthKey) {
  return monthKey === currentMonth() || monthKey === previousMonth();
}

function groupClosedTripsByCloseMonth(trips) {
  const groups = new Map();
  trips
    .filter((trip) => trip.status === 'closed')
    .forEach((trip) => {
      const closeDate = trip.turnDate || trip.closedAt;
      const date = new Date(closeDate);
      if (Number.isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups.has(monthKey)) groups.set(monthKey, []);
      groups.get(monthKey).push({ trip, closeDate });
    });

  return Array.from(groups.entries())
    .sort(([leftMonth], [rightMonth]) => (leftMonth < rightMonth ? 1 : -1))
    .map(([monthKey, monthTrips]) => ({
      monthKey,
      monthTrips: monthTrips.sort((left, right) => new Date(right.closeDate) - new Date(left.closeDate)),
    }));
}

function formatMonthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function DriverDetail() {
  const { user } = useAuth();
  const { customerId, driverId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reminderDates, setReminderDates] = useState({});
  const [reminderDirty, setReminderDirty] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState(previousMonth);
  const [salary, setSalary] = useState(null);
  const [showArchivedSalary, setShowArchivedSalary] = useState(false);
  const [archivedSalaryMonth, setArchivedSalaryMonth] = useState(previousMonth);
  const [summaryPrinting, setSummaryPrinting] = useState(false);
  const [closingTripId, setClosingTripId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [showArchivedTrips, setShowArchivedTrips] = useState(false);
  const [driverLeaves, setDriverLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [showArchivedLeaves, setShowArchivedLeaves] = useState(false);

  useEffect(() => {
    if (!['super_admin', 'customer_admin'].includes(user?.role)) return;
    api
      .getCustomer(customerId)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load driver'));
  }, [customerId, user]);

  const driver = data?.users?.find((entry) => String(entry.id || entry._id) === String(driverId));
  const vehicle = data?.vehicles?.find((entry) => String(entry._id) === String(driver?.vehicle));
  const openTrips = trips.filter((trip) => trip.status !== 'closed');
  const closedTrips = trips.filter((trip) => trip.status === 'closed');
  const archivedTrips = closedTrips.filter((trip) => {
    const closeDate = trip.turnDate || trip.closedAt;
    const date = new Date(closeDate);
    if (Number.isNaN(date.getTime())) return true;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return !isCurrentOrPreviousMonth(monthKey);
  });
  const visibleClosedTrips = showArchivedTrips
    ? closedTrips
    : closedTrips.filter((trip) => !archivedTrips.includes(trip));
  const closedTripGroups = groupClosedTripsByCloseMonth(visibleClosedTrips);
  const archivedLeaves = driverLeaves.filter((leave) => {
    const date = new Date(leave.startDate);
    if (Number.isNaN(date.getTime())) return true;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return !isCurrentOrPreviousMonth(monthKey);
  });
  const visibleLeaves = showArchivedLeaves
    ? driverLeaves
    : driverLeaves.filter((leave) => !archivedLeaves.includes(leave));

  function loadSalary() {
    if (!driver) return;
    api
      .getDriverMonthlySalary(customerId, driverId, salaryMonth)
      .then((res) => setSalary(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load salary calculation'));
  }

  useEffect(loadSalary, [customerId, driver, driverId, salaryMonth]);

  async function closeTripFromSalary(tripId) {
    if (!window.confirm('Mark this trip as closed for salary purposes?')) return;
    setError('');
    setClosingTripId(tripId);
    try {
      await api.closeTrip(tripId);
      loadSalary();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to close trip');
    } finally {
      setClosingTripId(null);
    }
  }

  useEffect(() => {
    if (!driver) return;
    setLeavesLoading(true);
    api
      .listLeaves(customerId)
      .then((res) => {
        const leaves = (res.data.leaves || []).filter((leave) => (
          String(leave.driver?._id || leave.driver?.id || leave.driver) === String(driverId)
        ));
        setDriverLeaves(leaves);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load leave details'))
      .finally(() => setLeavesLoading(false));
  }, [customerId, driver, driverId]);

  useEffect(() => {
    if (!vehicle) return;
    setReminderDates(Object.fromEntries(
      Object.entries(vehicle.documentReminders || {}).map(([key, reminder]) => [
        key,
        reminder.expiryDate ? new Date(reminder.expiryDate).toISOString().slice(0, 10) : '',
      ])
    ));
    setReminderDirty(false);
  }, [vehicle]);

  useEffect(() => {
    if (!vehicle) {
      setTrips([]);
      setShowArchivedTrips(false);
      setShowArchivedLeaves(false);
      return;
    }
    setShowArchivedTrips(false);
    setShowArchivedLeaves(false);
    setTripsLoading(true);
    api
      .listTripsForVehicle(vehicle._id)
      .then((res) => setTrips(res.data.trips || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load driver trips'))
      .finally(() => setTripsLoading(false));
  }, [vehicle]);

  if (!['super_admin', 'customer_admin'].includes(user?.role)) {
    return <Layout><p>You do not have access to this page.</p></Layout>;
  }

  if (error) {
    return (
      <Layout>
        <Link to="/">&larr; Back to dashboard</Link>
        <p className="error-text">{error}</p>
      </Layout>
    );
  }

  async function saveReminderDates(event) {
    event.preventDefault();
    if (!vehicle) return;
    setReminderSaving(true);
    setError('');
    try {
      const res = await api.updateVehicleReminderDates(vehicle._id, {
        documentReminders: Object.fromEntries(
          Object.entries(reminderDates).map(([key, value]) => [key, { expiryDate: value || null }])
        ),
      });
      setData((current) => ({
        ...current,
        vehicles: current.vehicles.map((entry) => (
          String(entry._id) === String(vehicle._id) ? res.data.vehicle : entry
        )),
      }));
      setReminderDirty(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save reminder dates');
    } finally {
      setReminderSaving(false);
    }
  }

  // With responseType: 'blob', a JSON error response also arrives as a Blob - axios never
  // parses it, so err.response.data.error is always undefined unless we decode it ourselves.
  async function extractBlobErrorMessage(err, fallback) {
    const data = err.response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text());
        return parsed.error || fallback;
      } catch {
        return fallback;
      }
    }
    return err.response?.data?.error || fallback;
  }

  async function printMonthlySummary(month = salaryMonth) {
    const printWindow = window.open('', '_blank');
    setSummaryPrinting(true);
    try {
      const res = await api.downloadDriverMonthlySummary(customerId, driverId, month);
      const url = URL.createObjectURL(res.data);
      if (printWindow) printWindow.location.href = url;
      else window.location.href = url;
    } catch (err) {
      printWindow?.close();
      setError(await extractBlobErrorMessage(err, 'Failed to generate monthly summary'));
    } finally {
      setSummaryPrinting(false);
    }
  }

  return (
    <Layout>
      <Link to="/">&larr; Back to dashboard</Link>
      {!data ? <p>Loading driver...</p> : !driver ? (
        <p className="error-text">Driver not found.</p>
      ) : (
        <>
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
              <div><strong>User Name:</strong> {driver.name || 'Unnamed driver'}</div>
              <div><strong>Mobile Number:</strong> {driver.mobileNumber || 'No phone'}</div>
              <div><strong>Vehicle:</strong> {vehicle?.vehicleNumber || 'Unassigned'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <div><strong>Basic Salary:</strong> {driver.basicSalary ?? 0}</div>
              <div><strong>KM Charges:</strong> {driver.kmCharges ?? 0}</div>
              <div><strong>Less than 200KM Charges:</strong> {driver.minKmCharges ?? 0}</div>
            </div>
          </div>
          <div className="card" style={{ marginTop: 24 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Trip History</h3>
            {tripsLoading ? <p>Loading trips...</p> : (
              <div className="grid-2">
                <div>
                  <h4 className="section-title">Open Trips ({openTrips.length})</h4>
                  {openTrips.length === 0 ? (
                    <p style={{ color: '#666' }}>No open trips.</p>
                  ) : openTrips.map((trip) => (
                    <Link key={trip._id} to={`/trips/${trip._id}`} className="list-item" style={{ display: 'block' }}>
                      <strong>{trip.loadingLocation || 'Loading pending'}</strong> &rarr; {trip.unloadingLocation || 'Unloading pending'}
                      <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                        {trip.status === 'pending_close' ? 'Pending customer close' : 'Open'}
                        {trip.createdAt ? ` • ${new Date(trip.createdAt).toLocaleDateString('en-IN')}` : ''}
                      </div>
                    </Link>
                  ))}
                </div>
                <div>
                  <h4 className="section-title">Closed Trips ({visibleClosedTrips.length})</h4>
                  {visibleClosedTrips.length === 0 ? (
                    <p style={{ color: '#666' }}>No closed trips.</p>
                  ) : closedTripGroups.map(({ monthKey, monthTrips }) => (
                    <div key={monthKey} style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, color: '#4a5f52', fontSize: 13, margin: '8px 0' }}>
                        {formatMonthLabel(monthKey)}
                      </div>
                      {monthTrips.map(({ trip, closeDate }) => (
                        <div key={trip._id} className="list-item" style={{ display: 'flex', gap: 12 }}>
                          <Link to={`/trips/${trip._id}`} style={{ display: 'block', flex: 1, minWidth: 0 }}>
                            <strong>{formatTripRoute(trip)}</strong>
                            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                              Trip close: {new Date(closeDate).toLocaleDateString('en-IN')}
                            </div>
                          </Link>
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
                      {showArchivedTrips ? 'Hide archived trips' : `View archived trips (${archivedTrips.length})`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="card" style={{ marginTop: 24 }}>
            <h3 className="section-title" style={{ marginTop: 0 }}>Leave Details</h3>
            {leavesLoading ? <p>Loading leave details...</p> : visibleLeaves.length === 0 ? (
              <p style={{ margin: 0, color: '#666' }}>No leave entries found.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {visibleLeaves.map((leave) => (
                  <div key={leave._id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <strong>
                        {new Date(leave.startDate).toLocaleDateString('en-IN')} - {new Date(leave.endDate).toLocaleDateString('en-IN')}
                      </strong>
                      <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>{leave.reason || 'No reason provided'}</div>
                    </div>
                  </div>
                ))}
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
          </div>
          <div className="card" style={{ marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div><strong>Customer:</strong> {data.customer?.companyName || '-'}</div>
              <div><strong>Driver:</strong> {driver.name || driver.username || '-'}</div>
              <div style={{ textAlign: 'center' }}><strong>Vehicle:</strong> {vehicle?.vehicleNumber || '-'}</div>
              <div style={{ textAlign: 'right' }}><strong>Month:</strong> {formatMonthLabel(salaryMonth)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Salary Calculation</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  aria-label="Salary month"
                  type="month"
                  value={salaryMonth}
                  onChange={(event) => setSalaryMonth(event.target.value)}
                  style={{ maxWidth: 170 }}
                />
              </div>
            </div>
            {!salary ? <p style={{ margin: 0 }}>Loading salary calculation...</p> : (
              <>
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '5%', textAlign: 'right', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>S.No</th>
                        <th style={{ width: '15%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Loading Location</th>
                        <th style={{ width: '12%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Loading Date</th>
                        <th style={{ width: '15%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Unloading Location</th>
                        <th style={{ width: '12%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Unloading Date</th>
                        <th style={{ width: '15%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Divert Location</th>
                        <th style={{ width: '12%', textAlign: 'left', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Divert Date</th>
                        <th style={{ width: '10%', textAlign: 'right', padding: '8px 8px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Driver KM</th>
                        <th style={{ width: '12%', textAlign: 'right', padding: '8px 8px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Trip Diesel</th>
                        <th style={{ width: '12%', textAlign: 'right', padding: '8px 8px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Trip Advance</th>
                        <th style={{ width: '12%', textAlign: 'right', padding: '8px 8px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Trip Expense</th>
                        <th style={{ width: '15%', textAlign: 'right', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Trip balance</th>
                        <th style={{ width: '8%', textAlign: 'center', padding: '8px 10px', verticalAlign: 'middle', border: '1px solid #d0d7de' }}>Closed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(salary.trips || []).length === 0 ? (
                        <tr><td colSpan="13" style={{ padding: '8px 12px', color: '#666', border: '1px solid #d0d7de' }}>No trips for this month.</td></tr>
                      ) : (salary.trips || []).map((trip, index) => (
                        <tr key={trip._id || index}>
                          <td style={{ textAlign: 'right', padding: '8px 12px', border: '1px solid #d0d7de' }}>{index + 1}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.loadingLocation || '-'}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.loadingDate ? new Date(trip.loadingDate).toLocaleDateString('en-IN') : '-'}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.unloadingLocation || '-'}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.unloadingDate ? new Date(trip.unloadingDate).toLocaleDateString('en-IN') : '-'}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.isDiverted ? trip.divertUnloadingLocation || '-' : '-'}</td>
                          <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}>{trip.isDiverted && trip.divertDate ? new Date(trip.divertDate).toLocaleDateString('en-IN') : '-'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>{trip.corporationKm != null ? `${Math.round(trip.corporationKm)} km` : '-'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>Rs {trip.dieselTotal ?? 0}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>Rs {trip.advanceTotal ?? 0}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>Rs {trip.expenseTotal ?? 0}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #d0d7de' }}>Rs {trip.balance ?? 0}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', border: '1px solid #d0d7de' }}>
                            <input
                              type="checkbox"
                              checked={trip.status === 'closed'}
                              disabled={trip.status === 'closed' || closingTripId === trip._id}
                              title={trip.status === 'closed' ? 'Trip already closed' : 'Mark this trip as closed'}
                              onChange={() => closeTripFromSalary(trip._id)}
                            />
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, border: '1px solid #d0d7de' }}>Total</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, border: '1px solid #d0d7de' }}>Rs {salary.totalDiesel}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, border: '1px solid #d0d7de' }}>Rs {salary.totalAdvance}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, border: '1px solid #d0d7de' }}>Rs {salary.totalExpense}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, border: '1px solid #d0d7de' }}>Rs {salary.totalBalance}</td>
                        <td style={{ padding: '8px 12px', border: '1px solid #d0d7de' }}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <table className="salary-summary">
                  <tbody>
                    <tr>
                      <td>
                        Basic salary (Payable days: {salary.payableDays}, Leaves taken: {salary.unpaidLeaveDays})
                      </td>
                      <td>Rs {Math.round(salary.basicSalary || 0)}</td>
                    </tr>
                    <tr><td>Total Driver KM = Driver KM + Manual KM ({salary.closedTrips} closed trips)</td><td>{Math.round((salary.corporationKm || 0) + (salary.manualKmTotal || 0))} km</td></tr>
                    <tr><td>KM Beta (Total Driver KM {Math.round(salary.kmCharges || 0)})</td><td>Rs {Math.round(salary.kmBeta || 0)}</td></tr>
                    <tr><td>Total Advance ({salary.closedTrips} trips)</td><td>Rs {Math.round(salary.totalAdvance || 0)}</td></tr>
                    {Number(salary.specialTripCharges || 0) > 0 && (
                      <tr><td>Special Trip Charges ({salary.specialTripCount || 0} trips x Rs 1000)</td><td>Rs {Math.round(salary.specialTripCharges || 0)}</td></tr>
                    )}
                    <tr><td><strong>Trip balance</strong></td><td><strong>Rs {Math.round(salary.salaryBalance || 0)}</strong></td></tr>
                  </tbody>
                </table>
              </>
            )}
          </div>
          <div className="salary-archive-footer">
            <button
              type="button"
              className="salary-archive-link"
              onClick={() => {
                setShowArchivedSalary((current) => {
                  return !current;
                });
              }}
            >
              {showArchivedSalary ? 'Hide archived Salary PDF' : 'View archived Salary PDF'}
            </button>
          </div>
          {showArchivedSalary && (
            <div className="card" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label htmlFor="archived-salary-month" style={{ margin: 0 }}>Archive month</label>
              <input
                id="archived-salary-month"
                aria-label="Archived salary month"
                type="month"
                value={archivedSalaryMonth}
                onChange={(event) => setArchivedSalaryMonth(event.target.value)}
                style={{ maxWidth: 170 }}
              />
              <button type="button" className="btn" onClick={() => printMonthlySummary(archivedSalaryMonth)} disabled={!archivedSalaryMonth || summaryPrinting}>
                {summaryPrinting ? 'Preparing...' : 'Print archived Salary PDF'}
              </button>
            </div>
          )}
          {vehicle && (
            <div className="card" style={{ marginTop: 24 }}>
              <h3 className="section-title" style={{ marginTop: 0 }}>Reminder / Expiry Dates</h3>
              <ReminderSummary reminders={vehicle.documentReminders} />
              <form className="reminder-form" onSubmit={saveReminderDates}>
                <div style={{ display: 'grid', gap: 8 }}>
                  {Object.entries(vehicle.documentReminders || {}).map(([key, reminder]) => (
                    <div key={key} className="list-item" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 0, background: isExpired(reminder.expiryDate) ? '#ffe5e5' : expiresWithin30Days(reminder.expiryDate) ? '#fff4bf' : undefined }}>
                      <strong>{reminder.label || key}</strong>
                      <input
                        type="date"
                        value={reminderDates[key] || ''}
                        onChange={(event) => {
                          setReminderDates((current) => ({ ...current, [key]: event.target.value }));
                          setReminderDirty(true);
                        }}
                      />
                      <span style={{ color: isExpired(reminder.expiryDate) ? '#b42318' : '#4a5f52' }}>
                        {getReminderDayStatus(reminder.expiryDate)}
                      </span>
                    </div>
                  ))}
                </div>
                {reminderDirty && (
                  <button className="btn" type="submit" disabled={reminderSaving} style={{ marginTop: 12 }}>
                    {reminderSaving ? 'Saving...' : 'Save Reminder Dates'}
                  </button>
                )}
              </form>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
