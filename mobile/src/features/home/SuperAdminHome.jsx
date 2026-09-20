import React from 'react';
import { useRouter } from 'expo-router';
import { Card, Muted, NavRow, Screen } from '../../ui';

// Super admin home: KPS staff menu.
export default function SuperAdminHome({ user }) {
  const router = useRouter();
  return (
    <Screen>
      <Card title="KPS Admin">
        <Muted style={{ marginBottom: 8 }}>Signed in as {user.name || user.username}</Muted>
        <NavRow title="Customers" subtitle="All onboarded customers" onPress={() => router.push('/customers')} />
        <NavRow title="All Vehicles" subtitle="Filter by customer, open trip history" onPress={() => router.push('/vehicles')} />
        <NavRow title="KM Table" subtitle="Route KM reference table" onPress={() => router.push('/route-km')} />
        <NavRow title="Onboard Customer" subtitle="Create a new customer and admin login" onPress={() => router.push('/customers/new')} />
        <NavRow title="Leaves" subtitle="Leave entries by customer" onPress={() => router.push('/leaves')} />
      </Card>
    </Screen>
  );
}
