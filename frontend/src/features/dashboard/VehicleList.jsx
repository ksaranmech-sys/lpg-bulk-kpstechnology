import React from 'react';

export default function VehicleList({ selectedCustomerId, loading, vehicles }) {
  return (
    <div className="card superadmin-vehicle-list" style={{ marginTop: 14 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Vehicles</h3>
      {!selectedCustomerId ? (
        <p style={{ margin: 0, color: '#666' }}>Select a customer to view vehicles.</p>
      ) : loading ? (
        <p style={{ margin: 0, color: '#666' }}>Loading vehicles...</p>
      ) : vehicles.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No vehicles found for the selected customer.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {vehicles.map((vehicle) => (
            <div key={vehicle._id} className="list-item" style={{ marginBottom: 0 }}>
              <div>
                <strong>{vehicle.vehicleNumber}</strong>
                <div style={{ color: '#666', fontSize: 12 }}>
                  Driver: {vehicle.driverName || 'Not assigned'}
                  {vehicle.driverMobile ? ` | ${vehicle.driverMobile}` : ''}
                </div>
              </div>
              <span className={`badge ${vehicle.driverName ? 'closed' : 'open'}`}>
                {vehicle.driverName ? 'Assigned' : 'Unassigned'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
