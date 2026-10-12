import React, { useEffect, useState } from 'react';
import {
  COMPANY_NAME_PATTERN, companyNameInput, EMAIL_PATTERN, emailInput, MOBILE_NUMBER_PATTERN, mobileNumberInput,
  USERNAME_PATTERN, USERNAME_RULE_HINT, usernameInput,
} from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, ErrorText, Field, Input } from '../../ui';

const EMPTY = {
  companyName: '', email: '', mobileNumber: '', address: '',
  adminUsername: '', adminPassword: '',
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

  const valid = COMPANY_NAME_PATTERN.test(form.companyName.trim()) && EMAIL_PATTERN.test(form.email.trim())
    && MOBILE_NUMBER_PATTERN.test(form.mobileNumber) && USERNAME_PATTERN.test(form.adminUsername);

  return (
    <Card title="Edit Customer Details">
      <Field label="Company Name" hint="Letters and spaces only"><Input value={form.companyName} onChangeText={(value) => update('companyName')(companyNameInput(value))} autoCapitalize="words" maxLength={150} /></Field>
      <Field label="Email Address" hint="Must be a valid email address with @ and no spaces"><Input value={form.email} onChangeText={(value) => update('email')(emailInput(value))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /></Field>
      <Field label="Phone Number" hint="Exactly 10 digits"><Input value={form.mobileNumber} onChangeText={(value) => update('mobileNumber')(mobileNumberInput(value))} keyboardType="number-pad" maxLength={10} /></Field>
      <Field label="Address"><Input value={form.address} onChangeText={update('address')} /></Field>
      <Field label="Admin Username" hint={USERNAME_RULE_HINT}><Input value={form.adminUsername} onChangeText={(value) => update('adminUsername')(usernameInput(value))} autoCapitalize="none" autoCorrect={false} maxLength={50} /></Field>
      <Field label="Admin Password">
        <Input value={form.adminPassword} onChangeText={update('adminPassword')} secureTextEntry autoCapitalize="none" placeholder="Leave blank to keep current password" />
      </Field>
      <ErrorText>{error}</ErrorText>
      {changed && <Button title="Save Changes" onPress={save} loading={saving} disabled={!valid} />}
    </Card>
  );
}
