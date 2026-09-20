import React, { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { api, errorMessage } from '../src/api';
import { Button, Card, ErrorText, Field, Input, Muted, Screen } from '../src/ui';
import { colors } from '../src/theme';

// Same two-step flow as the website: username + recovery mobile -> emailed code -> new password.
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [recoveryMobile, setRecoveryMobile] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setError('');
    setBusy(true);
    try {
      const res = await api.forgotPassword(username.trim(), recoveryMobile.trim());
      setInfo(res.data.message);
      setStep(2);
    } catch (err) {
      setError(errorMessage(err, 'Could not request a reset code'));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await api.resetPasswordWithCode(username.trim(), code.trim(), newPassword);
      setInfo(res.data.message);
      setStep(3);
    } catch (err) {
      setError(errorMessage(err, 'Could not reset the password'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Forgot Password', headerShown: true }} />
      <Card>
        {step === 1 && (
          <>
            <Muted style={{ marginBottom: 12 }}>
              Enter your username and the recovery mobile number saved on your account. A 6-digit code will be sent to your recovery email.
            </Muted>
            <Field label="Username">
              <Input value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
            </Field>
            <Field label="Recovery Mobile Number">
              <Input value={recoveryMobile} onChangeText={setRecoveryMobile} keyboardType="phone-pad" />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button title="Send code" onPress={requestCode} loading={busy} disabled={!username || !recoveryMobile} />
          </>
        )}

        {step === 2 && (
          <>
            <Muted style={{ marginBottom: 12, color: colors.green700 }}>{info}</Muted>
            <Field label="6-digit Code">
              <Input value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
            </Field>
            <Field label="New Password">
              <Input value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            </Field>
            <Field label="Confirm New Password">
              <Input value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button title="Reset password" onPress={resetPassword} loading={busy} disabled={code.length !== 6 || newPassword.length < 6} />
            <Button title="Request a new code" variant="secondary" onPress={() => { setStep(1); setError(''); }} style={{ marginTop: 8 }} />
          </>
        )}

        {step === 3 && (
          <>
            <Muted style={{ marginBottom: 12, color: colors.green700 }}>{info}</Muted>
            <Button title="Go to sign in" onPress={() => router.replace('/login')} />
          </>
        )}
      </Card>
    </Screen>
  );
}
