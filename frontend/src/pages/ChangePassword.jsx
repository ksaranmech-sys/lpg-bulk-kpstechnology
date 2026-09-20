import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/api';
import { saveSession } from '../api/session';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

// Where "Forgot password" codes are sent. Saving requires the current password.
function RecoveryContactsForm() {
  const { user, refreshUser } = useAuth();
  const [recoveryEmail, setRecoveryEmail] = useState(user?.recoveryEmail || '');
  const [recoveryMobile, setRecoveryMobile] = useState(user?.recoveryMobile || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api.setRecoveryContact({ currentPassword, recoveryEmail: recoveryEmail.trim(), recoveryMobile: recoveryMobile.trim() });
      setCurrentPassword('');
      setMessage('Recovery contacts saved.');
      if (refreshUser) refreshUser();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save recovery contacts');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="section-title" style={{ marginTop: 24 }}>Password Recovery Contacts</h2>
      <p style={{ color: '#666', fontSize: 13, marginTop: -4 }}>
        If you forget your password, a reset code is emailed to this address. You will also be asked for this mobile number.
        {!user?.recoveryEmail && <strong style={{ color: 'var(--danger)' }}> Not set yet - please add them now.</strong>}
      </p>
      <form className="card" onSubmit={submit} style={{ maxWidth: 420 }}>
        <div className="field">
          <label>Recovery Email</label>
          <input type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Recovery Mobile Number</label>
          <input inputMode="tel" value={recoveryMobile} onChange={(e) => setRecoveryMobile(e.target.value)} placeholder="e.g. 9876543210" required />
        </div>
        <div className="field">
          <label>Current Password (to confirm)</label>
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        {error && <div className="error-text">{error}</div>}
        {message && <div style={{ color: 'var(--green-700)', fontWeight: 700, marginBottom: 8 }}>{message}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save recovery contacts'}</button>
      </form>
    </>
  );
}

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      // Changing the password signs out every other session; keep this one alive with fresh tokens.
      saveSession({ token: res.data.token, refreshToken: res.data.refreshToken });
      setMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <Link to="/">&larr; Back</Link>
      <h2 className="section-title" style={{ marginTop: 12 }}>Account Security</h2>
      <h3 className="section-title" style={{ marginTop: 0 }}>Change Password</h3>
      <form className="card" onSubmit={submit} style={{ maxWidth: 420 }}>
        <div className="field">
          <label>Current Password</label>
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="field">
          <label>New Password</label>
          <input type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </div>
        <div className="field">
          <label>Confirm New Password</label>
          <input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
        {error && <div className="error-text">{error}</div>}
        {message && <div style={{ color: 'var(--green-700)', fontWeight: 700, marginBottom: 8 }}>{message}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Change password'}</button>
      </form>
      <RecoveryContactsForm />
    </Layout>
  );
}
