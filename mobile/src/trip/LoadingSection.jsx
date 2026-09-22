import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { formatDate, toDateInputValue } from '@kps/shared';
import { api, assetToUploadFile, errorMessage } from '../api';
import { Button, Card, DateField, ErrorText, Field, Muted, NumberInput, PhotoPicker } from '../ui';
import { spacing } from '../theme';
import { ButtonRow, LocationPicker, SummaryChips } from './common';

function LoadingForm({ trip, meta, onSaved, onCancel }) {
  const [loadingLocation, setLocation] = useState(trip.loadingLocation || '');
  const [loadingDate, setDate] = useState(toDateInputValue(trip.loadingDate) || '');
  const [cleanerExpense, setCleanerExpense] = useState(trip.loadingExpense ? String(trip.loadingExpense) : '');
  const [turn, setTurn] = useState(trip.turnExpense ? String(trip.turnExpense) : '');
  const [parking, setParking] = useState(trip.parkingExpense ? String(trip.parkingExpense) : '');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loadingOptions = Array.from(new Set((meta.routeKmTable || []).map((row) => row.loadingLocation).filter(Boolean)));

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.setLoadingDetailsWithPhoto(
        trip._id,
        {
          loadingLocation,
          loadingDate,
          loadingExpense: Number(cleanerExpense || 0),
          turnExpense: Number(turn || 0),
          parkingExpense: Number(parking || 0),
        },
        assetToUploadFile(photo)
      );
      setPhoto(null);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save loading details.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <ErrorText>{error}</ErrorText>
      <LocationPicker
        label="Loading Location"
        value={loadingLocation}
        onChange={setLocation}
        options={loadingOptions}
        placeholder="Select or enter loading location"
      />
      <DateField label="Date of Loading" value={loadingDate} onChange={setDate} min={toDateInputValue(trip.entryMinDate)} />
      <Field label="Loading Cleaner Expense (Rs)"><NumberInput value={cleanerExpense} onChangeText={setCleanerExpense} /></Field>
      <Field label="Turn (Rs)"><NumberInput value={turn} onChangeText={setTurn} /></Field>
      <Field label="Parking (Rs)"><NumberInput value={parking} onChangeText={setParking} /></Field>
      <PhotoPicker label="Parking Photo" asset={photo} onChange={setPhoto} />
      <ButtonRow>
        <Button title="Save" onPress={submit} loading={busy} disabled={!loadingDate} style={{ flex: 1 }} />
        {onCancel && <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={busy} style={{ flex: 1 }} />}
      </ButtonRow>
    </View>
  );
}

function LoadingSummary({ trip, onEdit }) {
  return (
    <View>
      <SummaryChips
        items={[
          { value: trip.loadingLocation || '-' },
          { value: trip.loadingDate ? formatDate(trip.loadingDate) : '-', muted: true },
          { label: 'Cleaner', value: `Rs ${trip.loadingExpense || 0}` },
          { label: 'Turn', value: `Rs ${trip.turnExpense || 0}` },
          { label: 'Parking', value: `Rs ${trip.parkingExpense || 0}` },
        ]}
      />
      {trip.parkingPhoto?.url ? (
        <View style={styles.photoRow}>
          <Image source={{ uri: trip.parkingPhoto.url }} style={styles.thumb} />
          <Muted>Parking photo</Muted>
        </View>
      ) : null}
      {onEdit && <Button title="Edit" variant="secondary" onPress={onEdit} style={{ marginTop: spacing.md }} />}
    </View>
  );
}

export default function LoadingSection({ trip, meta, reload, locked, onAdded = reload }) {
  const [editing, setEditing] = useState(false);
  const hasLoadingDetails = Boolean(trip.loadingLocation && trip.loadingDate);
  const showForm = !locked && (!hasLoadingDetails || editing);

  return (
    <Card title="Loading Details & Expenses">
      {hasLoadingDetails && !showForm && (
        <LoadingSummary trip={trip} onEdit={locked ? null : () => setEditing(true)} />
      )}
      {showForm && (
        <LoadingForm
          trip={trip}
          meta={meta}
          onSaved={async () => { setEditing(false); await (hasLoadingDetails ? reload() : onAdded()); }}
          onCancel={hasLoadingDetails ? () => setEditing(false) : null}
        />
      )}
      {locked && !hasLoadingDetails && <Muted>No loading details added.</Muted>}
    </Card>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#e2e8f0' },
});
