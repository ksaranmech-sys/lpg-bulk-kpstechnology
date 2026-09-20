import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../../../src/AuthContext';
import { api, errorMessage } from '../../../../src/api';
import { Card, ErrorText, Loading, Muted, Screen } from '../../../../src/ui';
import { colors } from '../../../../src/theme';
import ReminderEditor from '../../../../src/features/reminders/ReminderEditor';

export default function VehicleRemindersScreen() {
  const { vehicleId } = useLocalSearchParams();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getVehicle(vehicleId)
      .then((res) => { if (active) setVehicle(res.data.vehicle); })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load vehicle')); });
    return () => { active = false; };
  }, [vehicleId]);

  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!vehicle) return <Loading />;

  return (
    <Screen>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.green900 }}>{vehicle.vehicleNumber}</Text>
        <Muted>Driver: {vehicle.driverName || 'Not assigned'}</Muted>
      </Card>
      <ReminderEditor
        vehicle={vehicle}
        onSaved={setVehicle}
        variant={user?.role === ROLES.VEHICLE_USER ? 'status' : 'days'}
      />
    </Screen>
  );
}
