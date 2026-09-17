import React, { useState } from 'react';
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
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (user?.role !== 'super_admin') {
    return <Layout><p>You do not have access to this page.</p></Layout>;
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
          <div className="field"><label>Company Name</label><input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required /></div>
          <div className="field"><label>Mobile Number</label><input value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} required /></div>
        </div>
        <div className="field"><label>Email Address</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
        <div className="field"><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid-2">
          <div className="field"><label>Admin Username</label><input autoComplete="off" value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} required /></div>
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
