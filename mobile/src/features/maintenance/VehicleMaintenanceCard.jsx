import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Card, ErrorText, Field, Input, Muted, Select, Button } from '../../ui';
import { api, errorMessage } from '../../api';
import { spacing } from '../../theme';

const STANDARD_COMPONENTS = [
  'Engine Oil',
  'Gear Oil',
  'Clutch Oil',
  'Crown Oil',
  'Wheel Grease',
  'Battery',
  'Tyre Powder',
];

function maintenanceRows(components = []) {
  const byName = new Map(components.map((component) => [String(component.name || '').trim().toLowerCase(), component]));
  const standardRows = STANDARD_COMPONENTS.map((name) => {
    const component = byName.get(name.toLowerCase()) || {};
    byName.delete(name.toLowerCase());
    return {
      name,
      startingOdometerKm: component.startingOdometerKm == null ? '' : String(component.startingOdometerKm),
      expectedKm: component.expectedKm == null ? '' : String(component.expectedKm),
      reminderKm: component.reminderKm == null ? '' : String(component.reminderKm),
      isStandard: true,
    };
  });
  const customRows = [...byName.values()].map((component) => ({
    name: String(component.name || '').trim(),
    startingOdometerKm: component.startingOdometerKm == null ? '' : String(component.startingOdometerKm),
    expectedKm: component.expectedKm == null ? '' : String(component.expectedKm),
    reminderKm: component.reminderKm == null ? '' : String(component.reminderKm),
    isStandard: false,
  }));
  return [...standardRows, ...customRows];
}

function usedKm(component, currentOdometer) {
  if (!component.startingOdometerKm || currentOdometer == null) return '';
  const value = Number(currentOdometer) - Number(component.startingOdometerKm);
  return Number.isFinite(value) && value >= 0 ? String(value) : '';
}

export default function VehicleMaintenanceCard({ vehicles, onVehicleUpdated }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const vehicle = vehicles.find((entry) => String(entry._id) === selectedVehicleId);
  const [components, setComponents] = useState([]);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setComponents(maintenanceRows(vehicle?.maintenanceComponents));
    setNewName('');
    setEditing(false);
    setError('');
    setMessage('');
  }, [vehicle?._id, vehicle?.maintenanceComponents]);

  function updateComponent(index, field, value) {
    setComponents((current) => current.map((component, rowIndex) => (
      rowIndex === index ? { ...component, [field]: value } : component
    )));
  }

  function cancelEdit() {
    setComponents(maintenanceRows(vehicle?.maintenanceComponents));
    setNewName('');
    setEditing(false);
    setError('');
  }

  function addComponent() {
    const name = newName.trim();
    if (!name) return;
    if (components.some((component) => component.name.toLowerCase() === name.toLowerCase())) {
      setError('That maintenance component is already listed.');
      return;
    }
    setComponents((current) => [...current, {
      name,
      startingOdometerKm: '',
      expectedKm: '',
      reminderKm: '',
      isStandard: false,
    }]);
    setNewName('');
    setError('');
  }

  async function save() {
    if (!vehicle) return;
    const names = components.map((component) => component.name.trim().toLowerCase());
    if (names.some((name, index) => !name || names.indexOf(name) !== index)) {
      setError('Each maintenance component must have a unique name.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.updateVehicleMaintenance(vehicle._id, components.map((component) => ({
        name: component.name.trim(),
        startingOdometerKm: component.startingOdometerKm === '' ? null : Number(component.startingOdometerKm),
        expectedKm: component.expectedKm === '' ? null : Number(component.expectedKm),
        reminderKm: component.reminderKm === '' ? null : Number(component.reminderKm),
      })));
      onVehicleUpdated(response.data.vehicle);
      setEditing(false);
      setMessage('Vehicle maintenance saved.');
    } catch (err) {
      setError(errorMessage(err, 'Failed to save vehicle maintenance.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Vehicle Maintenance">
      <Select
        label="Select Vehicle"
        value={selectedVehicleId}
        options={vehicles.map((entry) => ({
          value: String(entry._id),
          label: `${entry.vehicleNumber}${entry.driverName ? ` | ${entry.driverName}` : ''}`,
        }))}
        onChange={setSelectedVehicleId}
        placeholder="Select vehicle"
        dropdown
      />
      {!vehicle ? <Muted>Select a vehicle to view maintenance details.</Muted> : (
        <View>
          <Muted style={{ marginBottom: spacing.md }}>
            Till now KM is calculated from the latest odometer reading.
          </Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {components.map((component, index) => (
              <View
                key={`${component.name}-${index}`}
                style={{ width: '100%', padding: spacing.sm, borderWidth: 1, borderColor: '#d5e0e7', borderRadius: 8 }}
              >
                {component.isStandard ? (
                  <Muted style={{ color: '#152936', fontWeight: '700', marginBottom: spacing.xs }}>{component.name}</Muted>
                ) : (
                  <Field label="Component Name">
                    <Input
                      value={component.name}
                      editable={editing}
                      maxLength={50}
                      onChangeText={(value) => updateComponent(index, 'name', value)}
                    />
                  </Field>
                )}
                <Field label="Starting Odometer (km)">
                  <Input
                    value={component.startingOdometerKm}
                    editable={editing}
                    keyboardType="number-pad"
                    onChangeText={(value) => updateComponent(index, 'startingOdometerKm', value.replace(/\D/g, ''))}
                  />
                </Field>
                <Field label="Till now KM">
                  <Input value={usedKm(component, vehicle.lastKnownOdometer)} editable={false} placeholder="Calculated automatically" />
                </Field>
                <Field label="Expected KM">
                  <Input
                    value={component.expectedKm}
                    editable={editing}
                    keyboardType="number-pad"
                    onChangeText={(value) => updateComponent(index, 'expectedKm', value.replace(/\D/g, ''))}
                  />
                </Field>
                <Field label="Reminder KM">
                  <Input
                    value={component.reminderKm}
                    editable={editing}
                    keyboardType="number-pad"
                    onChangeText={(value) => updateComponent(index, 'reminderKm', value.replace(/\D/g, ''))}
                  />
                </Field>
              </View>
            ))}
          </View>
          {editing && (
            <Field label="Manual Entry">
              <Input value={newName} onChangeText={setNewName} placeholder="Enter component name" maxLength={50} />
            </Field>
          )}
          <ErrorText>{error}</ErrorText>
          {message ? <Muted style={{ marginVertical: spacing.sm, color: '#1a7f4b' }}>{message}</Muted> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            {editing ? (
              <>
                <Button title="Add Component" variant="secondary" onPress={addComponent} style={{ flex: 1 }} />
                <Button title="Cancel" variant="secondary" onPress={cancelEdit} disabled={saving} style={{ flex: 1 }} />
                <Button title="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
              </>
            ) : <Button title="Edit" onPress={() => { setMessage(''); setEditing(true); }} />}
          </View>
        </View>
      )}
    </Card>
  );
}
