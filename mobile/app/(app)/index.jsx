import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatDate, isAdmin, ROLES } from '@kps/shared';
import { useAuth } from '../../src/AuthContext';
import { api, errorMessage } from '../../src/api';
import { Badge, Button, Card, ErrorText, Loading, Muted, Screen } from '../../src/ui';
import { colors, spacing } from '../../src/theme';

function TripRow({ trip, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.tripRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.tripTitle}>
          {trip.loadingLocation || 'Loading pending'} → {trip.unloadingLocation || 'Unloading pending'}
        </Text>
        <Muted>{formatDate(trip.loadingDate || trip.createdAt)}</Muted>
      </View>
      <Badge status={trip.status} />
    </Pressable>
  );
}

// Driver home: their vehicle, the open trip (if any) and recent history.
function DriverHome({ user }) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.listVehicles();
      const mine = res.data.vehicles?.[0] || null;
      setVehicle(mine);
      if (mine) {
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
    setStarting(true);
    setError('');
    try {
      const res = await api.createTrip(vehicle._id, {});
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

  return (
    <Screen>
      <Card title="My Vehicle">
        {vehicle ? (
          <>
            <Text style={styles.vehicleNumber}>{vehicle.vehicleNumber}</Text>
            <Muted>{user.displayName || user.name || user.username}{user.mobileNumber ? ` · ${user.mobileNumber}` : ''}</Muted>
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
            <Button title="Start Trip" onPress={startTrip} loading={starting} disabled={!vehicle} />
          </>
        )}
      </Card>

      <Card title="Recent Trips">
        {otherTrips.length === 0 ? <Muted>No previous trips.</Muted> : null}
        {otherTrips.map((trip) => (
          <TripRow key={trip._id} trip={trip} onPress={() => router.push(`/trips/${trip._id}`)} />
        ))}
      </Card>
    </Screen>
  );
}

// Admin home (customer_admin / super_admin): vehicles they can see, each opening its trip list.
// Full admin features (customers, drivers, salary, leaves) arrive in the next update.
function AdminHome({ user }) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    api.listVehicles()
      .then((res) => { if (active) setVehicles(res.data.vehicles || []); })
      .catch((err) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  if (loading) return <Loading />;

  return (
    <Screen>
      <Card title={user.role === ROLES.SUPER_ADMIN ? 'All Vehicles' : 'Your Vehicles'}>
        <ErrorText>{error}</ErrorText>
        {vehicles.length === 0 ? <Muted>No vehicles found.</Muted> : null}
        {vehicles.map((vehicle) => (
          <Pressable key={vehicle._id} onPress={() => router.push(`/vehicles/${vehicle._id}`)} style={styles.tripRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripTitle}>{vehicle.vehicleNumber}</Text>
              <Muted>
                {vehicle.customerName ? `${vehicle.customerName} · ` : ''}
                Driver: {vehicle.driverName || 'Not assigned'}
              </Muted>
            </View>
            <Text style={{ color: colors.muted }}>›</Text>
          </Pressable>
        ))}
      </Card>
      <Muted style={{ textAlign: 'center' }}>
        Customer, driver, salary and leave management are available on the website for now.
      </Muted>
    </Screen>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  if (!user) return null;
  return isAdmin(user) ? <AdminHome user={user} /> : <DriverHome user={user} />;
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
