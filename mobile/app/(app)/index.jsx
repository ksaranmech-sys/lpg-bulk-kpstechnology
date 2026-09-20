import React from 'react';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../src/AuthContext';
import DriverHome from '../../src/features/home/DriverHome';
import CustomerAdminHome from '../../src/features/home/CustomerAdminHome';
import SuperAdminHome from '../../src/features/home/SuperAdminHome';

export default function HomeScreen() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === ROLES.SUPER_ADMIN) return <SuperAdminHome user={user} />;
  if (user.role === ROLES.CUSTOMER_ADMIN) return <CustomerAdminHome user={user} />;
  return <DriverHome user={user} />;
}
