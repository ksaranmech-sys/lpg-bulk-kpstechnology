import React, { useEffect, useState } from 'react';
import VehicleExpensesSection from './VehicleExpensesSection';
import VehicleExpenseManagementSection from './VehicleExpenseManagementSection';

export default function VehicleExpensesCombinedSection({
  vehicles,
  driverUsers = [],
  expenses,
  loading,
  error,
  customerId,
  canManage = false,
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  useEffect(() => {
    setSelectedVehicleId((currentId) => (
      vehicles.some((vehicle) => String(vehicle._id) === String(currentId))
        ? currentId
        : String(vehicles[0]?._id || '')
    ));
  }, [vehicles]);

  if (loading) {
    return (
      <section className="card" data-dashboard-section="vehicle-expenses" style={{ marginTop: 24 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Vehicle Expenses</h3>
        <p>Loading vehicle expenses...</p>
      </section>
    );
  }

  if (vehicles.length === 0) {
    return (
      <section className="card" data-dashboard-section="vehicle-expenses" style={{ marginTop: 24 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Vehicle Expenses</h3>
        <p>No vehicles found.</p>
      </section>
    );
  }

  return (
    <section className="card" data-dashboard-section="vehicle-expenses" style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Vehicle Expenses</h3>
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="combined-expense-vehicle">Vehicle Number</label>
        <select
          id="combined-expense-vehicle"
          value={selectedVehicleId}
          onChange={(event) => setSelectedVehicleId(event.target.value)}
        >
          {vehicles.map((vehicle) => (
            <option key={vehicle._id} value={String(vehicle._id)}>
              {vehicle.vehicleNumber}
            </option>
          ))}
        </select>
      </div>

      <VehicleExpensesSection
        vehicles={vehicles}
        driverUsers={driverUsers}
        expenses={expenses}
        loading={false}
        error={error}
        selectedVehicleId={selectedVehicleId}
        onSelectedVehicleId={setSelectedVehicleId}
        hideVehicleSelector
        hideHeading
      />

      {canManage && (
        <>
          <h4 className="section-title" style={{ marginTop: 24, marginBottom: 12 }}>Manage Vehicle Expenses</h4>
          <VehicleExpenseManagementSection
            vehicles={vehicles}
            customerId={customerId}
            selectedVehicleId={selectedVehicleId}
            onSelectedVehicleId={setSelectedVehicleId}
            hideVehicleSelector
            hideHeading
          />
        </>
      )}
    </section>
  );
}
