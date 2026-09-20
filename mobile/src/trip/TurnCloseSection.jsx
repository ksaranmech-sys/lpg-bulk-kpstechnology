import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, toDateInputValue } from '@kps/shared';
import { api, errorMessage } from '../api';
import { Button, Card, DateField, ErrorText, Field, Muted, NumberInput } from '../ui';
import { spacing } from '../theme';
import { ButtonRow, LocationPicker, SummaryChips, trimText } from './common';

function TurnForm({ trip, meta, onCancel }) {
  const router = useRouter();
  const table = meta.routeKmTable || [];
  const [turnNumber, setTurnNumber] = useState(trip.turnNumber != null ? String(trip.turnNumber) : '');
  const [turnDate, setTurnDate] = useState(toDateInputValue(trip.turnDate) || '');
  const [fillingOrderLocation, setFillingOrderLocation] = useState(trip.fillingOrderLocation || '');
  const [manualKmReturn, setManualKmReturn] = useState(trip.manualKmReturn != null ? String(trip.manualKmReturn) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const missingCloseFields = [
    !trimText(trip.loadingLocation) && 'loading location',
    !trip.loadingDate && 'loading date',
    !trimText(trip.unloadingLocation) && 'unloading location',
    !trip.unloadingDate && 'unloading date',
  ].filter(Boolean);
  const loadingLocations = Array.from(new Set(table.map((row) => row.loadingLocation).filter(Boolean)));
  // Manual KM Return covers the fillingOrder -> target leg, where target is the divert
  // unloading location for diverted trips, or the primary unloading location otherwise.
  const isDivertedReturn = Boolean(trip.isDiverted && trip.divertUnloadingLocation);
  const returnTargetLocation = isDivertedReturn ? trip.divertUnloadingLocation : trip.unloadingLocation;
  const hasReturnLegInTable = table.some((row) => (
    trimText(row?.loadingLocation) === trimText(fillingOrderLocation) && trimText(row?.unloadingLocation) === trimText(returnTargetLocation)
  ));
  // Reuse only applies when the reused leg targets the same destination as the return leg.
  const returnLegSameAsLoadLeg = !isDivertedReturn && trimText(fillingOrderLocation) === trimText(trip.loadingLocation);
  const returnLegSameAsDivertLeg = isDivertedReturn && trimText(fillingOrderLocation) === trimText(trip.unloadingLocation);
  const manualKmReturnRequired = trip.manualKmReturn == null
    && Boolean(trimText(fillingOrderLocation))
    && Boolean(trimText(returnTargetLocation))
    && !hasReturnLegInTable
    && !returnLegSameAsLoadLeg
    && !returnLegSameAsDivertLeg;
  // Once a manual KM value has been saved, keep the field visible so it stays editable.
  const manualKmReturnVisible = manualKmReturnRequired || trip.manualKmReturn != null;
  const turnDateFloor = isDivertedReturn ? trip.divertDate : trip.unloadingDate;
  const closeDisabled = missingCloseFields.length > 0 || (manualKmReturnRequired && manualKmReturn === '') || !turnNumber || !turnDate;

  async function closeTrip() {
    setBusy(true);
    setError('');
    try {
      await api.setTurnDetails(trip._id, {
        turnNumber: Number(turnNumber),
        turnDate,
        fillingOrderLocation: fillingOrderLocation || undefined,
        manualKmReturn: manualKmReturn === '' ? undefined : Number(manualKmReturn),
      });
      await api.closeTrip(trip._id);
      // Trip close should return the user to the main dashboard, not stay on this trip.
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err, 'Failed to save Turn details or close trip'));
      setBusy(false);
    }
  }

  function submit() {
    if (missingCloseFields.length > 0) {
      setError(`Add ${missingCloseFields.join(', ')} before closing this trip.`);
      return;
    }
    if (manualKmReturnRequired && manualKmReturn === '') {
      setError(trip.isDiverted
        ? 'Please enter Manual KM Return between the filling order location and divert location (Round trip).'
        : 'Please enter Manual KM Return between the filling order location and unloading location (Round trip).');
      return;
    }
    setError('');
    Alert.alert('Trip close', 'Close this trip now? You will not be able to edit it afterwards.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Trip close', style: 'destructive', onPress: closeTrip },
    ]);
  }

  return (
    <View>
      <ErrorText>{error}</ErrorText>
      <LocationPicker
        label="Filling Order Location"
        value={fillingOrderLocation}
        onChange={setFillingOrderLocation}
        options={loadingLocations}
        placeholder="Select or enter filling order location"
      />
      {manualKmReturnVisible && (
        <Field
          label={`Manual KM Return${manualKmReturnRequired ? ' (required)' : ''}`}
          hint={`Enter KM between ${fillingOrderLocation || 'filling order location'} and ${returnTargetLocation || 'unloading location'} (One Way)`}
        >
          <NumberInput value={manualKmReturn} onChangeText={setManualKmReturn} placeholder={manualKmReturnRequired ? 'Required' : 'Optional'} />
        </Field>
      )}
      <Field label="Turn Number"><NumberInput value={turnNumber} onChangeText={setTurnNumber} keyboardType="number-pad" /></Field>
      <DateField label="Turn Date" value={turnDate} onChange={setTurnDate} min={toDateInputValue(turnDateFloor)} />
      {missingCloseFields.length > 0 && (
        <ErrorText>{`Add ${missingCloseFields.join(', ')} before closing this trip.`}</ErrorText>
      )}
      <ButtonRow>
        <Button title="Trip close" onPress={submit} loading={busy} disabled={closeDisabled} style={{ flex: 1 }} />
        {onCancel && <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={busy} style={{ flex: 1 }} />}
      </ButtonRow>
    </View>
  );
}

function TurnSummary({ trip, onEdit }) {
  const hasManualKmReturn = trip.manualKmReturn != null && trip.manualKmReturn !== '';
  return (
    <View>
      <SummaryChips
        items={[
          { label: 'Turn', value: String(trip.turnNumber) },
          { value: formatDate(trip.turnDate), muted: true },
          trip.fillingOrderLocation && { label: 'Filling order', value: trip.fillingOrderLocation },
          hasManualKmReturn && { label: 'Manual KM Return', value: `${trip.manualKmReturn} km` },
        ]}
      />
      {onEdit && <Button title="Edit" variant="secondary" onPress={onEdit} style={{ marginTop: spacing.md }} />}
    </View>
  );
}

export default function TurnCloseSection({ trip, meta, locked }) {
  const [editing, setEditing] = useState(false);
  const hasTurnDetails = trip.turnNumber != null && trip.turnDate;
  // Keep the editable Load Turn form (and its Manual KM Return field) visible whenever KM
  // couldn't be resolved from the table, even if turn number/date were already saved.
  const manualKmMissingForClose = trip.corporationKmSource === 'manual_required' && trip.manualKmReturn == null;
  const showForm = !locked && (!hasTurnDetails || editing || manualKmMissingForClose);

  return (
    <Card title={hasTurnDetails && !showForm ? 'Load Turn Added' : 'Load Turn'}>
      {hasTurnDetails && !showForm && (
        <TurnSummary trip={trip} onEdit={locked ? null : () => setEditing(true)} />
      )}
      {showForm && (
        <TurnForm trip={trip} meta={meta} onCancel={hasTurnDetails && !manualKmMissingForClose ? () => setEditing(false) : null} />
      )}
      {locked && !hasTurnDetails && <Muted>No Load Turn added.</Muted>}
    </Card>
  );
}
