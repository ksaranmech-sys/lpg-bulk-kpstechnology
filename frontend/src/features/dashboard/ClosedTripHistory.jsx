import React from 'react';
import { Link } from 'react-router-dom';
import { formatTripRoute, formatMonthLabel, groupTripsByMonth } from '@kps/shared';
import * as api from '../../api/api';
import { useVehicleTrips } from './useVehicleTrips';

export default function ClosedTripHistory({ selectedVehicleId }) {
  const {
    closedTripsLoading, showArchivedTrips, setShowArchivedTrips, openTrips, archivedTrips, visibleClosedTrips,
  } = useVehicleTrips(selectedVehicleId);

  return (
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
  );
}
