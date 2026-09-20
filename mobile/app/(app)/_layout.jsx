import React from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '../../src/AuthContext';
import { Button } from '../../src/ui';
import { colors } from '../../src/theme';

export default function AppLayout() {
  const { signOut } = useAuth();

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
            <Button title="Sign out" variant="link" onPress={confirmSignOut} style={{ paddingHorizontal: 0 }} textStyle={{ color: '#fff' }} />
          ),
        }}
      />
      <Stack.Screen name="vehicles/[vehicleId]" options={{ title: 'Trips' }} />
      <Stack.Screen name="trips/[tripId]" options={{ title: 'Trip' }} />
    </Stack>
  );
}
