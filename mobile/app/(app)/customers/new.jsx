import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../../src/AuthContext';
import { Button, Card, Muted, Row, Screen } from '../../../src/ui';
import { colors, spacing } from '../../../src/theme';
import OnboardCustomerForm from '../../../src/features/customers/OnboardCustomerForm';

// Only reachable/useful for role === 'super_admin' (KPS Technology staff).
// Onboards a new customer (subgroup) + their first admin login in one step.
export default function NewCustomerScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [result, setResult] = useState(null);

  if (user?.role !== ROLES.SUPER_ADMIN) {
    return <Screen><Card><Muted>You do not have access to this page.</Muted></Card></Screen>;
  }

  if (result) {
    return (
      <Screen>
        <Card title="Customer created">
          <Text style={{ color: colors.ink, marginBottom: spacing.md }}>
            Created customer <Text style={{ fontWeight: '700' }}>{result.customer.companyName}</Text> with admin login{' '}
            <Text style={{ fontWeight: '700' }}>{result.adminUser.username}</Text>. Share these credentials with the customer.
          </Text>
          <Row label="Company" value={result.customer.companyName} />
          <Row label="Email" value={result.customer.email} />
          <Row label="Mobile" value={result.customer.mobileNumber} />
          <Row label="Admin username" value={result.adminUser.username} bold />
          <Button title="Done" onPress={() => router.replace('/customers')} style={{ marginTop: spacing.lg }} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <OnboardCustomerForm onCreated={setResult} />
    </Screen>
  );
}
