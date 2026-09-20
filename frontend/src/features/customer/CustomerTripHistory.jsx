import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTripRoute, isArchivedTrip } from '@kps/shared';
import * as api from '../../api/api';

export default function CustomerTripHistory({ vehicles }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [closedTrips, setClosedTrips] = useState([]);
  const [closedTripsLoading, setClosedTripsLoading] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState('');
  const [tripHistoryError, setTripHistoryError] = useState('');
  const [showArchivedTrips, setShowArchivedTrips] = useState(false);
  const [selectedTripsToClose, setSelectedTripsToClose] = useState([]);
  const [closingSelectedTrips, setClosingSelectedTrips] = useState(false);

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
    setSelectedTripsToClose([]);
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

  // Trips only auto-close once the vehicle's next trip records its first diesel fill - if that
  // hasn't happened yet, they're stuck as pending_close and need a manual force-close here.
  async function closeSelectedTrips() {
    if (!selectedTripsToClose.length) return;
    setClosingSelectedTrips(true);
    setTripHistoryError('');
    try {
      await Promise.all(selectedTripsToClose.map((tripId) => api.closeTrip(tripId)));
      setClosedTrips((current) => current.map((trip) => (
        selectedTripsToClose.includes(trip._id) ? { ...trip, status: 'closed' } : trip
      )));
      setSelectedTripsToClose([]);
    } catch (err) {
      setTripHistoryError(err.response?.data?.error || 'Failed to close selected trips');
    } finally {
      setClosingSelectedTrips(false);
    }
  }

  const archivedTrips = closedTrips.filter(isArchivedTrip);
  const visibleClosedTrips = showArchivedTrips
    ? closedTrips
    : closedTrips.filter((trip) => !isArchivedTrip(trip));

  return (
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
          {vehicles?.map((vehicle) => (
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
      {!closedTripsLoading && selectedTripsToClose.length > 0 && (
        <button
          type="button"
          className="btn"
          style={{ marginTop: 12 }}
          onClick={closeSelectedTrips}
          disabled={closingSelectedTrips}
        >
          {closingSelectedTrips ? 'Closing...' : `Close ${selectedTripsToClose.length} selected trip(s)`}
        </button>
      )}
      {!closedTripsLoading && visibleClosedTrips.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {visibleClosedTrips.map((trip) => (
            <div key={trip._id} className="list-item">
              {trip.status === 'pending_close' && (
                <input
                  type="checkbox"
                  checked={selectedTripsToClose.includes(trip._id)}
                  onChange={() => setSelectedTripsToClose((current) => (
                    current.includes(trip._id)
                      ? current.filter((id) => id !== trip._id)
                      : [...current, trip._id]
                  ))}
                  aria-label="Select trip to close"
                  title="This trip did not close automatically - select it to force-close and settle it"
                  style={{ width: 'auto' }}
                />
              )}
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
  );
}
