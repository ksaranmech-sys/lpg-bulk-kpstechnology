import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { VEHICLE_TYRE_POSITIONS } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, ErrorText, Field, Input, Muted, NumberInput } from '../../ui';
import { spacing } from '../../theme';

const compactInputStyle = { paddingHorizontal: spacing.xs, paddingVertical: 6, fontSize: 13, minHeight: 36 };

function tyreRows(tyres = []) {
  return Array.from({ length: 7 }, (_, index) => {
    const tyre = tyres.find((entry) => Number(entry.position) === index + 1) || {};
    return {
      position: index + 1,
      tyreNumber: tyre.tyreNumber || '',
      tyreNumber2: tyre.tyreNumber2 || '',
      installedOdometerKm: tyre.installedOdometerKm == null
        ? (tyre.odometerKm == null ? '' : String(tyre.odometerKm))
        : String(tyre.installedOdometerKm),
      manualMileageKm: tyre.manualMileageKm == null ? '' : String(tyre.manualMileageKm),
      mileageKm: tyre.mileageKm == null ? '' : String(tyre.mileageKm),
      expectedMileageKm: tyre.expectedMileageKm == null ? '' : String(tyre.expectedMileageKm),
    };
  });
}

function mileageUntilNow(tyre, currentOdometer) {
  if (tyre.manualMileageKm !== '') return tyre.manualMileageKm;
  if (tyre.installedOdometerKm === '' || currentOdometer == null) return '';
  const mileage = Number(currentOdometer) - Number(tyre.installedOdometerKm);
  return Number.isFinite(mileage) && mileage >= 0 ? String(mileage) : '';
}

export default function VehicleTyreDetails({ vehicle, onVehicleUpdated }) {
  const [tyres, setTyres] = useState(() => tyreRows(vehicle?.tyres));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTyres(tyreRows(vehicle?.tyres));
  }, [vehicle?._id, vehicle?.tyres]);

  function updateTyre(position, field, value) {
    setTyres((current) => current.map((tyre) => (
      tyre.position === position ? { ...tyre, [field]: value } : tyre
    )));
  }

  async function saveTyres() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.updateVehicleTyres(vehicle._id, tyres.map((tyre) => ({
        ...tyre,
        installedOdometerKm: tyre.installedOdometerKm === '' ? null : Number(tyre.installedOdometerKm),
        manualMileageKm: tyre.manualMileageKm === '' ? null : Number(tyre.manualMileageKm),
        expectedMileageKm: tyre.expectedMileageKm === '' ? null : Number(tyre.expectedMileageKm),
      })));
      onVehicleUpdated?.(response.data.vehicle);
      setMessage('Tyre details saved.');
    } catch (err) {
      setError(errorMessage(err, 'Failed to save tyre details'));
    } finally {
      setSaving(false);
    }
  }

  if (!vehicle) return null;

  return (
    <Card title={`Tyre Details - ${vehicle.vehicleNumber}`}>
      <Muted style={{ marginBottom: spacing.md }}>
        Enter tyre numbers and odometer readings. Mileage is calculated using the vehicle's latest odometer and can be edited.
      </Muted>
      {tyres.map((tyre) => (
        <View key={tyre.position} style={{ marginBottom: spacing.md }}>
          <Muted style={{ fontWeight: '700', marginBottom: spacing.xs }}>{VEHICLE_TYRE_POSITIONS[tyre.position - 1]}</Muted>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Tyre 1" style={styles.rowField}>
                <Input
                  value={tyre.tyreNumber}
                  maxLength={50}
                  onChangeText={(value) => updateTyre(tyre.position, 'tyreNumber', value)}
                  style={compactInputStyle}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Tyre 2" style={styles.rowField}>
                <Input
                  value={tyre.tyreNumber2}
                  maxLength={50}
                  onChangeText={(value) => updateTyre(tyre.position, 'tyreNumber2', value)}
                  style={compactInputStyle}
                />
              </Field>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Field label="Installed ODO (km)" style={styles.mileageField}>
              <NumberInput
                value={tyre.installedOdometerKm}
                keyboardType="number-pad"
                onChangeText={(value) => updateTyre(tyre.position, 'installedOdometerKm', value.replace(/\D/g, ''))}
                style={compactInputStyle}
              />
            </Field>
            <Field label="Mileage up to now (km)" style={styles.mileageField}>
              <NumberInput
                value={mileageUntilNow(tyre, vehicle.lastKnownOdometer)}
                placeholder="Calculated"
                onChangeText={(value) => updateTyre(tyre.position, 'manualMileageKm', value.replace(/\D/g, ''))}
                style={compactInputStyle}
              />
            </Field>
            <Field label="Expected Mileage (km)" style={styles.mileageField}>
              <NumberInput
                value={tyre.expectedMileageKm}
                keyboardType="number-pad"
                onChangeText={(value) => updateTyre(tyre.position, 'expectedMileageKm', value.replace(/\D/g, ''))}
                style={compactInputStyle}
              />
            </Field>
          </View>
        </View>
      ))}
      <ErrorText>{error}</ErrorText>
      {message ? <Muted style={{ color: '#2f855a', marginBottom: spacing.sm }}>{message}</Muted> : null}
      <Button title="Save Tyre Details" onPress={saveTyres} loading={saving} />
    </Card>
  );
}

const styles = {
  rowField: { marginBottom: spacing.sm },
  mileageField: { flex: 1, marginBottom: spacing.sm },
};
