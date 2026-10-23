import React, { useEffect, useState } from 'react';
import VehicleMaintenance from '../driver/VehicleMaintenance';

export default function VehicleMaintenanceSection({ vehicles, loading, onVehicleUpdated }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const selectedVehicle = vehicles.find((vehicle) => String(vehicle._id) === String(selectedVehicleId));

  useEffect(() => {
    setSelectedVehicleId((currentId) => (
      vehicles.some((vehicle) => String(vehicle._id) === String(currentId))
        ? currentId
        : vehicles[0]?._id || ''
    ));
  }, [vehicles]);

  return (
    <section className="card" aria-labelledby="admin-maintenance-title" style={{ order: 9999 }}>
      <h3 id="admin-maintenance-title" className="section-title" style={{ marginTop: 0 }}>
        Vehicle Maintenance
      </h3>
      {loading ? <p>Loading vehicles...</p> : vehicles.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No vehicles available for maintenance.</p>
      ) : (
        <>
          <div className="field" style={{ maxWidth: 420 }}>
            <label htmlFor="maintenance-vehicle">Select Vehicle</label>
            <select
              id="maintenance-vehicle"
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
