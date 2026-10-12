import React, { useState } from 'react';
import { emailInput } from '@kps/shared';
import { Link } from 'react-router-dom';
import * as api from '../api/api';

// Username + recovery email -> a one-time reset link is emailed; the link opens /reset-password.
// The server never reveals whether a username exists.
export default function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestLink(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.forgotPassword(username.trim(), recoveryEmail.trim());
      setInfo(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not request a reset link');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 380 }}>
        <h2 style={{ color: 'var(--green-900)', marginTop: 0 }}>Forgot Password</h2>

        {info ? (
          <>
            <p style={{ color: 'var(--green-700)' }}>{info}</p>
            <p style={{ color: '#666', fontSize: 13 }}>
              Open the email and click <strong>Reset password</strong>. The link works for 30 minutes.
              Did not get it? Check your spam folder or{' '}
              <button type="button" className="link-button" style={{ padding: 0, border: 0, background: 'none', color: 'var(--green-700)', cursor: 'pointer', font: 'inherit' }} onClick={() => setInfo('')}>
                try again
              </button>.
            </p>
          </>
        ) : (
          <form onSubmit={requestLink} style={{ border: 0, padding: 0, background: 'transparent' }}>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
              Enter your username and the recovery email saved on your account. We will email you a link to reset your password.
            </p>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
              <strong>Customer admin or driver?</strong> Password recovery by email is only for KPS super admin accounts -
              please ask your administrator to reset your password.
            </p>
            <div className="field">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div className="field">
              <label>Recovery Email</label>
              <input type="email" autoComplete="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(emailInput(e.target.value))} required />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Sending...' : 'Email me a reset link'}</button>
          </form>
        )}

        <p style={{ marginTop: 16, marginBottom: 0, fontSize: 13 }}>
          <Link to="/login">&larr; Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
