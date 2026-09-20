import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api/api';

// Two steps: (1) username + registered recovery mobile -> code emailed to the recovery address;
// (2) code + new password. The server never reveals whether a username exists.
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [recoveryMobile, setRecoveryMobile] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.forgotPassword(username.trim(), recoveryMobile.trim());
      setInfo(res.data.message);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not request a reset code');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
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
      setError(err.response?.data?.error || 'Could not reset the password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 380 }}>
        <h2 style={{ color: 'var(--green-900)', marginTop: 0 }}>Forgot Password</h2>

        {step === 1 && (
          <form onSubmit={requestCode} style={{ border: 0, padding: 0, background: 'transparent' }}>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
              Enter your username and the recovery mobile number saved on your account. A 6-digit code will be sent to your recovery email.
            </p>
            <div className="field">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div className="field">
              <label>Recovery Mobile Number</label>
              <input value={recoveryMobile} onChange={(e) => setRecoveryMobile(e.target.value)} inputMode="tel" required />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Sending...' : 'Send code'}</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={resetPassword} style={{ border: 0, padding: 0, background: 'transparent' }}>
            <p style={{ color: 'var(--green-700)', fontSize: 13, marginTop: 0 }}>{info}</p>
            <div className="field">
              <label>6-digit Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} required />
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
            <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Resetting...' : 'Reset password'}</button>
            <button type="button" className="btn secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => { setStep(1); setError(''); }}>
              Request a new code
            </button>
          </form>
        )}

        {step === 3 && (
          <>
            <p style={{ color: 'var(--green-700)' }}>{info}</p>
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
