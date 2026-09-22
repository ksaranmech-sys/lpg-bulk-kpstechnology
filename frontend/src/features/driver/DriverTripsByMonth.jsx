import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTripRoute, isCurrentOrPreviousMonth, formatMonthLabel, tripHistoryMonthKey } from '@kps/shared';
import * as api from '../../api/api';

// Closed trips grouped by history month (close date or later entry date), newest first.
function groupClosedTripsByCloseMonth(trips) {
  const groups = new Map();
  trips
    .filter((trip) => trip.status === 'closed')
    .forEach((trip) => {
      const closeDate = trip.turnDate || trip.closedAt;
      const key = tripHistoryMonthKey(trip);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ trip, closeDate });
    });

  return Array.from(groups.entries())
    .sort(([leftMonth], [rightMonth]) => (leftMonth < rightMonth ? 1 : -1))
    .map(([key, monthTrips]) => ({
      monthKey: key,
      monthTrips: monthTrips.sort((left, right) => new Date(right.closeDate) - new Date(left.closeDate)),
    }));
}

export default function DriverTripsByMonth({ vehicle, setError, setShowArchivedLeaves }) {
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [showArchivedTrips, setShowArchivedTrips] = useState(false);

  const openTrips = trips.filter((trip) => trip.status !== 'closed');
  const closedTrips = trips.filter((trip) => trip.status === 'closed');
  const archivedTrips = closedTrips.filter((trip) => {
    const key = tripHistoryMonthKey(trip);
    return !key || !isCurrentOrPreviousMonth(key);
  });
  const visibleClosedTrips = showArchivedTrips
    ? closedTrips
    : closedTrips.filter((trip) => !archivedTrips.includes(trip));
  const closedTripGroups = groupClosedTripsByCloseMonth(visibleClosedTrips);

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
  }, [vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
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
  );
}
