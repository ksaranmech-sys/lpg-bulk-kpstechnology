import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { formatMonthLabel, latestCalculableMonth } from '@kps/shared';
import { api } from '../../api';
import { Button, Card, Loading, Muted, Row, Select } from '../../ui';
import { spacing } from '../../theme';
import { calculableMonthOptions, leavesTakenInMonth } from './months';

// Port of the web SalarySection: one salary summary per active driver for the selected month.
export default function SalaryDetailsCard({ customerId, customerData, driverUsers, leaves }) {
  const router = useRouter();
  const [salaryMonth, setSalaryMonth] = useState(latestCalculableMonth);
  const [driverSalaries, setDriverSalaries] = useState({});
  const [salariesLoading, setSalariesLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    let active = true;
    if (!customerId || driverUsers.length === 0) { setDriverSalaries({}); return undefined; }
    setSalariesLoading(true);
    Promise.all(driverUsers.map((driver) => (
      api.getDriverMonthlySalary(customerId, driver.id || driver._id, salaryMonth)
        .then((res) => [driver.id || driver._id, res.data])
        .catch(() => [driver.id || driver._id, null])
    )))
      .then((entries) => { if (active) setDriverSalaries(Object.fromEntries(entries)); })
      .finally(() => { if (active) setSalariesLoading(false); });
    return () => { active = false; };
  }, [customerId, driverUsers.length, salaryMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card title={`Salary Details (${formatMonthLabel(salaryMonth)})`}>
      <Muted style={{ marginBottom: spacing.md }}>
        Salary for a month is calculated from the 5th of the following month (latest available: {formatMonthLabel(latestCalculableMonth())}).
      </Muted>
      {driverUsers.length === 0 ? <Muted>No drivers found.</Muted> : null}
      {salariesLoading ? <Loading text="Loading salary details..." /> : driverUsers.map((driver) => {
        const driverId = driver.id || driver._id;
        const salary = driverSalaries[driverId];
        const vehicleNumber = customerData?.vehicles?.find((vehicle) => String(vehicle._id) === String(driver.vehicle))?.vehicleNumber || 'Unassigned';
        return (
          <Card key={driverId} title={driver.displayName || driver.name || 'Unnamed driver'} style={{ marginBottom: spacing.md }}>
            <Row label="Customer Name" value={customerData?.customer?.companyName || '-'} />
            <Row label="Vehicle Number" value={vehicleNumber} />
            <Row label="Driver Mobile Number" value={driver.mobileNumber || 'No phone'} />
            {!salary ? <Muted style={{ marginTop: spacing.sm }}>Not available</Muted> : (
              <>
                <Row label="Basic Salary Payable" value={`Rs ${Math.round(salary.basicSalary || 0)}`} />
                <Row label="Corporation KM" value={`${Math.round(salary.corporationKm || 0)} km`} />
                <Row label="KM Beta" value={`Rs ${Math.round(salary.kmBeta || 0)}`} />
                <Row label="Special Trip Charges" value={`Rs ${Math.round(salary.specialTripCharges || 0)}`} />
                <Row label="Balance" value={`Rs ${Math.round(salary.totalBalance || 0)}`} />
                <Row label="Salary Balance" value={`Rs ${Math.round(salary.salaryBalance || 0)}`} bold />
                <Row label="Payable Days" value={String(salary.payableDays ?? '-')} />
                <Row label="Leaves Taken" value={String(leavesTakenInMonth(leaves, driverId, salaryMonth))} />
              </>
            )}
            <Button title="Open driver" variant="secondary" onPress={() => router.push(`/drivers/${customerId}/${driverId}`)} style={{ marginTop: spacing.md }} />
          </Card>
        );
      })}
      <Button
        title={showArchived ? 'Hide archived salary' : 'View archived salary'}
        variant="link"
        onPress={() => setShowArchived((current) => !current)}
        style={{ alignSelf: 'flex-end' }}
      />
      {showArchived && (
        <Select label="Salary Month" value={salaryMonth} options={calculableMonthOptions()} onChange={(month) => { if (month) setSalaryMonth(month); }} />
      )}
    </Card>
  );
}
