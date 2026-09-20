import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/AuthContext';
import { errorMessage } from '../src/api';
import { API_BASE_URL } from '../src/config';
import { Button, ErrorText, Field, Input, Muted } from '../src/ui';
import { colors, spacing } from '../src/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      setError(errorMessage(err, 'Login failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.brand}>
        <Image source={require('../assets/icon.png')} style={styles.logo} />
        <Text style={styles.title}>LPG Fleet Driver</Text>
        <Text style={styles.subtitle}>KPS Technology — Fleet Management</Text>
      </View>
      <View style={styles.card}>
        <Field label="Username">
          <Input value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} textContentType="username" />
        </Field>
        <Field label="Password">
          <Input value={password} onChangeText={setPassword} secureTextEntry textContentType="password" onSubmitEditing={submit} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button title="Sign In" onPress={submit} loading={busy} disabled={!username || !password} />
        <Button title="Forgot password?" variant="link" onPress={() => router.push('/forgot-password')} style={{ marginTop: 8 }} />
      </View>
      <Muted style={styles.server}>Server: {API_BASE_URL}</Muted>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.green900, paddingHorizontal: spacing.xl, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: 96, height: 96, borderRadius: 20, marginBottom: spacing.md },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: spacing.xl },
  server: { color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: spacing.lg, fontSize: 11 },
});
