import React, { useEffect, useState } from 'react';
import VehicleMaintenance from '../driver/VehicleMaintenance';

export default function VehicleMaintenanceSection({
  vehicles,
  loading,
  onVehicleUpdated,
  selectedVehicleId: controlledVehicleId,
  onSelectedVehicleId,
  hideVehicleSelector = false,
  hideHeading = false,
}) {
  const [internalVehicleId, setInternalVehicleId] = useState('');
  const selectedVehicleId = controlledVehicleId ?? internalVehicleId;
  const selectedVehicle = vehicles.find((vehicle) => String(vehicle._id) === String(selectedVehicleId));

  useEffect(() => {
    const validId = vehicles.some((vehicle) => String(vehicle._id) === String(selectedVehicleId))
      ? selectedVehicleId
      : vehicles[0]?._id || '';
    if (onSelectedVehicleId) onSelectedVehicleId(validId);
    else setInternalVehicleId(validId);
  }, [vehicles, selectedVehicleId, onSelectedVehicleId]);

  return (
    <section className={!hideHeading ? 'card' : undefined} aria-labelledby={hideHeading ? undefined : 'admin-maintenance-title'} style={!hideHeading ? { order: 9999 } : undefined}>
      {!hideHeading && (
        <h3 id="admin-maintenance-title" className="section-title" style={{ marginTop: 0 }}>
          Vehicle Maintenance
        </h3>
      )}
      {loading ? <p>Loading vehicles...</p> : vehicles.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No vehicles available for maintenance.</p>
      ) : (
        <>
          {!hideVehicleSelector && (
            <div className="field" style={{ maxWidth: 420 }}>
              <label htmlFor="maintenance-vehicle">Select Vehicle</label>
              <select
                id="maintenance-vehicle"
                value={selectedVehicleId}
                onChange={(event) => {
                  if (onSelectedVehicleId) onSelectedVehicleId(event.target.value);
                  else setInternalVehicleId(event.target.value);
                }}
              >
                {vehicles.map((vehicle) => (
                  <option key={vehicle._id} value={vehicle._id}>
                    {vehicle.vehicleNumber}{vehicle.driverName ? ` | ${vehicle.driverName}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <VehicleMaintenance
            key={selectedVehicle?._id || 'no-vehicle'}
            vehicle={selectedVehicle}
            onVehicleUpdated={onVehicleUpdated}
          />
        </>
      )}
    </section>
  );
}
