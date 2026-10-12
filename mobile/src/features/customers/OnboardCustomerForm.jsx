import React, { useState } from 'react';
import {
  COMPANY_NAME_PATTERN, companyNameInput, EMAIL_PATTERN, emailInput, MOBILE_NUMBER_PATTERN, mobileNumberInput,
  USERNAME_PATTERN, USERNAME_RULE_HINT, usernameFromCompanyName, usernameInput,
} from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, ErrorText, Field, Input } from '../../ui';

const EMPTY = { companyName: '', mobileNumber: '', email: '', address: '', adminUsername: '', adminPassword: '' };

// Port of the web AdminOnboarding form: POST /customers creates the customer + first admin login.
// Same rules as backend rules.createCustomer, surfaced as hints so a 400 is not a surprise.
export default function OnboardCustomerForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY);
  // Admin username follows the company name until the operator types their own.
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const changeCompanyName = (value) => {
    const companyName = companyNameInput(value);
    setForm((current) => ({
      ...current,
      companyName,
      adminUsername: usernameEdited ? current.adminUsername : usernameFromCompanyName(companyName),
    }));
  };

  const changeAdminUsername = (value) => {
    const adminUsername = usernameInput(value);
    setUsernameEdited(adminUsername !== '');
    setForm((current) => ({
      ...current,
      adminUsername: adminUsername || usernameFromCompanyName(current.companyName),
    }));
  };

  const companyNameOk = COMPANY_NAME_PATTERN.test(form.companyName.trim());
  const usernameOk = USERNAME_PATTERN.test(form.adminUsername.trim().toLowerCase());
  const passwordOk = form.adminPassword.length >= 6 && form.adminPassword.length <= 128;
  const emailOk = EMAIL_PATTERN.test(form.email.trim());
  const requiredOk = companyNameOk && MOBILE_NUMBER_PATTERN.test(form.mobileNumber);
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
      <Field label="Company Name" hint={hintFor(form.companyName, companyNameOk, 'Letters and spaces only')}>
        <Input value={form.companyName} onChangeText={changeCompanyName} autoCapitalize="words" maxLength={150} />
      </Field>
      <Field label="Mobile Number" hint="Exactly 10 digits"><Input value={form.mobileNumber} onChangeText={(value) => update('mobileNumber')(mobileNumberInput(value))} keyboardType="number-pad" maxLength={10} /></Field>
      <Field label="Email Address" hint={hintFor(form.email, emailOk, 'Must be a valid email address with @ and no spaces')}>
        <Input value={form.email} onChangeText={(value) => update('email')(emailInput(value))} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      </Field>
      <Field label="Address"><Input value={form.address} onChangeText={update('address')} /></Field>
      <Field label="Admin Username" hint={hintFor(form.adminUsername, usernameOk, USERNAME_RULE_HINT)}>
        <Input value={form.adminUsername} onChangeText={changeAdminUsername} autoCapitalize="none" autoCorrect={false} maxLength={50} />
      </Field>
      <Field label="Admin Password" hint={hintFor(form.adminPassword, passwordOk, '6-128 characters')}>
        <Input value={form.adminPassword} onChangeText={update('adminPassword')} secureTextEntry autoCapitalize="none" />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button title="Create Customer" onPress={submit} loading={saving} disabled={!canSubmit} />
    </Card>
  );
}
