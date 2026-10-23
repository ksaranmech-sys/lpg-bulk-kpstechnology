import React, { useCallback, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatDate } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Badge, Button, Card, ErrorText, Field, Input, Loading, Muted, NavRow, Screen } from '../../ui';
import { colors, spacing } from '../../theme';
import { reminderCounts, showReminderPopup } from '../reminders/ReminderSummary';

function TripRow({ trip, onPress }) {
  return (
    <NavRow
      onPress={onPress}
      title={`${trip.loadingLocation || 'Loading pending'} \u2192 ${trip.unloadingLocation || 'Unloading pending'}`}
      subtitle={formatDate(trip.loadingDate || trip.createdAt)}
      right={<Badge status={trip.status} />}
    />
  );
}

// Driver home: their vehicle, the open trip (if any), reminders, leaves and recent history.
export default function DriverHome({ user }) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showStartTripForm, setShowStartTripForm] = useState(false);
  const [startOdometerKm, setStartOdometerKm] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.listVehicles();
      const mine = res.data.vehicles?.[0] || null;
      setVehicle(mine);
      if (mine) {
        showReminderPopup([mine]);
        const tripsRes = await api.listTripsForVehicle(mine._id);
        setTrips(tripsRes.data.trips || []);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function startTrip() {
    if (!vehicle) return;
    const odometerKm = Number(startOdometerKm);
    if (startOdometerKm === '' || !Number.isFinite(odometerKm) || odometerKm < 0) {
      setError('Enter a valid odometer reading to start the trip.');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const res = await api.createTrip(vehicle._id, { startOdometerKm: odometerKm });
      setShowStartTripForm(false);
      if (res.data.message) Alert.alert('Note', res.data.message);
      router.push(`/trips/${res.data.trip._id}`);
    } catch (err) {
      setError(errorMessage(err, 'Unable to start a trip. Please try again.'));
    } finally {
      setStarting(false);
    }
  }

  if (loading) return <Loading />;

  const openTrip = trips.find((trip) => trip.status === 'open');
  const otherTrips = trips.filter((trip) => trip !== openTrip).slice(0, 10);
  const counts = reminderCounts(vehicle?.documentReminders);

  return (
    <Screen>
      <Card title="My Vehicle">
        {vehicle ? (
          <>
            <Text style={styles.vehicleNumber}>{vehicle.vehicleNumber}</Text>
            <Muted>{user.displayName || user.name || user.username}{user.mobileNumber ? ` \u00b7 ${user.mobileNumber}` : ''}</Muted>
          </>
        ) : (
          <Muted>No vehicle is assigned to your account yet. Ask your admin to link one.</Muted>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>

      <Card title="Current Trip">
        {openTrip ? (
          <>
            <TripRow trip={openTrip} onPress={() => router.push(`/trips/${openTrip._id}`)} />
            <Button title="Continue trip" onPress={() => router.push(`/trips/${openTrip._id}`)} style={{ marginTop: spacing.md }} />
          </>
        ) : (
          <>
            <Muted style={{ marginBottom: spacing.md }}>No trip in progress.</Muted>
            <Button
              title="Start Trip"
              onPress={() => {
                setError('');
                setStartOdometerKm(vehicle?.lastKnownOdometer == null ? '' : String(vehicle.lastKnownOdometer));
                setShowStartTripForm(true);
              }}
              disabled={!vehicle}
            />
          </>
        )}
      </Card>

      {vehicle && (
        <Card>
          <NavRow
            title="Reminder / Expiry Dates"
            subtitle={`Remaining dates: ${counts.remaining} | Expired dates: ${counts.expired}`}
            onPress={() => router.push(`/vehicles/${vehicle._id}/reminders`)}
          />
          <NavRow title="Leave Entries" subtitle="View, add or edit your leaves" onPress={() => router.push('/leaves')} />
        </Card>
      )}

      <Card title="Recent Trips">
        {otherTrips.length === 0 ? <Muted>No previous trips.</Muted> : null}
        {otherTrips.map((trip) => (
          <TripRow key={trip._id} trip={trip} onPress={() => router.push(`/trips/${trip._id}`)} />
        ))}
      </Card>
      <Modal
        transparent
        visible={showStartTripForm}
        animationType="fade"
        onRequestClose={() => setShowStartTripForm(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Muted style={{ fontSize: 18, fontWeight: '700', marginBottom: spacing.md }}>Start Trip</Muted>
            <Field label="Starting Odometer (km)">
              <Input
                value={startOdometerKm}
                onChangeText={(value) => setStartOdometerKm(value.replace(/\D/g, ''))}
                keyboardType="number-pad"
                autoFocus
              />
            </Field>
            <ErrorText>{error}</ErrorText>
            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowStartTripForm(false)} style={{ flex: 1 }} />
              <Button
                title="Confirm Start"
                onPress={startTrip}
                loading={starting}
                disabled={!startOdometerKm}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  vehicleNumber: { fontSize: 22, fontWeight: '800', color: colors.green900, marginBottom: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg },
  modalButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
