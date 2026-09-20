import React, { useState } from 'react';
import { api, errorMessage } from '../../api';
import { Button, Card, ErrorText, Field, Input } from '../../ui';

const EMPTY = { companyName: '', mobileNumber: '', email: '', address: '', adminUsername: '', adminPassword: '' };

// Same rules as backend rules.createCustomer, surfaced as hints so a 400 is not a surprise.
const USERNAME_PATTERN = /^[a-z0-9._@-]{3,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Port of the web AdminOnboarding form: POST /customers creates the customer + first admin login.
export default function OnboardCustomerForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const usernameOk = USERNAME_PATTERN.test(form.adminUsername.trim().toLowerCase());
  const passwordOk = form.adminPassword.length >= 6 && form.adminPassword.length <= 128;
  const emailOk = EMAIL_PATTERN.test(form.email.trim());
  const requiredOk = Boolean(form.companyName.trim() && form.mobileNumber.trim());
  const canSubmit = requiredOk && usernameOk && passwordOk && emailOk;

  const hintFor = (filled, ok, rule) => (filled && !ok ? `${rule} (not valid yet)` : rule);

  async function submit() {
    setError('');
    setSaving(true);
    try {
      const res = await api.createCustomer(form);
      onCreated(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Failed to create customer'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Onboard New Customer">
      <Field label="Company Name"><Input value={form.companyName} onChangeText={update('companyName')} autoCapitalize="words" /></Field>
      <Field label="Mobile Number"><Input value={form.mobileNumber} onChangeText={update('mobileNumber')} keyboardType="phone-pad" /></Field>
      <Field label="Email Address" hint={hintFor(form.email, emailOk, 'Must be a valid email address')}>
        <Input value={form.email} onChangeText={update('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label="Address"><Input value={form.address} onChangeText={update('address')} /></Field>
      <Field label="Admin Username" hint={hintFor(form.adminUsername, usernameOk, '3-50 characters: lowercase letters, numbers, . _ @ -')}>
        <Input value={form.adminUsername} onChangeText={update('adminUsername')} autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label="Admin Password" hint={hintFor(form.adminPassword, passwordOk, '6-128 characters')}>
        <Input value={form.adminPassword} onChangeText={update('adminPassword')} secureTextEntry autoCapitalize="none" />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button title="Create Customer" onPress={submit} loading={saving} disabled={!canSubmit} />
    </Card>
  );
}
