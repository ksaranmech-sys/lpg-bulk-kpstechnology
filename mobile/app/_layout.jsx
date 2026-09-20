import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/AuthContext';
import { Loading } from '../src/ui';
import { colors } from '../src/theme';

// Stack.Protected shows the login screen until a user is signed in, and the app group after.
function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <Loading text="Starting..." />;
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.green900 }, headerTintColor: '#fff' }}>
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
