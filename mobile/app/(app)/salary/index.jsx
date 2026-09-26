import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../../src/AuthContext';
import { api, errorMessage } from '../../../src/api';
import { Card, ErrorText, Loading, Muted, Screen } from '../../../src/ui';
import SalaryDetailsCard from '../../../src/features/salary/SalaryDetailsCard';

// Port of SalarySection: one salary summary per active driver for the selected month.
export default function SalaryScreen() {
  const { user } = useAuth();
  const customerId = user?.customer;
  const [customerData, setCustomerData] = useState(null);
  const [leaves, setLeaves] = useState([]);
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

  if (user?.role !== ROLES.CUSTOMER_ADMIN) {
    return <Screen><Card><Muted>Salary details are available to customer admins.</Muted></Card></Screen>;
  }
  if (!customerData && !error) return <Loading text="Loading salary details..." />;

  return (
    <Screen>
      <ErrorText>{error}</ErrorText>
      <SalaryDetailsCard customerId={customerId} customerData={customerData} driverUsers={driverUsers} leaves={leaves} />
    </Screen>
  );
}
