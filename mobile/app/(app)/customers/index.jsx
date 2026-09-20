import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../../src/AuthContext';
import { api, errorMessage } from '../../../src/api';
import { Button, Card, ErrorText, Loading, Muted, Screen } from '../../../src/ui';
import CustomerRow from '../../../src/features/customers/CustomerRow';

// Port of the web CustomerList (super_admin only): GET /customers, per-row block/edit/delete.
export default function CustomersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');

  const isSuper = user?.role === ROLES.SUPER_ADMIN;

  useFocusEffect(useCallback(() => {
    if (!isSuper) return undefined;
    let active = true;
    setError('');
    api.listCustomers()
      .then((res) => { if (active) setCustomers(res.data.customers); })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load customers')); });
    return () => { active = false; };
  }, [isSuper]));

  if (!isSuper) {
    return <Screen><Card><Muted>You do not have access to this page.</Muted></Card></Screen>;
  }

  const headerRight = () => (
    <Button
      title="Onboard customer"
      variant="link"
      onPress={() => router.push('/customers/new')}
      style={{ paddingHorizontal: 0 }}
      textStyle={{ color: '#fff' }}
    />
  );

  return (
    <Screen>
      <Stack.Screen options={{ headerRight }} />
      <Card title={`Customers (${customers?.length ?? 0})`}>
        <ErrorText>{error}</ErrorText>
        {!customers && !error ? <Loading text="Loading customers..." /> : null}
        {customers && customers.length === 0 ? <Muted>No customers found yet.</Muted> : null}
        {(customers || []).map((customer) => (
          <CustomerRow
            key={customer._id}
            customer={customer}
            onOpen={() => router.push(`/customers/${customer._id}`)}
            onChange={(next) => setCustomers((current) => current.map((item) => (item._id === next._id ? next : item)))}
            onDelete={(id) => setCustomers((current) => current.filter((item) => item._id !== id))}
          />
        ))}
      </Card>
    </Screen>
  );
}
