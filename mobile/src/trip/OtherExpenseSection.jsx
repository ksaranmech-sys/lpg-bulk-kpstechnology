import React, { useState } from 'react';
import { View } from 'react-native';
import { formatDate, toDateInputValue } from '@kps/shared';
import { api, assetToUploadFile, errorMessage, getCurrentPosition } from '../api';
import { Button, Card, DateField, ErrorText, Field, Input, Muted, NumberInput, PhotoPicker } from '../ui';
import { spacing } from '../theme';
import { ButtonRow, EditBox, EntryRow, LocationPicker, SectionTitle, confirm } from './common';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

const OTHER_EXPENSE_CATEGORIES = ['Unloading Cleaner', 'AdBlue', 'Puncture', 'Firegun'];

export default function OtherExpenseSection({ trip, reload, locked }) {
  const tripId = trip._id;
  const entries = trip.otherExpenses || [];
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [photo, setPhoto] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const minDate = getEntryMinDate(trip);
  const maxDate = getEntryMaxDate(trip);

  async function submit() {
    const description = category.trim();
    if (!description) {
      setError('Select a category or enter a description.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const gps = await getCurrentPosition();
      await api.addOtherExpense(
        tripId,
        { amount, date: date || undefined, description, lat: gps?.lat, lng: gps?.lng },
        assetToUploadFile(photo)
      );
      setAmount(''); setDate(''); setCategory(''); setPhoto(null);
      await reload();
    } catch (err) {
      setError(errorMessage(err, 'Failed to add other expense'));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(index, entry) {
    setEditingIndex(index);
    setEditAmount(String(entry.amount));
    setEditDate(toDateInputValue(entry.date) || '');
    setEditDescription(entry.description || '');
    setError('');
  }

  async function saveEdit(index) {
    setBusy(true);
    setError('');
    try {
      await api.updateOtherExpense(tripId, index, { amount: Number(editAmount), date: editDate, description: editDescription });
      setEditingIndex(null);
      await reload();
    } catch (err) {
      setError(errorMessage(err, 'Failed to update other expense'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(index) {
    if (!(await confirm('Delete this other expense?'))) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteOtherExpense(tripId, index);
      await reload();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete other expense'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Other Expenses</SectionTitle>
      <ErrorText>{error}</ErrorText>
      {entries.length === 0 ? <Muted>No other expenses added yet.</Muted> : null}
      {entries.map((entry, index) => (
        editingIndex === index ? (
          <EditBox key={index}>
            <Field label="Description"><Input value={editDescription} onChangeText={setEditDescription} /></Field>
            <Field label="Amount (Rs)"><NumberInput value={editAmount} onChangeText={setEditAmount} /></Field>
            <DateField label="Date" value={editDate} onChange={setEditDate} min={minDate} max={maxDate} />
            <ButtonRow>
              <Button title="Save" onPress={() => saveEdit(index)} loading={busy} style={{ flex: 1 }} />
              <Button title="Cancel" variant="secondary" onPress={() => setEditingIndex(null)} disabled={busy} style={{ flex: 1 }} />
            </ButtonRow>
          </EditBox>
        ) : (
          <EntryRow
            key={index}
            title={`${entry.description || '-'}  -  Rs ${entry.amount}`}
            subtitle={[formatDate(entry.date), entry.photo?.url ? 'Photo attached' : null].filter(Boolean).join(' | ')}
          >
            {!locked && (
              <>
                <Button title="Edit" variant="secondary" onPress={() => startEdit(index, entry)} disabled={busy} />
                <Button title="Delete" variant="danger" onPress={() => remove(index)} disabled={busy} />
              </>
            )}
          </EntryRow>
        )
      ))}
      {!locked && (
        <View style={{ marginTop: spacing.md }}>
          <LocationPicker
            label="Category"
            value={category}
            onChange={setCategory}
            options={OTHER_EXPENSE_CATEGORIES}
            placeholder="Select or enter description"
          />
          <Field label="Amount (Rs)"><NumberInput value={amount} onChangeText={setAmount} /></Field>
          <DateField label="Date" value={date} onChange={setDate} min={minDate} max={maxDate} />
          <PhotoPicker label="Photo (optional)" asset={photo} onChange={setPhoto} />
          <Button title="Add" onPress={submit} loading={busy} disabled={!amount} />
        </View>
      )}
    </Card>
  );
}
