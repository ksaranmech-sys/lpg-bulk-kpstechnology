import React from 'react';
import {
  DRIVER_NAME_PATTERN,
  driverNameInput,
  EMPTY_DRIVER_FORM,
  MOBILE_NUMBER_PATTERN,
  mobileNumberInput,
  toDateInputValue,
  USERNAME_PATTERN,
  USERNAME_RULE_HINT,
  usernameInput,
} from '@kps/shared';
import { Button, Checkbox, DateField, ErrorText, Field, Input, NumberInput, Select } from '../../ui';
import { ButtonRow } from '../../trip/common';
import { spacing } from '../../theme';

// Seeds the edit form from a driver record, exactly as the web editSelectedDriver() does.
export function driverToForm(driver) {
  return {
    name: driver.name || '',
    mobileNumber: driver.mobileNumber || '',
    joiningDate: driver.joiningDate ? toDateInputValue(driver.joiningDate) : '',
    resigningDate: driver.resigningDate ? toDateInputValue(driver.resigningDate) : '',
    username: driver.username || '',
    password: '',
    vehicleId: String(driver.vehicle || ''),
    basicSalary: String(driver.basicSalary ?? 0),
    kmCharges: String(driver.kmCharges ?? 0),
    minKmCharges: String(driver.minKmCharges ?? 0),
    temporaryDriverRequired: Boolean(driver.temporaryDriver?.required),
    temporaryDriverName: driver.temporaryDriver?.name || '',
    temporaryDriverJoiningDate: driver.temporaryDriver?.joiningDate ? toDateInputValue(driver.temporaryDriver.joiningDate) : '',
    temporaryDriverReturningDate: driver.temporaryDriver?.returningDate ? toDateInputValue(driver.temporaryDriver.returningDate) : '',
  };
}

function temporaryDriverPayload(form) {
  return {
    required: form.temporaryDriverRequired,
    name: form.temporaryDriverName,
    joiningDate: form.temporaryDriverJoiningDate || undefined,
    returningDate: form.temporaryDriverReturningDate || undefined,
  };
}

// createVehicleUser body: the raw form fields (strings) plus the temporaryDriver block.
export function buildCreatePayload(form) {
  const { temporaryDriverRequired, temporaryDriverName, temporaryDriverJoiningDate, temporaryDriverReturningDate, ...rest } = form;
  return { ...rest, temporaryDriver: temporaryDriverPayload(form) };
}

// updateVehicleUser body: dates null when blank, salary numbers coerced, blank password omitted.
export function buildUpdatePayload(form) {
  return {
    name: form.name,
    mobileNumber: form.mobileNumber,
    joiningDate: form.joiningDate || null,
    resigningDate: form.resigningDate || null,
    username: form.username,
    password: form.password || undefined,
    vehicleId: form.vehicleId || '',
    basicSalary: Number(form.basicSalary || 0),
    kmCharges: Number(form.kmCharges || 0),
    minKmCharges: Number(form.minKmCharges || 0),
    temporaryDriver: temporaryDriverPayload(form),
  };
}

// Mirrors the web `required` attributes so the submit button only enables on a valid form.
export function isDriverFormValid(form, mode) {
  if (!DRIVER_NAME_PATTERN.test(form.name.trim()) || !MOBILE_NUMBER_PATTERN.test(form.mobileNumber) || !USERNAME_PATTERN.test(form.username)) return false;
  if (mode === 'create' && !form.password) return false;
  if (mode === 'edit' && (form.basicSalary === '' || form.kmCharges === '')) return false;
  if (form.temporaryDriverRequired && (!DRIVER_NAME_PATTERN.test(form.temporaryDriverName.trim()) || !form.temporaryDriverJoiningDate)) return false;
  return true;
}

export { EMPTY_DRIVER_FORM };

export default function DriverForm({ form, setForm, vehicles, mode, error, saving, onSave, onCancel }) {
  const set = (field) => (value) => setForm({ ...form, [field]: value });
  const isEdit = mode === 'edit';

  return (
    <>
      <Field label="Driver Name" hint="Letters, numbers, and spaces only"><Input value={form.name} onChangeText={(value) => set('name')(driverNameInput(value))} autoCapitalize="words" /></Field>
      <Field label="Mobile Number" hint="Exactly 10 digits"><Input value={form.mobileNumber} onChangeText={(value) => set('mobileNumber')(mobileNumberInput(value))} keyboardType="number-pad" maxLength={10} /></Field>
      <DateField label="Joining Date" value={form.joiningDate} onChange={set('joiningDate')} />
      <DateField label="Resigning Date" value={form.resigningDate} onChange={set('resigningDate')} />
      <Field label="Login Username" hint={USERNAME_RULE_HINT}>
        <Input value={form.username} onChangeText={(value) => set('username')(usernameInput(value))} autoCapitalize="none" autoCorrect={false} maxLength={50} />
      </Field>
      <Field label="Login Password">
        <Input
          value={form.password}
          onChangeText={set('password')}
          secureTextEntry
          autoCapitalize="none"
          placeholder={isEdit ? 'Leave blank to keep current password' : undefined}
        />
      </Field>
      <Select
        label={isEdit ? 'Assigned Vehicle' : 'Link to Vehicle (optional)'}
        value={form.vehicleId}
        onChange={set('vehicleId')}
        options={(vehicles || []).map((vehicle) => ({ value: String(vehicle._id), label: vehicle.vehicleNumber }))}
        placeholder="No vehicles"
      />
      <Field label="Basic Salary"><NumberInput value={form.basicSalary} onChangeText={set('basicSalary')} /></Field>
      <Field label="KM Charges"><NumberInput value={form.kmCharges} onChangeText={set('kmCharges')} /></Field>
      <Field label="Less than 200KM Charges"><NumberInput value={form.minKmCharges} onChangeText={set('minKmCharges')} /></Field>
      <Checkbox label="Temporary Driver" checked={form.temporaryDriverRequired} onChange={set('temporaryDriverRequired')} />
      {form.temporaryDriverRequired && (
        <>
          <Field label="Temporary Driver Name" hint="Letters, numbers, and spaces only">
            <Input value={form.temporaryDriverName} onChangeText={(value) => set('temporaryDriverName')(driverNameInput(value))} autoCapitalize="words" />
          </Field>
          <DateField label="Joining Date" value={form.temporaryDriverJoiningDate} onChange={set('temporaryDriverJoiningDate')} />
          <DateField
            label="Returning Date"
            value={form.temporaryDriverReturningDate}
            min={form.temporaryDriverJoiningDate || undefined}
            onChange={set('temporaryDriverReturningDate')}
          />
        </>
      )}
      <ErrorText>{error}</ErrorText>
      <ButtonRow style={{ marginTop: spacing.sm }}>
        <Button
          title={isEdit ? 'Save Driver' : 'Add Driver'}
          onPress={onSave}
          loading={saving}
          disabled={!isDriverFormValid(form, mode)}
          style={{ flex: 1 }}
        />
        {onCancel && <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />}
      </ButtonRow>
    </>
  );
}
