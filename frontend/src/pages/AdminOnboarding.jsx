import React, { useState } from 'react';
import {
  companyNameInput, emailInput, mobileNumberInput, USERNAME_HTML_PATTERN, USERNAME_RULE_HINT, usernameFromCompanyName, usernameInput,
} from '@kps/shared';
import * as api from '../api/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

// Only reachable/useful for role === 'super_admin' (KPS Technology staff).
// Onboards a new customer (subgroup) + their first admin login in one step.
export default function AdminOnboarding() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    companyName: '', mobileNumber: '', email: '', address: '', adminUsername: '', adminPassword: '',
  });
  // Admin username follows the company name until the operator types their own.
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (user?.role !== 'super_admin') {
    return <Layout><p>You do not have access to this page.</p></Layout>;
  }

  function changeCompanyName(value) {
    const companyName = companyNameInput(value);
    setForm((current) => ({
      ...current,
      companyName,
      adminUsername: usernameEdited ? current.adminUsername : usernameFromCompanyName(companyName),
    }));
  }

  function changeAdminUsername(value) {
    const adminUsername = usernameInput(value);
    setUsernameEdited(adminUsername !== '');
    setForm((current) => ({
      ...current,
      adminUsername: adminUsername || usernameFromCompanyName(current.companyName),
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.createCustomer(form);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create customer');
    }
  }

  return (
    <Layout>
      <h2 className="section-title">Onboard New Customer</h2>
      <form className="card" onSubmit={submit}>
        <div className="grid-2">
          <div className="field"><label>Company Name</label><input pattern="[A-Za-z ]*[A-Za-z][A-Za-z ]*" title="Use letters and spaces only" value={form.companyName} onChange={(e) => changeCompanyName(e.target.value)} required /></div>
          <div className="field"><label>Mobile Number</label><input inputMode="numeric" pattern="\d{10}" maxLength={10} title="Enter exactly 10 digits" value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: mobileNumberInput(e.target.value) })} required /></div>
        </div>
        <div className="field"><label>Email Address</label><input type="email" title="Enter a valid email address (must contain @, no spaces)" value={form.email} onChange={(e) => setForm({ ...form, email: emailInput(e.target.value) })} required /></div>
        <div className="field"><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid-2">
          <div className="field"><label>Admin Username</label><input autoComplete="off" pattern={USERNAME_HTML_PATTERN} title={`Use ${USERNAME_RULE_HINT}`} value={form.adminUsername} onChange={(e) => changeAdminUsername(e.target.value)} required /></div>
          <div className="field"><label>Admin Password</label><input type="password" autoComplete="new-password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required /></div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn">Create Customer</button>
      </form>
      {result && (
        <div className="card">
          Created customer <strong>{result.customer.companyName}</strong> with admin login{' '}
          <strong>{result.adminUser.username}</strong>. Share these credentials with the customer.
        </div>
      )}
    </Layout>
  );
}
