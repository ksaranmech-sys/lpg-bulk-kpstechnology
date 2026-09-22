import React, { useState } from 'react';
import { View } from 'react-native';
import { formatDate, toDateInputValue } from '@kps/shared';
import { api, errorMessage } from '../api';
import { Button, Card, DateField, ErrorText, Field, Muted, NumberInput, Select, Toggle } from '../ui';
import { spacing } from '../theme';
import { ButtonRow, LocationPicker, SummaryChips, trimText } from './common';

function UnloadingForm({ trip, meta, routeUnloadingOptions, onSaved, onCancel }) {
  const table = meta.routeKmTable || [];
  const [unloadingLocation, setLoc] = useState(trip.unloadingLocation || '');
  const [unloadingDate, setDate] = useState(toDateInputValue(trip.unloadingDate) || '');
  const [manualKm, setManualKm] = useState(trip.manualKm != null ? String(trip.manualKm) : '');
  const [manualKmDivert, setManualKmDivert] = useState(trip.manualKmDivert != null ? String(trip.manualKmDivert) : '');
  const [isDiverted, setIsDiverted] = useState(Boolean(trip.isDiverted));
  const [divertUnloadingLocation, setDivertUnloadingLocation] = useState(trip.divertUnloadingLocation || '');
  const [divertDate, setDivertDate] = useState(toDateInputValue(trip.divertDate) || '');
  const [selectedCorporation, setSelectedCorporation] = useState(() => {
    if (!trip.unloadingLocation) return '';
    const match = table.find((row) => trimText(row?.unloadingLocation) === trimText(trip.unloadingLocation));
    return match?.corporation || '';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const corporations = Array.from(new Set(table.map((row) => row.corporation).filter(Boolean)));
  const filteredUnloadingOptions = routeUnloadingOptions.filter((loc) => (
    !selectedCorporation || table.some((row) => (
      trimText(row?.unloadingLocation) === trimText(loc) && trimText(row?.corporation) === trimText(selectedCorporation)
    ))
  ));
  const hasFirstLegInTable = table.some((row) => (
    trimText(row?.loadingLocation) === trimText(trip.loadingLocation) && trimText(row?.unloadingLocation) === trimText(unloadingLocation)
  ));
  const hasSecondLegInTable = table.some((row) => (
    trimText(row?.loadingLocation) === trimText(unloadingLocation) && trimText(row?.unloadingLocation) === trimText(divertUnloadingLocation)
  ));
  // The two manual KM fields cover different legs and are required independently of each other.
  const manualKmLoadRequired = trip.manualKm == null && Boolean(trimText(unloadingLocation)) && !hasFirstLegInTable;
  const manualKmDivertRequired = trip.manualKmDivert == null && isDiverted && Boolean(trimText(divertUnloadingLocation)) && !hasSecondLegInTable;
  // Once a manual KM value has been saved, keep the field visible so it stays editable.
  const manualKmLoadVisible = manualKmLoadRequired || trip.manualKm != null;
  const manualKmDivertVisible = isDiverted && (manualKmDivertRequired || trip.manualKmDivert != null);
  const saveDisabled = (manualKmLoadRequired && manualKm === '') || (manualKmDivertRequired && manualKmDivert === '')
    || !unloadingDate || (isDiverted && (!divertUnloadingLocation || !divertDate));

  function toggleDivert(checked) {
    setIsDiverted(checked);
    // Manual KM Divert only applies while diverted - clear the stale value once undone.
    if (!checked) {
      setManualKmDivert('');
      setDivertUnloadingLocation('');
      setDivertDate('');
    }
  }

  async function submit() {
    if (manualKmLoadRequired && manualKm === '') {
      setError('Please enter Manual KM Load between the loading and unloading location (Round trip).');
      return;
    }
    if (manualKmDivertRequired && manualKmDivert === '') {
      setError('Please enter Manual KM Divert between the unloading location and divert location (Round trip).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.setUnloading(trip._id, {
        unloadingLocation,
        unloadingDate,
        manualKm: manualKm === '' ? undefined : Number(manualKm),
        manualKmDivert: manualKmDivert === '' ? undefined : Number(manualKmDivert),
        isDiverted,
        divertUnloadingLocation: isDiverted ? divertUnloadingLocation : undefined,
        divertDate: isDiverted ? divertDate : undefined,
      });
      await onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save unloading details.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <ErrorText>{error}</ErrorText>
      <Select
        label="Corporation"
        value={selectedCorporation}
        options={corporations}
        placeholder="No corporations in the route table"
        onChange={(next) => { setSelectedCorporation(next); setLoc(''); }}
      />
      <LocationPicker
        label="Unloading Location"
        value={unloadingLocation}
        onChange={setLoc}
        options={filteredUnloadingOptions}
        placeholder="Select or enter unloading location"
      />
      {manualKmLoadVisible && (
        <Field
          label={`Manual KM Load${manualKmLoadRequired ? ' (required)' : ''}`}
          hint={`Enter KM between ${trip.loadingLocation || 'loading location'} and ${unloadingLocation || 'unloading location'} (One Way)`}
        >
          <NumberInput value={manualKm} onChangeText={setManualKm} placeholder={manualKmLoadRequired ? 'Required' : 'Optional'} />
        </Field>
      )}
      <DateField label="Date" value={unloadingDate} onChange={setDate} min={toDateInputValue(trip.unTurnDate)} />
      <Toggle label="Divert" value={isDiverted} onChange={toggleDivert} />
      {isDiverted && (
        <View>
          <LocationPicker
            label="Divert Location"
            value={divertUnloadingLocation}
            onChange={setDivertUnloadingLocation}
            options={routeUnloadingOptions.filter(Boolean)}
            placeholder="Select or enter divert location"
          />
          {manualKmDivertVisible && (
            <Field
              label={`Manual KM Divert${manualKmDivertRequired ? ' (required)' : ''}`}
              hint={`Enter KM between ${unloadingLocation || 'unloading location'} and ${divertUnloadingLocation || 'divert location'} (One Way)`}
            >
              <NumberInput value={manualKmDivert} onChangeText={setManualKmDivert} placeholder={manualKmDivertRequired ? 'Required' : 'Optional'} />
            </Field>
          )}
          <DateField label="Divert Unloading Date" value={divertDate} onChange={setDivertDate} min={unloadingDate || undefined} />
        </View>
      )}
      <ButtonRow>
        <Button title="Save" onPress={submit} loading={busy} disabled={saveDisabled} style={{ flex: 1 }} />
        {onCancel && <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={busy} style={{ flex: 1 }} />}
      </ButtonRow>
    </View>
  );
}

function UnloadingSummary({ trip, onEdit }) {
  const hasManualKm = trip.manualKm != null && trip.manualKm !== '';
  const hasManualKmDivert = trip.isDiverted && trip.manualKmDivert != null && trip.manualKmDivert !== '';
  return (
    <View>
      <SummaryChips
        items={[
          { value: trip.unloadingLocation || '-' },
          { value: trip.unloadingDate ? formatDate(trip.unloadingDate) : '-', muted: true },
          hasManualKm && { label: 'Manual KM Load', value: `${trip.manualKm} km` },
          trip.isDiverted && { label: 'Divert', value: trip.divertUnloadingLocation || '-' },
          trip.isDiverted && { value: trip.divertDate ? formatDate(trip.divertDate) : '-', muted: true },
          hasManualKmDivert && { label: 'Manual KM Divert', value: `${trip.manualKmDivert} km` },
        ]}
      />
      {onEdit && <Button title="Edit" variant="secondary" onPress={onEdit} style={{ marginTop: spacing.md }} />}
    </View>
  );
}

export default function UnloadingSection({ trip, meta, reload, locked, onAdded = reload }) {
  const [editing, setEditing] = useState(false);
  const hasUnloadingDetails = Boolean(trip.unloadingLocation && trip.unloadingDate);
  const showForm = !locked && (!hasUnloadingDetails || editing);
  const routeUnloadingOptions = Array.from(new Set((meta.routeKmTable || []).map((row) => row.unloadingLocation).filter(Boolean)));

  return (
    <Card title="Unloading Details">
      {hasUnloadingDetails && !showForm && (
        <UnloadingSummary trip={trip} onEdit={locked ? null : () => setEditing(true)} />
      )}
      {showForm && (
        <UnloadingForm
          trip={trip}
          meta={meta}
          routeUnloadingOptions={routeUnloadingOptions}
          onSaved={async () => { setEditing(false); await (hasUnloadingDetails ? reload() : onAdded()); }}
          onCancel={hasUnloadingDetails ? () => setEditing(false) : null}
        />
      )}
      {locked && !hasUnloadingDetails && <Muted>No unloading details added.</Muted>}
    </Card>
  );
}
