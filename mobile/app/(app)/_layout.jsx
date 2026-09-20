import React from 'react';
import { Alert, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/AuthContext';
import { Button } from '../../src/ui';
import { colors } from '../../src/theme';

export default function AppLayout() {
  const { signOut } = useAuth();
  const router = useRouter();

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.green900 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'LPG Fleet',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Button title="Account" variant="link" onPress={() => router.push('/account')} style={{ paddingHorizontal: 6 }} textStyle={{ color: '#fff' }} />
              <Button title="Sign out" variant="link" onPress={confirmSignOut} style={{ paddingHorizontal: 0 }} textStyle={{ color: '#fff' }} />
            </View>
          ),
        }}
      />
      <Stack.Screen name="account" options={{ title: 'Account Security' }} />
      <Stack.Screen name="vehicles/index" options={{ title: 'Vehicles' }} />
      <Stack.Screen name="vehicles/[vehicleId]/index" options={{ title: 'Trips' }} />
      <Stack.Screen name="vehicles/[vehicleId]/reminders" options={{ title: 'Reminder / Expiry Dates' }} />
      <Stack.Screen name="trips/[tripId]" options={{ title: 'Trip' }} />
      <Stack.Screen name="leaves/index" options={{ title: 'Leave Entries' }} />
      <Stack.Screen name="salary/index" options={{ title: 'Salary Details' }} />
      <Stack.Screen name="customers/index" options={{ title: 'Customers' }} />
      <Stack.Screen name="customers/new" options={{ title: 'Onboard Customer' }} />
      <Stack.Screen name="customers/[customerId]" options={{ title: 'Customer' }} />
      <Stack.Screen name="drivers/new" options={{ title: 'Add Driver' }} />
      <Stack.Screen name="drivers/[customerId]/[driverId]" options={{ title: 'Driver' }} />
      <Stack.Screen name="route-km" options={{ title: 'KM Table' }} />
    </Stack>
  );
}
