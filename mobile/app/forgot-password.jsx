import React, { useState } from 'react';
import { EMAIL_PATTERN, emailInput } from '@kps/shared';
import { Stack, useRouter } from 'expo-router';
import { api, errorMessage } from '../src/api';
import { Button, Card, ErrorText, Field, Input, Muted, Screen } from '../src/ui';
import { colors } from '../src/theme';

// Same flow as the website: username + recovery email -> a one-time reset link is emailed.
// The link opens the website's /reset-password page, where the new password is set.
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestLink() {
    setError('');
    setBusy(true);
    try {
      const res = await api.forgotPassword(username.trim(), recoveryEmail.trim());
      setInfo(res.data.message);
    } catch (err) {
      setError(errorMessage(err, 'Could not request a reset link'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Forgot Password', headerShown: true }} />
      <Card>
        {info ? (
          <>
            <Muted style={{ marginBottom: 12, color: colors.green700 }}>{info}</Muted>
            <Muted style={{ marginBottom: 12 }}>
              Open the email and tap Reset password. The link works for 30 minutes. Once your password is changed, come back here to sign in.
            </Muted>
            <Button title="Back to sign in" onPress={() => router.replace('/login')} />
            <Button title="Try again" variant="secondary" onPress={() => setInfo('')} style={{ marginTop: 8 }} />
          </>
        ) : (
          <>
            <Muted style={{ marginBottom: 12 }}>
              Enter your username and the recovery email saved on your account. We will email you a link to reset your password.
            </Muted>
            <Muted style={{ marginBottom: 12 }}>
              Customer admin or driver? Password recovery by email is only for KPS super admin accounts - please ask your
              administrator to reset your password.
            </Muted>
            <Field label="Username">
              <Input value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
            </Field>
            <Field label="Recovery Email">
              <Input value={recoveryEmail} onChangeText={(value) => setRecoveryEmail(emailInput(value))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button title="Email me a reset link" onPress={requestLink} loading={busy} disabled={!username.trim() || !EMAIL_PATTERN.test(recoveryEmail.trim())} />
          </>
        )}
      </Card>
    </Screen>
  );
}
