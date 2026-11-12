import React, { useState } from 'react';
import { Card, Muted, Select } from '../../ui';
import { spacing } from '../../theme';
import ReminderEditor from './ReminderEditor';

export default function VehicleRemindersCard({ vehicles, onVehicleUpdated }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const vehicle = vehicles.find((entry) => String(entry._id) === selectedVehicleId);

  return (
    <Card title="Reminder / Expiry Dates">
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
      {vehicle
        ? <ReminderEditor vehicle={vehicle} onSaved={onVehicleUpdated} variant="days" title="" />
        : <Muted style={{ marginTop: spacing.sm }}>Select a vehicle to view reminder and expiry dates.</Muted>}
    </Card>
  );
}
