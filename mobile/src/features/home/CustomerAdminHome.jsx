import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatTripRoute, ROLES } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Badge, Card, ErrorText, Loading, Muted, NavRow, Screen } from '../../ui';
import { showReminderPopup } from '../reminders/ReminderSummary';
import DriversList from '../customers/DriversList';
import TripHistoryCard from './TripHistoryCard';
import VehicleExpensesCard from '../expenses/VehicleExpensesCard';
import LeavesCard from '../leaves/LeavesCard';
import SalaryDetailsCard from '../salary/SalaryDetailsCard';

// Customer admin home: same sections as the web dashboard, top to bottom.
export default function CustomerAdminHome({ user }) {
  const router = useRouter();
  const customerId = user?.customer;
  const [vehicles, setVehicles] = useState([]);
  const [openTrips, setOpenTrips] = useState([]);
  const [customerData, setCustomerData] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [leaveError, setLeaveError] = useState('');
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expenseError, setExpenseError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const driverUsers = customerData?.users?.filter((item) => item.role === ROLES.VEHICLE_USER && item.isActive !== false) || [];

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      setError('');
      try {
        const [vehiclesRes, customerRes] = await Promise.all([api.listVehicles(), api.getCustomer(customerId)]);
        const nextVehicles = vehiclesRes.data.vehicles || [];
        if (!active) return;
        setVehicles(nextVehicles);
        setCustomerData(customerRes.data);
        showReminderPopup(nextVehicles);
        // Trips in progress (open or awaiting close) per vehicle; closed trips live under Trip History.
        const perVehicle = await Promise.all(nextVehicles.map((vehicle) => (
          api.listTripsForVehicle(vehicle._id)
            .then((tripsRes) => (tripsRes.data.trips || [])
              .filter((trip) => trip.status !== 'closed')
              .map((trip) => ({ ...trip, vehicleNumber: vehicle.vehicleNumber })))
            .catch(() => [])
        )));
        if (active) setOpenTrips(perVehicle.flat());
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    setLeavesLoading(true);
    api.listLeaves(customerId)
      .then((res) => { if (active) setLeaves(res.data.leaves || []); })
      .catch((err) => { if (active) setLeaveError(errorMessage(err, 'Failed to load leave entries')); })
      .finally(() => { if (active) setLeavesLoading(false); });

    setExpensesLoading(true);
    api.listVehicleExpenses()
      .then((res) => { if (active) setVehicleExpenses(res.data.expenses || []); })
      .catch((err) => { if (active) setExpenseError(errorMessage(err, 'Failed to load vehicle expenses')); })
      .finally(() => { if (active) setExpensesLoading(false); });

    return () => { active = false; };
  }, [customerId]));

  if (loading) return <Loading />;

  const listVehicles = customerData?.vehicles || vehicles;

  return (
    <Screen>
      <ErrorText>{error}</ErrorText>
      <Card title={`Open Trips (${openTrips.length})`}>
        <Muted style={{ marginBottom: 8 }}>Total Vehicles: {vehicles.length}</Muted>
        {openTrips.length === 0 ? <Muted>No trips in progress.</Muted> : null}
        {openTrips.map((trip) => (
          <NavRow
            key={trip._id}
            title={trip.vehicleNumber}
            subtitle={formatTripRoute(trip)}
            right={<Badge status={trip.status} />}
            onPress={() => router.push(`/trips/${trip._id}`)}
          />
        ))}
      </Card>

      <DriversList customerId={customerId} data={customerData || { vehicles, users: [] }} canAdd vehicleExpenses={vehicleExpenses} />

      <TripHistoryCard vehicles={listVehicles} setError={setError} />

      <VehicleExpensesCard
        customerId={customerId}
        vehicles={listVehicles}
        driverUsers={driverUsers}
        expenses={vehicleExpenses}
        loading={expensesLoading}
        error={expenseError}
      />

      <LeavesCard
        leaves={leaves}
        setLeaves={setLeaves}
        leavesLoading={leavesLoading}
        leaveError={leaveError}
        setLeaveError={setLeaveError}
        drivers={driverUsers}
        isDriver={false}
      />

      <SalaryDetailsCard customerId={customerId} customerData={customerData} driverUsers={driverUsers} leaves={leaves} />
    </Screen>
  );
}
