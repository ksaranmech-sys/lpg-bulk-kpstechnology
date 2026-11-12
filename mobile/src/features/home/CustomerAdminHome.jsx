import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ROLES } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { ErrorText, Loading, Screen } from '../../ui';
import { showReminderPopup } from '../reminders/ReminderSummary';
import DriversList from '../customers/DriversList';
import TripHistoryCard from './TripHistoryCard';
import VehicleExpensesCard from '../expenses/VehicleExpensesCard';
import LeavesCard from '../leaves/LeavesCard';
import SalaryDetailsCard from '../salary/SalaryDetailsCard';
import MonthlyIncomeCard from './MonthlyIncomeCard';
import VehicleRemindersCard from '../reminders/VehicleRemindersCard';
import VehicleMaintenanceCard from '../maintenance/VehicleMaintenanceCard';

// Customer admin home: same sections as the web dashboard, top to bottom.
export default function CustomerAdminHome({ user }) {
  const customerId = user?.customer;
  const [vehicles, setVehicles] = useState([]);
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
  function updateVehicle(updatedVehicle) {
    setVehicles((current) => current.map((vehicle) => (
      String(vehicle._id) === String(updatedVehicle._id) ? updatedVehicle : vehicle
    )));
    setCustomerData((current) => current && ({
      ...current,
      vehicles: (current.vehicles || []).map((vehicle) => (
        String(vehicle._id) === String(updatedVehicle._id) ? updatedVehicle : vehicle
      )),
    }));
  }

  return (
    <Screen>
      <ErrorText>{error}</ErrorText>
      <MonthlyIncomeCard customerId={customerId} />
      <SalaryDetailsCard customerId={customerId} customerData={customerData} driverUsers={driverUsers} leaves={leaves} />
      <DriversList customerId={customerId} data={customerData || { vehicles, users: [] }} canAdd />
      <TripHistoryCard vehicles={listVehicles} setError={setError} />
      <LeavesCard
        leaves={leaves}
        setLeaves={setLeaves}
        leavesLoading={leavesLoading}
        leaveError={leaveError}
        setLeaveError={setLeaveError}
        drivers={driverUsers}
        isDriver={false}
      />

      <VehicleExpensesCard
        customerId={customerId}
        vehicles={listVehicles}
        expenses={vehicleExpenses}
        loading={expensesLoading}
        error={expenseError}
      />
      <VehicleRemindersCard vehicles={listVehicles} onVehicleUpdated={updateVehicle} />
      <VehicleMaintenanceCard vehicles={listVehicles} onVehicleUpdated={updateVehicle} />
    </Screen>
  );
}
