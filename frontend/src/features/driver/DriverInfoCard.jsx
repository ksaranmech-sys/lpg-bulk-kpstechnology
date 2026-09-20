import React from 'react';

export default function DriverInfoCard({ driver, vehicle }) {
  return (
    <div className="card">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
        <div><strong>User Name:</strong> {driver.name || 'Unnamed driver'}</div>
        <div><strong>Mobile Number:</strong> {driver.mobileNumber || 'No phone'}</div>
        <div><strong>Vehicle:</strong> {vehicle?.vehicleNumber || 'Unassigned'}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <div><strong>Basic Salary:</strong> {driver.basicSalary ?? 0}</div>
        <div><strong>KM Charges:</strong> {driver.kmCharges ?? 0}</div>
        <div><strong>Less than 200KM Charges:</strong> {driver.minKmCharges ?? 0}</div>
      </div>
      {driver.temporaryDriver?.required && (
        <div style={{ marginTop: 12, color: '#4a5f52' }}>
          <strong>Temporary Driver:</strong> {driver.temporaryDriver.name} (
          {new Date(driver.temporaryDriver.joiningDate).toLocaleDateString('en-IN')} - {driver.temporaryDriver.returningDate ? new Date(driver.temporaryDriver.returningDate).toLocaleDateString('en-IN') : 'Ongoing'})
        </div>
      )}
    </div>
  );
}
