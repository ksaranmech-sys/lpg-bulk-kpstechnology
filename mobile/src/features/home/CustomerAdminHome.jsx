import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatTripRoute } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Badge, Card, ErrorText, Loading, Muted, NavRow, Screen } from '../../ui';
import { showReminderPopup } from '../reminders/ReminderSummary';

// Customer admin home: open-trip summary plus a menu into the management screens.
export default function CustomerAdminHome({ user }) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState([]);
  const [openTrips, setOpenTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      setError('');
      try {
        const res = await api.listVehicles();
        const nextVehicles = res.data.vehicles || [];
        if (!active) return;
        setVehicles(nextVehicles);
        showReminderPopup(nextVehicles);
        // Trips in progress (open or awaiting close) per vehicle; closed trips live under /vehicles/[id].
        const perVehicle = await Promise.all(nextVehicles.map((vehicle) => (
          api.listTripsForVehicle(vehicle._id)
            .then((tripsRes) => (tripsRes.data.trips || [])
              .filter((trip) => trip.status !== 'closed')
              .map((trip) => ({ ...trip, vehicleNumber: vehicle.vehicleNumber })))
            .catch(() => [])
        )));
        if (active) setOpenTrips(perVehicle.flat());
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []));

  if (loading) return <Loading />;

  return (
    <Screen>
      <ErrorText>{error}</ErrorText>
      <Card title={`Open Trips (${openTrips.length})`}>
        <Muted style={{ marginBottom: 8 }}>Total Vehicles: {vehicles.length}</Muted>
        {openTrips.length === 0 ? <Muted>No trips in progress.</Muted> : null}
        {openTrips.map((trip) => (
          <NavRow
            key={trip._id}
            title={trip.vehicleNumber}
            subtitle={formatTripRoute(trip)}
            right={<Badge status={trip.status} />}
            onPress={() => router.push(`/trips/${trip._id}`)}
          />
        ))}
      </Card>

      <Card title="Manage">
        <NavRow title="Vehicles" subtitle="Trip history and reminders per vehicle" onPress={() => router.push('/vehicles')} />
        <NavRow title="Drivers" subtitle="Driver list, add and edit drivers" onPress={() => router.push(`/customers/${user.customer}`)} />
        <NavRow title="Salary" subtitle="Monthly salary details per driver" onPress={() => router.push('/salary')} />
        <NavRow title="Leaves" subtitle="Leave entries for your drivers" onPress={() => router.push('/leaves')} />
      </Card>
    </Screen>
  );
}
