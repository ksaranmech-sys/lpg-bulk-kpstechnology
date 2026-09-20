import React from 'react';
import { Field, Input, NumberInput } from '../../ui';

// The four KM table columns as inputs; shared by the add form and the per-row edit form.
export default function RouteFields({ value, onChange }) {
  const update = (field) => (text) => onChange({ ...value, [field]: text });
  return (
    <>
      <Field label="Loading Location">
        <Input value={value.loadingLocation} onChangeText={update('loadingLocation')} placeholder="Loading location" autoCapitalize="words" />
      </Field>
      <Field label="Unloading Location">
        <Input value={value.unloadingLocation} onChangeText={update('unloadingLocation')} placeholder="Unloading location" autoCapitalize="words" />
      </Field>
      <Field label="Corporation">
        <Input value={value.corporation} onChangeText={update('corporation')} placeholder="Corporation" autoCapitalize="characters" />
      </Field>
      <Field label="KM">
        <NumberInput value={value.km} onChangeText={update('km')} placeholder="KM" />
      </Field>
    </>
  );
}

export function isRouteComplete(value) {
  const km = Number(value.km);
  return Boolean(
    value.loadingLocation.trim() && value.unloadingLocation.trim() && value.corporation.trim()
    && value.km !== '' && Number.isFinite(km) && km >= 0,
  );
}
