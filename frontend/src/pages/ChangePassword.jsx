import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/api';
import { saveSession } from '../api/session';
import Layout from '../components/Layout';

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
      <h2 className="section-title" style={{ marginTop: 12 }}>Change Password</h2>
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
    </Layout>
  );
}
