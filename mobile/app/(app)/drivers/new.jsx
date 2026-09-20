import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ROLES } from '@kps/shared';
import { useAuth } from '../../../src/AuthContext';
import { api, errorMessage } from '../../../src/api';
import { Card, ErrorText, Loading, Muted, Screen } from '../../../src/ui';
import DriverForm, { EMPTY_DRIVER_FORM, buildCreatePayload } from '../../../src/features/drivers/DriverForm';

// Port of AddDriverForm / AddDriverModal: POST /customers/:id/users (customer_admin only).
export default function NewDriverScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const customerId = String(params.customerId || user?.customer || '');
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_DRIVER_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!customerId) { setLoading(false); return undefined; }
    api.getCustomer(customerId)
      .then((res) => { if (active) setVehicles(res.data.vehicles || []); })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load vehicles')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customerId]);

  async function addDriver() {
    if (!customerId) return;
    setError('');
    setSaving(true);
    try {
      await api.createVehicleUser(customerId, buildCreatePayload(form));
      router.back();
    } catch (err) {
      setError(errorMessage(err, 'Failed to add driver'));
    } finally {
      setSaving(false);
    }
  }

  if (user?.role !== ROLES.CUSTOMER_ADMIN) {
    return <Screen><Card><Muted>Only a customer admin can add drivers.</Muted></Card></Screen>;
  }
  if (loading) return <Loading />;

  return (
    <Screen>
      <Card title="Add Driver and Link Vehicle">
        {!customerId ? <ErrorText>No customer selected.</ErrorText> : null}
        <DriverForm form={form} setForm={setForm} vehicles={vehicles} mode="create" error={error} saving={saving} onSave={addDriver} />
      </Card>
    </Screen>
  );
}
