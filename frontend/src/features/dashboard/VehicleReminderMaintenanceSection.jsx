import React, { useEffect, useState } from 'react';
import VehicleReminderEditor from './VehicleReminderEditor';
import VehicleMaintenanceSection from './VehicleMaintenanceSection';

export default function VehicleReminderMaintenanceSection({
  vehicles,
  loading,
  setVehicles,
  onVehicleUpdated,
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  useEffect(() => {
    setSelectedVehicleId((currentId) => (
      vehicles.some((vehicle) => String(vehicle._id) === String(currentId))
        ? currentId
        : vehicles[0]?._id || ''
    ));
  }, [vehicles]);

  if (loading) return (
    <section className="card" style={{ order: 9999 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Vehicle Reminders &amp; Maintenance</h3>
      <p>Loading vehicles...</p>
    </section>
  );

  if (vehicles.length === 0) return null;

  return (
    <section className="card" data-dashboard-section="vehicle-reminders-maintenance" style={{ order: 9999 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Vehicle Reminders &amp; Maintenance</h3>
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="reminder-maintenance-vehicle">Select Vehicle</label>
        <select
          id="reminder-maintenance-vehicle"
          value={selectedVehicleId}
          onChange={(event) => setSelectedVehicleId(event.target.value)}
        >
          {vehicles.map((vehicle) => (
            <option key={vehicle._id} value={vehicle._id}>
              {vehicle.vehicleNumber}{vehicle.driverName ? ` | ${vehicle.driverName}` : ''}
            </option>
          ))}
        </select>
      </div>

      <h4 className="section-title" style={{ marginBottom: 12 }}>Reminder / Expiry Dates</h4>
      <VehicleReminderEditor
        vehicles={vehicles}
        setVehicles={setVehicles}
        selectedVehicleId={selectedVehicleId}
        onSelectedVehicleId={setSelectedVehicleId}
        hideVehicleSelector
        hideHeading
      />

      <h4 className="section-title" style={{ marginTop: 24, marginBottom: 12 }}>Vehicle Maintenance</h4>
      <VehicleMaintenanceSection
        vehicles={vehicles}
        loading={loading}
        onVehicleUpdated={onVehicleUpdated}
        selectedVehicleId={selectedVehicleId}
        onSelectedVehicleId={setSelectedVehicleId}
        hideVehicleSelector
        hideHeading
      />
    </section>
  );
}
