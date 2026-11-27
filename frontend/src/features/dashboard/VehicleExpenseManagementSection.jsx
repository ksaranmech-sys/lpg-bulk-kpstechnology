import React, { useState } from 'react';
import DriverVehicleExpenses from '../driver/DriverVehicleExpenses';

export default function VehicleExpenseManagementSection({
  vehicles,
  customerId,
  selectedVehicleId: controlledVehicleId,
  onSelectedVehicleId,
  hideVehicleSelector = false,
  hideHeading = false,
}) {
  const [internalVehicleId, setInternalVehicleId] = useState('');
  const [error, setError] = useState('');
  const selectedVehicleId = controlledVehicleId ?? internalVehicleId;
  const vehicleId = vehicles.some((vehicle) => String(vehicle._id) === String(selectedVehicleId))
    ? selectedVehicleId
    : String(vehicles[0]?._id || '');
  const vehicle = vehicles.find((entry) => String(entry._id) === vehicleId);
  const expenseCustomerId = vehicle?.customer?._id || vehicle?.customer || customerId;

  return (
    <section className={hideHeading ? '' : 'card'} aria-labelledby={hideHeading ? undefined : 'vehicle-expense-management-title'}>
      {!hideHeading && (
        <h3 id="vehicle-expense-management-title" className="section-title" style={{ marginTop: 0 }}>
          Manage Vehicle Expenses
        </h3>
      )}
      {vehicles.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>Add a vehicle to manage its expenses.</p>
      ) : (
        <>
          {!hideVehicleSelector && (
            <div className="field" style={{ maxWidth: 420 }}>
              <label htmlFor="manage-expense-vehicle">Select Vehicle</label>
              <select
                id="manage-expense-vehicle"
                value={vehicleId}
                onChange={(event) => {
                  if (onSelectedVehicleId) onSelectedVehicleId(event.target.value);
                  else setInternalVehicleId(event.target.value);
                  setError('');
                }}
              >
                {vehicles.map((entry) => (
                  <option key={entry._id} value={String(entry._id)}>
                    {entry.vehicleNumber}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          {vehicle && (
            <DriverVehicleExpenses
              key={vehicle._id}
              customerId={expenseCustomerId}
              vehicle={vehicle}
              setError={setError}
            />
          )}
        </>
      )}
    </section>
  );
}
