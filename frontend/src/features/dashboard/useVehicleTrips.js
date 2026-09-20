import { useEffect, useState } from 'react';
import { tripHistoryMonthKey, isCurrentOrPreviousMonth } from '@kps/shared';
import * as api from '../../api/api';

export function useVehicleTrips(selectedVehicleId) {
  const [closedTrips, setClosedTrips] = useState([]);
  const [closedTripsLoading, setClosedTripsLoading] = useState(false);
  const [showArchivedTrips, setShowArchivedTrips] = useState(false);

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

  // Include pending_close trips here too - they must stay visible to the driver/admin
  // even before the customer admin confirms/closes them via the salary calculation screen.
  const openTrips = closedTrips.filter((trip) => trip.status !== 'closed');
  const closedTripHistory = closedTrips.filter((trip) => trip.status === 'closed');
  const archivedTrips = closedTripHistory.filter((trip) => !isCurrentOrPreviousMonth(tripHistoryMonthKey(trip)));
  const visibleClosedTrips = showArchivedTrips
    ? closedTripHistory
    : closedTripHistory.filter((trip) => isCurrentOrPreviousMonth(tripHistoryMonthKey(trip)));
  const visibleTripHistory = [...openTrips, ...visibleClosedTrips];

  return {
    setClosedTrips,
    closedTripsLoading,
    showArchivedTrips,
    setShowArchivedTrips,
    openTrips,
    archivedTrips,
    visibleClosedTrips,
    visibleTripHistory,
  };
}
