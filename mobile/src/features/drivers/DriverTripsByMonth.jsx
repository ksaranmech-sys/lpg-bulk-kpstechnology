import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, formatMonthLabel, formatTripRoute, isCurrentOrPreviousMonth, tripHistoryMonthKey } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, Loading, Muted, NavRow } from '../../ui';
import { SectionTitle } from '../../trip/common';
import { spacing } from '../../theme';

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
    .sort(([left], [right]) => (left < right ? 1 : -1))
    .map(([key, monthTrips]) => ({
      monthKey: key,
      monthTrips: monthTrips.sort((left, right) => new Date(right.closeDate) - new Date(left.closeDate)),
    }));
}

export default function DriverTripsByMonth({ vehicle, setError }) {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [showArchivedTrips, setShowArchivedTrips] = useState(false);

  const openTrips = trips.filter((trip) => trip.status !== 'closed');
  const closedTrips = trips.filter((trip) => trip.status === 'closed');
  const archivedTrips = closedTrips.filter((trip) => {
    const key = tripHistoryMonthKey(trip);
    return !key || !isCurrentOrPreviousMonth(key);
  });
  const visibleClosedTrips = showArchivedTrips ? closedTrips : closedTrips.filter((trip) => !archivedTrips.includes(trip));
  const closedTripGroups = groupClosedTripsByCloseMonth(visibleClosedTrips);

  useEffect(() => {
    let active = true;
    setShowArchivedTrips(false);
    if (!vehicle) { setTrips([]); return undefined; }
    setTripsLoading(true);
    api.listTripsForVehicle(vehicle._id)
      .then((res) => { if (active) setTrips(res.data.trips || []); })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load driver trips')); })
      .finally(() => { if (active) setTripsLoading(false); });
    return () => { active = false; };
  }, [vehicle?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card title="Trip History">
      {tripsLoading ? <Loading text="Loading trips..." /> : (
        <>
          <SectionTitle>Open Trips ({openTrips.length})</SectionTitle>
          {openTrips.length === 0 ? <Muted style={{ marginBottom: spacing.md }}>No open trips.</Muted> : openTrips.map((trip) => (
            <NavRow
              key={trip._id}
              title={`${trip.loadingLocation || 'Loading pending'} \u2192 ${trip.unloadingLocation || 'Unloading pending'}`}
              subtitle={`${trip.status === 'pending_close' ? 'Pending customer close' : 'Open'}${trip.createdAt ? ` \u2022 ${formatDate(trip.createdAt)}` : ''}`}
              onPress={() => router.push(`/trips/${trip._id}`)}
            />
          ))}
          <View style={{ marginTop: spacing.md }}>
            <SectionTitle>Closed Trips ({visibleClosedTrips.length})</SectionTitle>
          </View>
          {visibleClosedTrips.length === 0 ? <Muted>No closed trips.</Muted> : closedTripGroups.map(({ monthKey, monthTrips }) => (
            <View key={monthKey} style={{ marginBottom: spacing.md }}>
              <Muted style={{ fontWeight: '700', marginVertical: spacing.sm }}>{formatMonthLabel(monthKey)}</Muted>
              {monthTrips.map(({ trip, closeDate }) => (
                <NavRow
                  key={trip._id}
                  title={formatTripRoute(trip)}
                  subtitle={`Trip close: ${formatDate(closeDate)}`}
                  onPress={() => router.push(`/trips/${trip._id}`)}
                />
              ))}
            </View>
          ))}
          {archivedTrips.length > 0 && (
            <Button
              title={showArchivedTrips ? 'Hide archived trips' : `View archived trips (${archivedTrips.length})`}
              variant="secondary"
              onPress={() => setShowArchivedTrips((current) => !current)}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </>
      )}
    </Card>
  );
}
