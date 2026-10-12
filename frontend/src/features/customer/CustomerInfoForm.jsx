import React, { useEffect, useState } from 'react';
import { companyNameInput, emailInput, mobileNumberInput, USERNAME_HTML_PATTERN, USERNAME_RULE_HINT, usernameInput } from '@kps/shared';
import * as api from '../../api/api';

export default function CustomerInfoForm({ customerId, data, setData }) {
  const [customerEditForm, setCustomerEditForm] = useState({
    companyName: '',
    email: '',
    mobileNumber: '',
    address: '',
    adminUsername: '',
    adminPassword: '',
  });
  const [customerEditError, setCustomerEditError] = useState('');
  const [customerEditSaving, setCustomerEditSaving] = useState(false);
  const [customerEditChanged, setCustomerEditChanged] = useState(false);

  useEffect(() => {
    if (!data) return;
    const adminUser = data.users?.find((user) => user.role === 'customer_admin');
    setCustomerEditForm({
      companyName: data.customer?.companyName || '',
      email: data.customer?.email || '',
      mobileNumber: data.customer?.mobileNumber || '',
      address: data.customer?.address || '',
      adminUsername: adminUser?.username || '',
      adminPassword: '',
    });
    setCustomerEditChanged(false);
  }, [data]);

  function updateCustomerEditField(field, value) {
    setCustomerEditForm((current) => ({ ...current, [field]: value }));
    setCustomerEditChanged(true);
  }

  async function saveCustomerDetails(e) {
    e.preventDefault();
    setCustomerEditError('');
    setCustomerEditSaving(true);
    try {
      const payload = {
        companyName: customerEditForm.companyName,
        mobileNumber: customerEditForm.mobileNumber,
        email: customerEditForm.email,
        address: customerEditForm.address,
        adminUsername: customerEditForm.adminUsername,
        adminPassword: customerEditForm.adminPassword || undefined,
      };
      const res = await api.updateCustomer(customerId, payload);
      setData((current) => ({
        ...current,
        customer: res.data.customer,
        users: current.users.map((user) => (user.role === 'customer_admin' ? res.data.adminUser : user)),
      }));
      setCustomerEditChanged(false);
    } catch (err) {
      setCustomerEditError(err.response?.data?.error || 'Failed to update customer details');
    } finally {
      setCustomerEditSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Edit Customer Details</h3>
      <form onSubmit={saveCustomerDetails}>
        <div className="grid-2">
          <div className="field">
            <label>Company Name</label>
            <input pattern="[A-Za-z ]*[A-Za-z][A-Za-z ]*" title="Use letters and spaces only" value={customerEditForm.companyName} onChange={(e) => updateCustomerEditField('companyName', companyNameInput(e.target.value))} required />
          </div>
          <div className="field">
            <label>Email Address</label>
            <input type="email" title="Enter a valid email address (must contain @, no spaces)" value={customerEditForm.email} onChange={(e) => updateCustomerEditField('email', emailInput(e.target.value))} required />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Phone Number</label>
            <input inputMode="numeric" pattern="\d{10}" maxLength={10} title="Enter exactly 10 digits" value={customerEditForm.mobileNumber} onChange={(e) => updateCustomerEditField('mobileNumber', mobileNumberInput(e.target.value))} required />
          </div>
          <div className="field">
            <label>Address</label>
            <input value={customerEditForm.address} onChange={(e) => updateCustomerEditField('address', e.target.value)} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Admin Username</label>
            <input autoComplete="off" pattern={USERNAME_HTML_PATTERN} title={`Use ${USERNAME_RULE_HINT}`} value={customerEditForm.adminUsername} onChange={(e) => updateCustomerEditField('adminUsername', usernameInput(e.target.value))} required />
          </div>
          <div className="field">
            <label>Admin Password</label>
            <input type="password" autoComplete="new-password" value={customerEditForm.adminPassword} onChange={(e) => updateCustomerEditField('adminPassword', e.target.value)} placeholder="Leave blank to keep current password" />
          </div>
        </div>
        {customerEditError && <div className="error-text">{customerEditError}</div>}
        {customerEditChanged && !customerEditSaving && (
          <button className="btn" type="submit">
            Save Changes
          </button>
        )}
        {customerEditSaving && (
          <button className="btn" type="button" disabled>
            Saving...
          </button>
        )}
      </form>
    </div>
  );
}
