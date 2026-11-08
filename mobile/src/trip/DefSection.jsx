import React, { useState } from 'react';
import { View } from 'react-native';
import { formatDate } from '@kps/shared';
import { api, errorMessage } from '../api';
import { Button, Card, DateField, ErrorText, Field, Muted, NumberInput } from '../ui';
import { spacing } from '../theme';
import { EntryRow, SectionTitle, confirm } from './common';
import { getEntryMaxDate, getEntryMinDate } from './tripDates';

export default function DefSection({ trip, reload, locked, onAdded = reload }) {
  const entries = trip.defEntries || [];
  const [volume, setVolume] = useState('');
  const [filledAt, setFilledAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function addEntry() {
    if (!Number.isFinite(Number(volume)) || Number(volume) <= 0) {
      setError('DEF volume must be a positive number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.addDefEntry(trip._id, { volumeLitres: Number(volume), filledAt: filledAt || undefined });
      setVolume('');
      setFilledAt('');
      await onAdded();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Failed to add DEF entry'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(index) {
    if (!(await confirm('Delete this DEF entry?'))) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteDefEntry(trip._id, index);
      await reload();
    } catch (requestError) {
      setError(errorMessage(requestError, 'Failed to delete DEF entry'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>DEF (AdBlue)</SectionTitle>
      <ErrorText>{error}</ErrorText>
      {entries.length === 0 && locked ? <Muted>No DEF entries added.</Muted> : null}
      {entries.map((entry, index) => (
        <EntryRow key={entry._id || index} title={`${entry.volumeLitres} L`} subtitle={formatDate(entry.filledAt)}>
          {!locked && <Button title="Delete" variant="danger" onPress={() => deleteEntry(index)} disabled={busy} />}
        </EntryRow>
      ))}
      {!locked && (
        <View style={{ marginTop: spacing.md }}>
          <Field label="DEF Volume (Litres)"><NumberInput value={volume} onChangeText={setVolume} /></Field>
          <DateField
            label="Date"
            value={filledAt}
            onChange={setFilledAt}
            min={getEntryMinDate(trip)}
            max={getEntryMaxDate(trip)}
          />
          <Button title="Add DEF" onPress={addEntry} loading={busy} disabled={!volume || !filledAt} />
        </View>
      )}
    </Card>
  );
}
