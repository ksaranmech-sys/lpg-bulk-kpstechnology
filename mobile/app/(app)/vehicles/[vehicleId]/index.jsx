import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { formatDate } from '@kps/shared';
import { api, errorMessage } from '../../../../src/api';
import { Badge, Button, Card, ErrorText, Loading, Muted, Screen } from '../../../../src/ui';
import { colors, spacing } from '../../../../src/theme';
import { reminderCounts } from '../../../../src/features/reminders/ReminderSummary';

// Trip list for one vehicle (admin view).
export default function VehicleTripsScreen() {
  const { vehicleId } = useLocalSearchParams();
  const router = useRouter();
  const [vehicle, setVehicle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([api.getVehicle(vehicleId), api.listTripsForVehicle(vehicleId)])
      .then(([vehicleRes, tripsRes]) => {
        if (!active) return;
        setVehicle(vehicleRes.data.vehicle);
        setTrips(tripsRes.data.trips || []);
      })
      .catch((err) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [vehicleId]));

  if (loading) return <Loading />;
  const counts = reminderCounts(vehicle?.documentReminders);

  return (
    <Screen>
      <Card>
        <Text style={styles.vehicleNumber}>{vehicle?.vehicleNumber || 'Vehicle'}</Text>
        <Muted>
          {vehicle?.customerName ? `${vehicle.customerName} \u00b7 ` : ''}
          Driver: {vehicle?.driverName || 'Not assigned'}
        </Muted>
        {vehicle && (
          <Button
            title={`Reminder / Expiry Dates (${counts.remaining} remaining, ${counts.expired} expired)`}
            variant="secondary"
            onPress={() => router.push(`/vehicles/${vehicleId}/reminders`)}
            style={{ marginTop: spacing.md }}
          />
        )}
      </Card>
      <ErrorText>{error}</ErrorText>
      <Card title={`Trips (${trips.length})`}>
        {trips.length === 0 ? <Muted>No trips yet.</Muted> : null}
        {trips.map((trip) => (
          <Pressable key={trip._id} onPress={() => router.push(`/trips/${trip._id}`)} style={styles.tripRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripTitle}>
                {trip.loadingLocation || 'Loading pending'} → {trip.unloadingLocation || 'Unloading pending'}
              </Text>
              <Muted>{formatDate(trip.loadingDate || trip.createdAt)}</Muted>
            </View>
            <Badge status={trip.status} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  vehicleNumber: { fontSize: 22, fontWeight: '800', color: colors.green900, marginBottom: 4 },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tripTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 2 },
});
