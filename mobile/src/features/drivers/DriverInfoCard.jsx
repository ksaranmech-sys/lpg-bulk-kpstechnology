import React from 'react';
import { formatDate } from '@kps/shared';
import { Card, Row } from '../../ui';

export default function DriverInfoCard({ driver, vehicle }) {
  const temp = driver.temporaryDriver;
  return (
    <Card title={driver.displayName || driver.name || 'Unnamed driver'}>
      <Row label="User Name" value={driver.name || 'Unnamed driver'} />
      <Row label="Mobile Number" value={driver.mobileNumber || 'No phone'} />
      <Row label="Vehicle" value={vehicle?.vehicleNumber || 'Unassigned'} />
      <Row label="Basic Salary" value={String(driver.basicSalary ?? 0)} />
      <Row label="KM Charges" value={String(driver.kmCharges ?? 0)} />
      <Row label="Less than 200KM Charges" value={String(driver.minKmCharges ?? 0)} />
      {temp?.required && (
        <Row
          label="Temporary Driver"
          value={`${temp.name} (${formatDate(temp.joiningDate)} - ${temp.returningDate ? formatDate(temp.returningDate) : 'Ongoing'})`}
        />
      )}
    </Card>
  );
}
