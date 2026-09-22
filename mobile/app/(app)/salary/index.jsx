import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatMonthLabel, latestCalculableMonth, ROLES } from '@kps/shared';
import { useAuth } from '../../../src/AuthContext';
import { api, errorMessage } from '../../../src/api';
import { Button, Card, ErrorText, Loading, Muted, Row, Screen, Select } from '../../../src/ui';
import { spacing } from '../../../src/theme';
import { calculableMonthOptions, leavesTakenInMonth } from '../../../src/features/salary/months';

// Port of SalarySection: one salary summary per active driver for the selected month.
export default function SalaryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const customerId = user?.customer;
  const [customerData, setCustomerData] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [salaryMonth, setSalaryMonth] = useState(latestCalculableMonth);
  const [driverSalaries, setDriverSalaries] = useState({});
  const [salariesLoading, setSalariesLoading] = useState(false);
  const [error, setError] = useState('');

  const driverUsers = customerData?.users?.filter((item) => item.role === ROLES.VEHICLE_USER && item.isActive !== false) || [];

  useFocusEffect(useCallback(() => {
    let active = true;
    if (user?.role !== ROLES.CUSTOMER_ADMIN || !customerId) return undefined;
    Promise.all([api.getCustomer(customerId), api.listLeaves(customerId)])
      .then(([customerRes, leavesRes]) => {
        if (!active) return;
        setCustomerData(customerRes.data);
        setLeaves(leavesRes.data.leaves || []);
      })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load salary details')); });
    return () => { active = false; };
  }, [customerId, user?.role]));

  useEffect(() => {
    let active = true;
    if (driverUsers.length === 0) { setDriverSalaries({}); return undefined; }
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

  if (user?.role !== ROLES.CUSTOMER_ADMIN) {
    return <Screen><Card><Muted>Salary details are available to customer admins.</Muted></Card></Screen>;
  }
  if (!customerData && !error) return <Loading text="Loading salary details..." />;

  return (
    <Screen>
      <Card title={`Salary Details (${formatMonthLabel(salaryMonth)})`}>
        <Muted style={{ marginBottom: spacing.md }}>
          Salary for a month is calculated at the end of the following month (latest available: {formatMonthLabel(latestCalculableMonth())}).
        </Muted>
        <Select label="Salary Month" value={salaryMonth} options={calculableMonthOptions()} onChange={(month) => { if (month) setSalaryMonth(month); }} />
      </Card>
      <ErrorText>{error}</ErrorText>
      {driverUsers.length === 0 ? <Card><Muted>No drivers found.</Muted></Card> : null}
      {salariesLoading ? <Loading text="Loading salary details..." /> : driverUsers.map((driver) => {
        const driverId = driver.id || driver._id;
        const salary = driverSalaries[driverId];
        const vehicleNumber = customerData?.vehicles?.find((vehicle) => String(vehicle._id) === String(driver.vehicle))?.vehicleNumber || 'Unassigned';
        return (
          <Card key={driverId} title={driver.displayName || driver.name || 'Unnamed driver'}>
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
    </Screen>
  );
}
