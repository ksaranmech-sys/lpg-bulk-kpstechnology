import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../api/api';

// Opened from the emailed reset link (/reset-password?token=...). Sets a new password once.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = (params.get('token') || '').trim();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await api.resetPasswordWithToken(token, newPassword);
      setDone(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset the password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 380 }}>
        <h2 style={{ color: 'var(--green-900)', marginTop: 0 }}>Reset Password</h2>

        {!token && (
          <p className="error-text">
            This reset link is missing its token. Please open the link from your email, or <Link to="/forgot-password">request a new one</Link>.
          </p>
        )}

        {token && !done && (
          <form onSubmit={submit} style={{ border: 0, padding: 0, background: 'transparent' }}>
            <div className="field">
              <label>New Password</label>
              <input type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="field">
              <label>Confirm New Password</label>
              <input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {error && (
              <div className="error-text">
                {error} <Link to="/forgot-password">Request a new link</Link>
              </div>
            )}
            <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Resetting...' : 'Set new password'}</button>
          </form>
        )}

        {done && (
          <>
            <p style={{ color: 'var(--green-700)' }}>{done}</p>
            <button className="btn" style={{ width: '100%' }} onClick={() => navigate('/login')}>Go to sign in</button>
          </>
        )}

        <p style={{ marginTop: 16, marginBottom: 0, fontSize: 13 }}>
          <Link to="/login">&larr; Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
