import React, { useState } from 'react';
import { Card, Muted, Select } from '../../ui';
import DriverTripsByMonth from '../drivers/DriverTripsByMonth';

// Port of the web OpenTripsCard vehicle picker: choose a vehicle to see its open and closed trips.
export default function TripHistoryCard({ vehicles, setError }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const vehicle = vehicles.find((entry) => String(entry._id) === selectedVehicleId);

  return (
    <>
      <Card title="Trip History">
        <Muted style={{ marginBottom: 8 }}>Total Vehicles: {vehicles.length}</Muted>
        <Select
          label="Select Vehicle"
          value={selectedVehicleId}
          options={vehicles.map((entry) => ({ value: String(entry._id), label: entry.vehicleNumber }))}
          onChange={setSelectedVehicleId}
          placeholder="No vehicles found"
        />
        {!vehicle ? <Muted>Select a vehicle to view trip history.</Muted> : null}
      </Card>
      {vehicle ? <DriverTripsByMonth vehicle={vehicle} setError={setError} title={`Trips - ${vehicle.vehicleNumber}`} /> : null}
    </>
  );
}
