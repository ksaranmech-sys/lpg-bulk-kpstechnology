import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../../../src/AuthContext';
import { api, errorMessage } from '../../../../src/api';
import { Button, Card, ErrorText, Loading, Muted, Screen } from '../../../../src/ui';
import { ButtonRow } from '../../../../src/trip/common';
import { spacing } from '../../../../src/theme';
import DriverInfoCard from '../../../../src/features/drivers/DriverInfoCard';
import DriverForm, { buildUpdatePayload, driverToForm, EMPTY_DRIVER_FORM } from '../../../../src/features/drivers/DriverForm';
import DriverSalaryPanel from '../../../../src/features/drivers/DriverSalaryPanel';
import DriverTripsByMonth from '../../../../src/features/drivers/DriverTripsByMonth';
import DriverLeavesList from '../../../../src/features/drivers/DriverLeavesList';
import DriverVehicleExpenses from '../../../../src/features/expenses/DriverVehicleExpenses';

// Port of the web DriverDetail page. Editing uses PATCH /customers/:id/users/:userId, which the
// backend only allows for customer_admin.
export default function DriverDetailScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { customerId, driverId } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_DRIVER_FORM);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const isAdminRole = [ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN].includes(user?.role);
  const canEdit = user?.role === ROLES.CUSTOMER_ADMIN;

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!isAdminRole) return undefined;
    api.getCustomer(customerId)
      .then((res) => { if (active) setData(res.data); })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load driver')); });
    return () => { active = false; };
  }, [customerId, isAdminRole]));

  const driver = data?.users?.find((entry) => String(entry.id || entry._id) === String(driverId));
  const vehicle = data?.vehicles?.find((entry) => String(entry._id) === String(driver?.vehicle));

  function startEdit() {
    setEditForm(driverToForm(driver));
    setEditError('');
    setEditing(true);
  }

  async function saveEdit() {
    setEditError('');
    setEditSaving(true);
    try {
      const res = await api.updateVehicleUser(customerId, driverId, buildUpdatePayload(editForm));
      const updated = res.data.user;
      setData((current) => ({
        ...current,
        users: current.users.map((entry) => (String(entry.id || entry._id) === String(updated.id || updated._id) ? updated : entry)),
        vehicles: current.vehicles.map((entry) => (
          String(entry._id) === String(updated.vehicle)
            ? { ...entry, driverName: updated.displayName || updated.name, driverMobile: updated.mobileNumber }
            : entry
        )),
      }));
      setEditing(false);
    } catch (err) {
      setEditError(errorMessage(err, 'Failed to update driver'));
    } finally {
      setEditSaving(false);
    }
  }

  if (!isAdminRole) return <Screen><Card><Muted>You do not have access to this page.</Muted></Card></Screen>;
  if (error && !data) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!data) return <Loading text="Loading driver..." />;
  if (!driver) return <Screen><ErrorText>Driver not found.</ErrorText></Screen>;

  return (
    <Screen>
      <ErrorText>{error}</ErrorText>
      <DriverInfoCard driver={driver} vehicle={vehicle} />
      <ButtonRow style={{ marginBottom: spacing.lg }}>
        {canEdit && !editing && <Button title="Edit" variant="secondary" onPress={startEdit} style={{ flex: 1 }} />}
        {vehicle && (
          <Button title="Reminder / Expiry Dates" variant="secondary" onPress={() => router.push(`/vehicles/${vehicle._id}/reminders`)} style={{ flex: 1 }} />
        )}
      </ButtonRow>
      {editing && (
        <Card title="Edit Driver">
          <DriverForm
            form={editForm}
            setForm={setEditForm}
            vehicles={data.vehicles}
            mode="edit"
            error={editError}
            saving={editSaving}
            onSave={saveEdit}
            onCancel={() => { setEditing(false); setEditError(''); }}
          />
        </Card>
      )}
      <DriverSalaryPanel customerId={customerId} driverId={driverId} data={data} driver={driver} vehicle={vehicle} setError={setError} />
      {vehicle && <DriverVehicleExpenses customerId={customerId} vehicle={vehicle} setError={setError} />}
      <DriverTripsByMonth vehicle={vehicle} setError={setError} />
      <DriverLeavesList customerId={customerId} driverId={driverId} driver={driver} setError={setError} />
    </Screen>
  );
}
