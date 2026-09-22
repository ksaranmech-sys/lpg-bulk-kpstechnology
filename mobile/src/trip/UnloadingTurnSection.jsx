import React, { useState } from 'react';
import { View } from 'react-native';
import { formatDate, toDateInputValue } from '@kps/shared';
import { api, errorMessage } from '../api';
import { Button, Card, DateField, ErrorText, Field, Muted, NumberInput } from '../ui';
import { spacing } from '../theme';
import { SummaryChips, confirm } from './common';

export default function UnloadingTurnSection({ trip, reload, locked, onAdded = reload }) {
  const tripId = trip._id;
  const hasDetails = trip.unTurnNumber != null && trip.unTurnDate;
  const [turnNumber, setTurnNumber] = useState(trip.unTurnNumber != null ? String(trip.unTurnNumber) : '');
  const [turnDate, setTurnDate] = useState(toDateInputValue(trip.unTurnDate) || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.setUnloadingTurnDetails(tripId, { turnNumber: Number(turnNumber), turnDate });
      await onAdded();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save Unload Turn details.'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTurn() {
    if (!(await confirm('Delete this Unload Turn?'))) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteUnloadingTurnDetails(tripId);
      setTurnNumber(''); setTurnDate('');
      await reload();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete Unload Turn.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Unload Turn">
      <ErrorText>{error}</ErrorText>
      {hasDetails ? (
        <View>
          <SummaryChips
            items={[
              { label: 'Turn', value: String(trip.unTurnNumber) },
              { value: formatDate(trip.unTurnDate), muted: true },
            ]}
          />
          {!locked && (
            <Button title="Delete" variant="danger" onPress={deleteTurn} loading={busy} style={{ marginTop: spacing.md }} />
          )}
        </View>
      ) : locked ? (
        <Muted>No Unload Turn added.</Muted>
      ) : (
        <View>
          <Field label="Turn Number"><NumberInput value={turnNumber} onChangeText={setTurnNumber} keyboardType="number-pad" /></Field>
          <DateField label="Turn Date" value={turnDate} onChange={setTurnDate} min={toDateInputValue(trip.loadingDate)} />
          <Button title="Save" onPress={submit} loading={busy} disabled={!turnNumber || !turnDate} />
        </View>
      )}
    </Card>
  );
}
