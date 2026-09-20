import React, { useState } from 'react';
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
  const [recoveryMobile, setRecoveryMobile] = useState(user?.recoveryMobile || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api.setRecoveryContact({ currentPassword, recoveryEmail: recoveryEmail.trim(), recoveryMobile: recoveryMobile.trim() });
      setCurrentPassword('');
      setMessage('Recovery contacts saved.');
      await refreshUser();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save recovery contacts'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Password Recovery Contacts">
      <Muted style={{ marginBottom: 12 }}>
        If you forget your password, a reset code is emailed to this address. You will also be asked for this mobile number.
        {!user?.recoveryEmail ? ' Not set yet - please add them now.' : ''}
      </Muted>
      <Field label="Recovery Email"><Input value={recoveryEmail} onChangeText={setRecoveryEmail} keyboardType="email-address" autoCapitalize="none" /></Field>
      <Field label="Recovery Mobile Number"><Input value={recoveryMobile} onChangeText={setRecoveryMobile} keyboardType="phone-pad" placeholder="e.g. 9876543210" /></Field>
      <Field label="Current Password (to confirm)"><Input value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry /></Field>
      <ErrorText>{error}</ErrorText>
      {message ? <Muted style={{ color: colors.green700, fontWeight: '700', marginBottom: 8 }}>{message}</Muted> : null}
      <Button title="Save recovery contacts" onPress={submit} loading={busy} disabled={!recoveryEmail || !recoveryMobile || !currentPassword} />
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
      <RecoveryContactsCard />
    </Screen>
  );
}
