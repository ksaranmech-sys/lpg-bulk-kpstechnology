import React, { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api';
import { Button, Card, ErrorText, Field, Input } from '../../ui';

const EMPTY = {
  companyName: '', email: '', mobileNumber: '', address: '',
  adminUsername: '', adminPassword: '', adminName: '', adminMobileNumber: '',
};

// Port of the web CustomerInfoForm (super_admin only): PATCH /customers/:id.
export default function CustomerInfoForm({ customerId, data, setData }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (!data) return;
    const adminUser = data.users?.find((user) => user.role === 'customer_admin');
    setForm({
      companyName: data.customer?.companyName || '',
      email: data.customer?.email || '',
      mobileNumber: data.customer?.mobileNumber || '',
      address: data.customer?.address || '',
      adminUsername: adminUser?.username || '',
      adminPassword: '',
      adminName: adminUser?.name || '',
      adminMobileNumber: adminUser?.mobileNumber || '',
    });
    setChanged(false);
  }, [data]);

  const update = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setChanged(true);
  };

  async function save() {
    setError('');
    setSaving(true);
    try {
      const res = await api.updateCustomer(customerId, {
        companyName: form.companyName,
        mobileNumber: form.mobileNumber,
        email: form.email,
        address: form.address,
        adminUsername: form.adminUsername,
        adminPassword: form.adminPassword || undefined,
        adminName: form.adminName,
        adminMobileNumber: form.adminMobileNumber,
      });
      setData((current) => ({
        ...current,
        customer: res.data.customer,
        users: current.users.map((user) => (user.role === 'customer_admin' ? res.data.adminUser : user)),
      }));
      setChanged(false);
    } catch (err) {
      setError(errorMessage(err, 'Failed to update customer details'));
    } finally {
      setSaving(false);
    }
  }

  const valid = form.companyName && form.email && form.mobileNumber && form.adminUsername;

  return (
    <Card title="Edit Customer Details">
      <Field label="Company Name"><Input value={form.companyName} onChangeText={update('companyName')} /></Field>
      <Field label="Email Address"><Input value={form.email} onChangeText={update('email')} keyboardType="email-address" autoCapitalize="none" /></Field>
      <Field label="Phone Number"><Input value={form.mobileNumber} onChangeText={update('mobileNumber')} keyboardType="phone-pad" /></Field>
      <Field label="Address"><Input value={form.address} onChangeText={update('address')} /></Field>
      <Field label="Admin Username"><Input value={form.adminUsername} onChangeText={update('adminUsername')} autoCapitalize="none" autoCorrect={false} /></Field>
      <Field label="Admin Password">
        <Input value={form.adminPassword} onChangeText={update('adminPassword')} secureTextEntry autoCapitalize="none" placeholder="Leave blank to keep current password" />
      </Field>
      <Field label="Admin Name"><Input value={form.adminName} onChangeText={update('adminName')} autoCapitalize="words" /></Field>
      <Field label="Admin Mobile Number"><Input value={form.adminMobileNumber} onChangeText={update('adminMobileNumber')} keyboardType="phone-pad" /></Field>
      <ErrorText>{error}</ErrorText>
      {changed && <Button title="Save Changes" onPress={save} loading={saving} disabled={!valid} />}
    </Card>
  );
}
