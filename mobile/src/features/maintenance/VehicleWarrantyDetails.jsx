import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { toDateInputValue } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, DateField, ErrorText, Field, Input, Muted, NumberInput, Row } from '../../ui';
import { spacing } from '../../theme';

function warrantyRows(details = []) {
  return details.map((detail) => ({
    name: String(detail.name || '').trim(),
    installationDate: toDateInputValue(detail.installationDate) || '',
    warrantyPeriod: String(detail.warrantyPeriod || ''),
    odometerReading: detail.odometerReading == null ? '' : String(detail.odometerReading),
  }));
}

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

export default function VehicleWarrantyDetails({ vehicle, onVehicleUpdated }) {
  const [details, setDetails] = useState(() => warrantyRows(vehicle?.warrantyDetails));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDetails(warrantyRows(vehicle?.warrantyDetails));
    setEditing(false);
    setError('');
  }, [vehicle?._id, vehicle?.warrantyDetails]);

  useEffect(() => {
    setMessage('');
  }, [vehicle?._id]);

  function updateDetail(index, field, value) {
    setDetails((current) => current.map((detail, rowIndex) => (
      rowIndex === index ? { ...detail, [field]: value } : detail
    )));
  }

  function addComponent() {
    setDetails((current) => [...current, {
      name: '',
      installationDate: '',
      warrantyPeriod: '',
      odometerReading: '',
    }]);
    setError('');
    setMessage('');
  }

  function cancelEditing() {
    setDetails(warrantyRows(vehicle?.warrantyDetails));
    setEditing(false);
    setError('');
    setMessage('');
  }

  async function saveWarranties() {
    const names = details.map((detail) => detail.name.trim().toLowerCase());
    if (names.some((name, index) => !name || names.indexOf(name) !== index)) {
      setError('Each warranty detail must have a unique name.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.updateVehicleWarranties(vehicle._id, details.map((detail) => ({
        name: detail.name.trim(),
        installationDate: detail.installationDate || null,
        warrantyPeriod: detail.warrantyPeriod.trim(),
        odometerReading: numberOrNull(detail.odometerReading),
      })));
      onVehicleUpdated?.(response.data.vehicle);
      setEditing(false);
      setMessage('Warranty details saved.');
    } catch (err) {
      setError(errorMessage(err, 'Failed to save warranty details.'));
    } finally {
      setSaving(false);
    }
  }

  if (!vehicle) return null;

  return (
    <Card title={`Warranty Details - ${vehicle.vehicleNumber}`}>
      {details.length === 0 && !editing ? <Muted>No warranty details added.</Muted> : details.map((detail, index) => (
        <View
          key={`warranty-${index}`}
          style={{ marginBottom: spacing.md, padding: spacing.sm, borderWidth: 1, borderColor: '#d5e0e7', borderRadius: 8 }}
        >
          {editing ? (
            <>
              <Field label="Name">
                <Input
                  accessibilityLabel={`Warranty name ${index + 1}`}
                  value={detail.name}
                  maxLength={50}
                  onChangeText={(value) => updateDetail(index, 'name', value)}
                />
              </Field>
              <DateField
                label="Installation Date"
                value={detail.installationDate}
                onChange={(value) => updateDetail(index, 'installationDate', value)}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Field label="Warranty Period" style={{ flex: 1 }}>
                  <Input
                    accessibilityLabel={`Warranty period ${index + 1}`}
                    value={detail.warrantyPeriod}
                    maxLength={50}
                    onChangeText={(value) => updateDetail(index, 'warrantyPeriod', value)}
                  />
                </Field>
                <Field label="Odometer Reading" style={{ flex: 1 }}>
                  <NumberInput
                    accessibilityLabel={`Warranty odometer reading ${index + 1}`}
                    value={detail.odometerReading}
                    keyboardType="number-pad"
                    onChangeText={(value) => updateDetail(index, 'odometerReading', value.replace(/\D/g, ''))}
                  />
                </Field>
              </View>
              <Button
                title="Delete"
                variant="danger"
                onPress={() => setDetails((current) => current.filter((_, rowIndex) => rowIndex !== index))}
              />
            </>
          ) : (
            <>
              <Row label="Name" value={detail.name || '-'} />
              <Row label="Installation Date" value={detail.installationDate || '-'} />
              <Row label="Warranty Period" value={detail.warrantyPeriod || '-'} />
              <Row label="Odometer Reading" value={detail.odometerReading || '-'} />
            </>
          )}
        </View>
      ))}
      <ErrorText>{error}</ErrorText>
      {message ? <Muted style={{ marginBottom: spacing.sm, color: '#1a7f4b' }}>{message}</Muted> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {editing ? (
          <>
            <Button title="Add component" variant="secondary" onPress={addComponent} style={{ flex: 1 }} />
            <Button title="Cancel" variant="secondary" onPress={cancelEditing} disabled={saving} style={{ flex: 1 }} />
            <Button title="Save" onPress={saveWarranties} loading={saving} style={{ flex: 1 }} />
          </>
        ) : <Button title="Edit" onPress={() => { setError(''); setMessage(''); setEditing(true); }} />}
      </View>
    </Card>
  );
}
