import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { VEHICLE_CORPORATIONS, VEHICLE_NUMBER_PATTERN } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, ErrorText, Field, Input, Muted, NavRow, Select } from '../../ui';
import { spacing } from '../../theme';

// Port of VehiclesTable: list (tap for trip history) plus "Add Vehicle" for super_admin.
export default function VehiclesList({ customerId, data, setData, canAdd }) {
  const router = useRouter();
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [corporation, setCorporation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function addVehicle() {
    setError('');
    setSaving(true);
    try {
      const res = await api.addVehicleToCustomer(customerId, { vehicleNumber, corporation });
      setData((current) => ({
        ...current,
        vehicles: [...current.vehicles, res.data.vehicle].sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber)),
      }));
      setVehicleNumber('');
      setCorporation('');
    } catch (err) {
      setError(errorMessage(err, 'Failed to add vehicle'));
    } finally {
      setSaving(false);
    }
  }

  const vehicles = data?.vehicles || [];

  return (
    <Card title="Vehicle Number | Corporation | Driver Name">
      {vehicles.length === 0 ? <Muted>No vehicles found.</Muted> : null}
      {vehicles.map((vehicle) => (
        <NavRow
          key={vehicle._id}
          title={`${vehicle.vehicleNumber} | ${vehicle.driverName || 'Not assigned'}`}
          subtitle="Trip history"
          onPress={() => router.push(`/vehicles/${vehicle._id}`)}
        />
      ))}
      {canAdd && (
        <View style={{ marginTop: spacing.lg }}>
          <Field label="Vehicle Number">
            <Input value={vehicleNumber} onChangeText={(value) => setVehicleNumber(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} />
          </Field>
          <Select label="Corporation" value={corporation} options={[...VEHICLE_CORPORATIONS]} onChange={setCorporation} />
          <ErrorText>{error}</ErrorText>
          <Button title="Add Vehicle" onPress={addVehicle} loading={saving} disabled={!VEHICLE_NUMBER_PATTERN.test(vehicleNumber.trim()) || !corporation} />
        </View>
      )}
    </Card>
  );
}
