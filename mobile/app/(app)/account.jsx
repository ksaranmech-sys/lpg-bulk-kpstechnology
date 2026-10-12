import React, { useState } from 'react';
import { EMAIL_PATTERN, emailInput } from '@kps/shared';
import { useAuth } from '../../src/AuthContext';
import { api, errorMessage } from '../../src/api';
import { saveSession } from '../../src/session';
import { Button, Card, ErrorText, Field, Input, Muted, Screen } from '../../src/ui';
import { colors } from '../../src/theme';

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      // Changing the password signs out every other device; keep this one alive with fresh tokens.
      await saveSession({ token: res.data.token, refreshToken: res.data.refreshToken });
      setMessage('Password changed successfully.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(errorMessage(err, 'Failed to change password'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Change Password">
      <Field label="Current Password"><Input value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry /></Field>
      <Field label="New Password"><Input value={newPassword} onChangeText={setNewPassword} secureTextEntry /></Field>
      <Field label="Confirm New Password"><Input value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry /></Field>
      <ErrorText>{error}</ErrorText>
      {message ? <Muted style={{ color: colors.green700, fontWeight: '700', marginBottom: 8 }}>{message}</Muted> : null}
      <Button title="Change password" onPress={submit} loading={busy} disabled={!currentPassword || newPassword.length < 6 || !confirmPassword} />
    </Card>
  );
}

function RecoveryContactsCard() {
  const { user, refreshUser } = useAuth();
  const [recoveryEmail, setRecoveryEmail] = useState(user?.recoveryEmail || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api.setRecoveryContact({ currentPassword, recoveryEmail: recoveryEmail.trim() });
      setCurrentPassword('');
      setMessage('Recovery email saved.');
      await refreshUser();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save recovery email'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Password Recovery Email">
      <Muted style={{ marginBottom: 12 }}>
        If you forget your password, a reset link is emailed to this address.
        {!user?.recoveryEmail ? ' Not set yet - please add it now.' : ''}
      </Muted>
      <Field label="Recovery Email"><Input value={recoveryEmail} onChangeText={(value) => setRecoveryEmail(emailInput(value))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /></Field>

      <Field label="Current Password (to confirm)"><Input value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry /></Field>
      <ErrorText>{error}</ErrorText>
      {message ? <Muted style={{ color: colors.green700, fontWeight: '700', marginBottom: 8 }}>{message}</Muted> : null}
      <Button title="Save recovery email" onPress={submit} loading={busy} disabled={!EMAIL_PATTERN.test(recoveryEmail.trim()) || !currentPassword} />
    </Card>
  );
}

export default function AccountScreen() {
  const { user } = useAuth();
  return (
    <Screen>
      <Card title="Signed in as">
        <Muted>{user?.displayName || user?.name || user?.username} ({user?.role})</Muted>
      </Card>
      <ChangePasswordCard />
      {user?.role === 'super_admin' && <RecoveryContactsCard />}
    </Screen>
  );
}
