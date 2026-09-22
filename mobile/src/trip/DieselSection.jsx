import React, { useState } from 'react';
import { View } from 'react-native';
import { formatDate } from '@kps/shared';
import { api, assetToUploadFile, errorMessage, getCurrentPosition } from '../api';
import { Button, Card, DateField, ErrorText, Field, Muted, NumberInput, PhotoPicker, Select, Toggle } from '../ui';
import { spacing } from '../theme';
import { EntryRow, SectionTitle, confirm } from './common';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

const PAYMENT_OPTIONS = [
  { value: 'diesel_card', label: 'Diesel Card' },
  { value: 'cash', label: 'Cash' },
];

function DieselForm({ trip, onSaved }) {
  const [volumeLitres, setVolume] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('diesel_card');
  const [odometerKm, setOdo] = useState('');
  const [filledAt, setFilledAt] = useState('');
  const [photo, setPhoto] = useState(null);
  const [dieselFilledConfirmed, setDieselFilledConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      // GPS is optional - used only to group same-day fills at one pump when available.
      const gps = await getCurrentPosition();
      await api.addDieselEntry(
        trip._id,
        {
          volumeLitres,
          totalValue,
          paymentMethod,
          loadingPointTankFill: dieselFilledConfirmed,
          odometerKm: odometerKm || undefined,
          filledAt: filledAt || undefined,
          lat: gps?.lat,
          lng: gps?.lng,
        },
        assetToUploadFile(photo)
      );
      setVolume(''); setTotalValue(''); setPaymentMethod('diesel_card'); setOdo(''); setFilledAt(''); setPhoto(null); setDieselFilledConfirmed(false);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Failed to add diesel entry'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ marginTop: spacing.md }}>
      <ErrorText>{error}</ErrorText>
      <Field label="Volume (Litres)"><NumberInput value={volumeLitres} onChangeText={setVolume} /></Field>
      <Field label="Total Value (Rs)"><NumberInput value={totalValue} onChangeText={setTotalValue} /></Field>
      <Select
        label="Payment Method"
        value={paymentMethod}
        options={PAYMENT_OPTIONS}
        onChange={(next) => { if (next) setPaymentMethod(next); }}
      />
      <Toggle label="Tank Fill" value={dieselFilledConfirmed} onChange={setDieselFilledConfirmed} />
      <Field label="Odometer Reading"><NumberInput value={odometerKm} onChangeText={setOdo} placeholder="Optional" /></Field>
      <DateField label="Date" value={filledAt} onChange={setFilledAt} min={minDate} max={maxDate} />
      <PhotoPicker label="Photo (optional)" asset={photo} onChange={setPhoto} />
      <Button title="Add" onPress={submit} loading={busy} disabled={!volumeLitres || !totalValue || !filledAt} />
    </View>
  );
}

export default function DieselSection({ trip, reload, locked, onAdded = reload }) {
  const entries = trip.dieselEntries || [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove(index) {
    if (!(await confirm('Delete this diesel entry?'))) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteDieselEntry(trip._id, index);
      await reload();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete diesel entry'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Diesel</SectionTitle>
      <ErrorText>{error}</ErrorText>
      {entries.length === 0 && locked ? <Muted>No diesel entries added.</Muted> : null}
      {entries.map((entry, index) => (
        <EntryRow
          key={index}
          title={`${entry.volumeLitres} L  -  Rs ${entry.amount}`}
          subtitle={[
            formatDate(entry.filledAt),
            entry.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card',
            entry.odometerKm != null ? `Odo ${entry.odometerKm}` : null,
            entry.loadingPointTankFill ? 'Tank Fill' : null,
          ].filter(Boolean).join(' | ')}
        >
          {!locked && (
            <Button title="Delete" variant="danger" onPress={() => remove(index)} disabled={busy} />
          )}
        </EntryRow>
      ))}
      {!locked && <DieselForm trip={trip} onSaved={onAdded} />}
    </Card>
  );
}
