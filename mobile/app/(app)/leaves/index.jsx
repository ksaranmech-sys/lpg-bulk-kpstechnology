import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../../src/AuthContext';
import { api, errorMessage } from '../../../src/api';
import { Card, ErrorText, Muted, Screen, Select } from '../../../src/ui';
import LeavesCard from '../../../src/features/leaves/LeavesCard';

// Drivers manage their own leaves; customer admins manage their drivers'; super admins pick a
// customer first (the API scopes /leaves by ?customerId for them).
export default function LeavesScreen() {
  const { user } = useAuth();
  const isDriver = user?.role === ROLES.VEHICLE_USER;
  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(isSuper ? '' : (user?.customer || ''));
  const [drivers, setDrivers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(!isSuper);
  const [leaveError, setLeaveError] = useState('');

  useEffect(() => {
    if (!isSuper) return;
    api.listCustomers()
      .then((res) => setCustomers(res.data.customers || []))
      .catch((err) => setLeaveError(errorMessage(err, 'Failed to load customers')));
  }, [isSuper]);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (isSuper && !customerId) {
      setLeaves([]);
      setDrivers([]);
      return undefined;
    }
    setLeavesLoading(true);
    setLeaveError('');
    const requests = [api.listLeaves(isDriver ? undefined : customerId)];
    if (!isDriver && customerId) requests.push(api.getCustomer(customerId));
    Promise.all(requests)
      .then(([leavesRes, customerRes]) => {
        if (!active) return;
        setLeaves(leavesRes.data.leaves || []);
        if (customerRes) {
          setDrivers((customerRes.data.users || []).filter((item) => item.role === ROLES.VEHICLE_USER && item.isActive !== false));
        }
      })
      .catch((err) => { if (active) setLeaveError(errorMessage(err, 'Failed to load leave entries')); })
      .finally(() => { if (active) setLeavesLoading(false); });
    return () => { active = false; };
  }, [customerId, isDriver, isSuper]));

  return (
    <Screen>
      {isSuper && (
        <Card>
          <Select
            label="Customer"
            value={customerId}
            onChange={setCustomerId}
            options={customers.map((c) => ({ value: c._id, label: c.companyName }))}
            placeholder="Loading customers..."
          />
          {!customerId ? <Muted>Select a customer to view leave entries.</Muted> : null}
        </Card>
      )}
      {isSuper && !customerId ? <ErrorText>{leaveError}</ErrorText> : (
        <LeavesCard
          leaves={leaves}
          setLeaves={setLeaves}
          leavesLoading={leavesLoading}
          leaveError={leaveError}
          setLeaveError={setLeaveError}
          drivers={drivers}
          isDriver={isDriver}
        />
      )}
    </Screen>
  );
}
