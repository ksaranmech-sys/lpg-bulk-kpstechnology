import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  formatDate,
  formatMonthLabel,
  formatTripRoute,
  isTripDeletableWithinDays,
  tripHistoryDate,
  tripHistoryMonthKey,
} from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, Loading, Muted } from '../../ui';
import { SectionTitle } from '../../trip/common';
import { colors, spacing } from '../../theme';
import { confirm } from '../../confirm';

// Closed trips grouped by the salary-calculation month, newest first.
function groupClosedTripsBySalaryMonth(trips) {
  const groups = new Map();
  trips
    .filter((trip) => trip.status === 'closed')
    .forEach((trip) => {
      const key = tripHistoryMonthKey(trip);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ trip, salaryDate: tripHistoryDate(trip) });
    });
  return Array.from(groups.entries())
    .sort(([left], [right]) => (left < right ? 1 : -1))
    .map(([key, monthTrips]) => ({
      monthKey: key,
      monthTrips: monthTrips.sort((left, right) => right.salaryDate - left.salaryDate),
    }));
}

export default function DriverTripsByMonth({ vehicle, setError, title = 'Trip History' }) {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState('');

  const closedTrips = trips.filter((trip) => trip.status === 'closed');
  const closedTripGroups = groupClosedTripsBySalaryMonth(closedTrips);

  async function deleteTrip(trip) {
    if (!isTripDeletableWithinDays(trip)) return;
    if (!(await confirm('Delete this trip history entry?'))) return;
    setDeletingTripId(trip._id);
    setError('');
    try {
      await api.deleteTrip(trip._id);
      setTrips((current) => current.filter((entry) => entry._id !== trip._id));
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete trip history'));
    } finally {
      setDeletingTripId('');
    }
  }

  useEffect(() => {
    let active = true;
    if (!vehicle) { setTrips([]); return undefined; }
    setTripsLoading(true);
    api.listTripsForVehicle(vehicle._id)
      .then((res) => { if (active) setTrips(res.data.trips || []); })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load driver trips')); })
      .finally(() => { if (active) setTripsLoading(false); });
    return () => { active = false; };
  }, [vehicle?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card title={title}>
      {tripsLoading ? <Loading text="Loading trips..." /> : (
        <>
          <View style={{ marginTop: spacing.md }}>
            <SectionTitle>Closed Trips ({closedTrips.length})</SectionTitle>
          </View>
          {closedTrips.length === 0 ? <Muted>No closed trips.</Muted> : closedTripGroups.map(({ monthKey, monthTrips }) => (
            <View key={monthKey} style={{ marginBottom: spacing.md }}>
              <Muted style={{ fontWeight: '700', marginVertical: spacing.sm }}>{formatMonthLabel(monthKey)} (Salary Month)</Muted>
              {monthTrips.map(({ trip, salaryDate }) => (
                <View
                  key={trip._id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: 1,
                    borderColor: '#e5ecef',
                  }}
                >
                  <Pressable
                    onPress={() => router.push(`/trips/${trip._id}`)}
                    style={{ flex: 1, paddingVertical: spacing.md, paddingRight: spacing.sm }}
                  >
                    <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>
                      {formatTripRoute(trip)}
                    </Text>
                    <Muted>{`Trip close: ${formatDate(salaryDate)}`}</Muted>
                  </Pressable>
                  {isTripDeletableWithinDays(trip) ? (
                    <Button
                      title={deletingTripId === trip._id ? 'Deleting...' : 'Delete'}
                      variant="danger"
                      disabled={deletingTripId === trip._id}
                      onPress={() => deleteTrip(trip)}
                      style={{ minHeight: 36, paddingVertical: 6, paddingHorizontal: 10 }}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </Card>
  );
}
