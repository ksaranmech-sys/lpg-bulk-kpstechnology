import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTripRoute, formatMonthLabel, groupTripsByMonth } from '@kps/shared';
import * as api from '../../api/api';
import { useVehicleTrips } from './useVehicleTrips';

export default function OpenTripsCard({ loading, vehicles, selectedVehicleId, setSelectedVehicleId }) {
  const [deletingTripId, setDeletingTripId] = useState('');
  const [tripHistoryError, setTripHistoryError] = useState('');
  const {
    setClosedTrips, closedTripsLoading, showArchivedTrips, setShowArchivedTrips, archivedTrips, visibleTripHistory,
  } = useVehicleTrips(selectedVehicleId);

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

  return (
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
  );
}
