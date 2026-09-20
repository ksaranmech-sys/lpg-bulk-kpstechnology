import React, { useState } from 'react';
import { View } from 'react-native';
import { formatDate, toDateInputValue } from '@kps/shared';
import { api, assetToUploadFile, errorMessage, getCurrentPosition } from '../api';
import { Button, Card, DateField, ErrorText, Field, Muted, NumberInput, PhotoPicker } from '../ui';
import { spacing } from '../theme';
import { ButtonRow, EditBox, EntryRow, SectionTitle } from './common';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

export default function RtoSection({ trip, reload, locked }) {
  const tripId = trip._id;
  const entries = trip.rtoEntries || [];
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [photo, setPhoto] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const gps = await getCurrentPosition();
      await api.addRtoEntry(tripId, { amount, date: date || undefined, lat: gps?.lat, lng: gps?.lng }, assetToUploadFile(photo));
      setAmount(''); setDate(''); setPhoto(null);
      await reload();
    } catch (err) {
      setError(errorMessage(err, 'Failed to add RTO expense'));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(index, entry) {
    setEditingIndex(index);
    setEditAmount(String(entry.amount));
    setEditDate(toDateInputValue(entry.date) || '');
    setError('');
  }

  async function saveEdit(index) {
    setBusy(true);
    setError('');
    try {
      await api.updateRtoEntry(tripId, index, { amount: Number(editAmount), date: editDate });
      setEditingIndex(null);
      await reload();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update RTO expense'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>RTO Expenses</SectionTitle>
      <ErrorText>{error}</ErrorText>
      {entries.length === 0 && locked ? <Muted>No RTO expenses added.</Muted> : null}
      {entries.map((entry, index) => (
        editingIndex === index ? (
          <EditBox key={index}>
            <Field label="Amount (Rs)"><NumberInput value={editAmount} onChangeText={setEditAmount} /></Field>
            <DateField label="Date" value={editDate} onChange={setEditDate} min={minDate} max={maxDate} />
            <ButtonRow>
              <Button title="Save" onPress={() => saveEdit(index)} loading={busy} style={{ flex: 1 }} />
              <Button title="Cancel" variant="secondary" onPress={() => setEditingIndex(null)} disabled={busy} style={{ flex: 1 }} />
            </ButtonRow>
          </EditBox>
        ) : (
          <EntryRow key={index} title={`Rs ${entry.amount}`} subtitle={formatDate(entry.date)}>
            {!locked && <Button title="Edit" variant="secondary" onPress={() => startEdit(index, entry)} disabled={busy} />}
          </EntryRow>
        )
      ))}
      {!locked && (
        <View style={{ marginTop: entries.length ? spacing.md : 0 }}>
          <Field label="Amount (Rs)"><NumberInput value={amount} onChangeText={setAmount} /></Field>
          <DateField label="Date" value={date} onChange={setDate} min={minDate} max={maxDate} />
          <PhotoPicker label="Photo (GPS auto)" asset={photo} onChange={setPhoto} />
          <Button title="Add" onPress={submit} loading={busy} disabled={!amount} />
        </View>
      )}
    </Card>
  );
}
