import React from 'react';

export default function UserAccountCard({ user, vehicle }) {
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>User Account</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span><strong>Name:</strong> {user.name || 'Unnamed user'}</span>
        <span><strong>Mobile Number:</strong> {user.mobileNumber || 'No phone'}</span>
        <span><strong>Vehicle:</strong> {vehicle.vehicleNumber}</span>
      </div>
    </div>
  );
}
