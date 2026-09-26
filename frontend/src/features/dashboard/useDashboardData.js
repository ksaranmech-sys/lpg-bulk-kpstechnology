import { useEffect, useState } from 'react';
import * as api from '../../api/api';

export function useDashboardData(user) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [customerData, setCustomerData] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [vehicleExpensesLoading, setVehicleExpensesLoading] = useState(false);
  const [vehicleExpenseError, setVehicleExpenseError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .listVehicles(
        user?.role === 'super_admin' && selectedCustomerId && selectedCustomerId !== 'all'
          ? selectedCustomerId
          : undefined
      )
      .then((res) => {
        const nextVehicles = res.data.vehicles || [];
        setVehicles(nextVehicles);
        setSelectedVehicleId((currentVehicleId) => {
          if (user?.role === 'vehicle_user') {
            return nextVehicles[0]?._id || '';
          }
          return currentVehicleId && !nextVehicles.some((vehicle) => vehicle._id === currentVehicleId)
            ? ''
            : currentVehicleId;
        });
      })
      .finally(() => setLoading(false));
  }, [selectedCustomerId, user]);

  useEffect(() => {
    if (user?.role !== 'customer_admin' || !user.customer) {
      setCustomerData(null);
      return;
    }

    api
      .getCustomer(user.customer)
      .then((res) => setCustomerData(res.data))
      .catch(() => setCustomerData(null));
  }, [user]);

  useEffect(() => {
    if (!['customer_admin', 'vehicle_user'].includes(user?.role)) {
      setLeaves([]);
      return;
    }
    setLeavesLoading(true);
    api
      .listLeaves(user.role === 'customer_admin' ? user.customer : undefined)
      .then((res) => setLeaves(res.data.leaves || []))
      .catch((err) => setLeaveError(err.response?.data?.error || 'Failed to load leave entries'))
      .finally(() => setLeavesLoading(false));
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'customer_admin' || !user.customer) {
      setVehicleExpenses([]);
      return;
    }
    setVehicleExpensesLoading(true);
    api
      .listVehicleExpenses()
      .then((res) => setVehicleExpenses(res.data.expenses || []))
      .catch((err) => setVehicleExpenseError(err.response?.data?.error || 'Failed to load vehicle expenses'))
      .finally(() => setVehicleExpensesLoading(false));
  }, [user]);

  const driverUsers = customerData?.users?.filter((item) => item.role === 'vehicle_user' && item.isActive !== false) || [];

  return {
    vehicles,
    setVehicles,
    loading,
    selectedCustomerId,
    setSelectedCustomerId,
    customers,
    setCustomers,
    selectedVehicleId,
    setSelectedVehicleId,
    customerData,
    setCustomerData,
    leaves,
    setLeaves,
    leavesLoading,
    leaveError,
    setLeaveError,
    vehicleExpenses,
    setVehicleExpenses,
    vehicleExpensesLoading,
    vehicleExpenseError,
    setVehicleExpenseError,
    driverUsers,
  };
}
