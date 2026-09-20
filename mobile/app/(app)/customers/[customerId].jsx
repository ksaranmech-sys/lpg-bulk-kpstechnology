import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../../src/AuthContext';
import { api, errorMessage } from '../../../src/api';
import { Card, ErrorText, Loading, Muted, Screen } from '../../../src/ui';
import { colors } from '../../../src/theme';
import CustomerInfoForm from '../../../src/features/customers/CustomerInfoForm';
import VehiclesList from '../../../src/features/customers/VehiclesList';
import DriversList from '../../../src/features/customers/DriversList';

// Port of the web CustomerDetail page. Permissions follow the web + backend routes:
// super_admin edits customer details and adds vehicles; customer_admin manages drivers.
export default function CustomerDetailScreen() {
  const { user } = useAuth();
  const { customerId } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const isCustomerAdmin = user?.role === ROLES.CUSTOMER_ADMIN;

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!isSuper && !isCustomerAdmin) return undefined;
    api.getCustomer(customerId)
      .then((res) => { if (active) setData(res.data); })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load customer')); });
    return () => { active = false; };
  }, [customerId, isSuper, isCustomerAdmin]));

  if (!isSuper && !isCustomerAdmin) {
    return <Screen><Card><Muted>You do not have access to this page.</Muted></Card></Screen>;
  }
  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!data) return <Loading text="Loading customer details..." />;

  const customer = data.customer;

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.green900, flex: 1 }}>{customer?.companyName}</Text>
          <Text style={{ fontWeight: '700', color: customer?.isActive ? colors.success : colors.danger }}>{customer?.isActive ? 'Active' : 'Blocked'}</Text>
        </View>
        <Muted>{[customer?.mobileNumber, customer?.email].filter(Boolean).join(' \u00b7 ')}</Muted>
      </Card>

      {isSuper && <CustomerInfoForm customerId={customerId} data={data} setData={setData} />}

      <VehiclesList customerId={customerId} data={data} setData={setData} canAdd={isSuper} />

      <DriversList customerId={customerId} data={data} canAdd={isCustomerAdmin} />
    </Screen>
  );
}
