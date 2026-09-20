import React, { useState } from 'react';
import { View } from 'react-native';
import { formatDate, toDateInputValue } from '@kps/shared';
import { api, errorMessage } from '../api';
import { Button, Card, DateField, ErrorText, Field, NumberInput } from '../ui';
import { spacing } from '../theme';
import { ButtonRow, EditBox, EntryRow } from './common';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

export default function AdvanceSection({ trip, reload, locked }) {
  const tripId = trip._id;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const advances = trip.driverAdvances || [];
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.addAdvance(tripId, { amount: Number(amount), date: date || undefined });
      setAmount(''); setDate('');
      await reload();
    } catch (err) {
      setError(errorMessage(err, 'Failed to add advance'));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(index, advance) {
    setEditingIndex(index);
    setEditAmount(String(advance.amount));
    setEditDate(toDateInputValue(advance.date) || '');
    setError('');
  }

  async function saveEdit(index) {
    setBusy(true);
    setError('');
    try {
      await api.updateAdvance(tripId, index, { amount: Number(editAmount), date: editDate });
      setEditingIndex(null);
      await reload();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update advance'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Advance">
      <ErrorText>{error}</ErrorText>
      {advances.map((advance, index) => (
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
          <EntryRow key={index} title={`Rs ${advance.amount}`} subtitle={formatDate(advance.date)}>
            {!locked && <Button title="Edit" variant="secondary" onPress={() => startEdit(index, advance)} disabled={busy} />}
          </EntryRow>
        )
      ))}
      {!locked && (
        <View style={{ marginTop: advances.length ? spacing.md : 0 }}>
          <Field label="Amount (Rs)"><NumberInput value={amount} onChangeText={setAmount} /></Field>
          <DateField label="Date" value={date} onChange={setDate} min={minDate} max={maxDate} />
          <Button title="Add" onPress={submit} loading={busy} disabled={!amount} />
        </View>
      )}
    </Card>
  );
}
