import React, { useEffect, useState } from 'react';
import DieselVerificationSection from './DieselVerificationSection';
import AdvanceVerificationSection from './AdvanceVerificationSection';

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function VerificationCombinedSection({ vehicles, loading }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [month, setMonth] = useState(currentMonth);

  useEffect(() => {
    setSelectedVehicleId((currentId) => (
      vehicles.some((vehicle) => String(vehicle._id) === String(currentId))
        ? currentId
        : String(vehicles[0]?._id || '')
    ));
  }, [vehicles]);

  if (loading) {
    return (
      <section className="card" data-dashboard-section="verification" style={{ order: 9999 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Diesel, DEF &amp; Advance Verification</h3>
        <p>Loading vehicles...</p>
      </section>
    );
  }

  if (vehicles.length === 0) {
    return (
      <section className="card" data-dashboard-section="verification" style={{ order: 9999 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>Diesel, DEF &amp; Advance Verification</h3>
        <p>No vehicles available for verification.</p>
      </section>
    );
  }

  return (
    <section className="card" data-dashboard-section="verification" style={{ order: 9999 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Diesel, DEF &amp; Advance Verification</h3>
      <div style={{ display: 'flex', alignItems: 'end', gap: 14, flexWrap: 'wrap' }}>
        <div className="field" style={{ minWidth: 220 }}>
          <label htmlFor="verification-vehicle">Select Vehicle</label>
          <select
            id="verification-vehicle"
            value={selectedVehicleId}
            onChange={(event) => setSelectedVehicleId(event.target.value)}
          >
            {vehicles.map((vehicle) => (
              <option key={vehicle._id} value={String(vehicle._id)}>
                {vehicle.vehicleNumber}{vehicle.driverName ? ` | ${vehicle.driverName}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="verification-month">Report Month</label>
          <input
            id="verification-month"
            type="month"
            required
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </div>

      <h4 className="section-title" style={{ marginTop: 20, marginBottom: 12 }}>Diesel Verification &amp; DEF</h4>
      <DieselVerificationSection
        vehicles={vehicles}
        loading={false}
        selectedVehicleId={selectedVehicleId}
        month={month}
        onSelectedVehicleId={setSelectedVehicleId}
        onMonth={setMonth}
        hideVehicleSelector
        hideMonthSelector
        hideHeading
      />

      <h4 className="section-title" style={{ marginTop: 24, marginBottom: 12 }}>Advance Verification</h4>
      <AdvanceVerificationSection
        vehicles={vehicles}
        loading={false}
        selectedVehicleId={selectedVehicleId}
        month={month}
        onSelectedVehicleId={setSelectedVehicleId}
        onMonth={setMonth}
        hideVehicleSelector
        hideMonthSelector
        hideHeading
      />
    </section>
  );
}
