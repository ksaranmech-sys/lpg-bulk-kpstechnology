import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '../api/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import DriverInfoCard from '../features/driver/DriverInfoCard';
import DriverTripsByMonth from '../features/driver/DriverTripsByMonth';
import DriverLeavesList from '../features/driver/DriverLeavesList';
import DriverSalaryPanel from '../features/driver/DriverSalaryPanel';
import DriverReminderEditor from '../features/driver/DriverReminderEditor';

export default function DriverDetail() {
  const { user } = useAuth();
  const { customerId, driverId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showArchivedLeaves, setShowArchivedLeaves] = useState(false);

  useEffect(() => {
    if (!['super_admin', 'customer_admin'].includes(user?.role)) return;
    api
      .getCustomer(customerId)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load driver'));
  }, [customerId, user]);

  const driver = data?.users?.find((entry) => String(entry.id || entry._id) === String(driverId));
  const vehicle = data?.vehicles?.find((entry) => String(entry._id) === String(driver?.vehicle));

  if (!['super_admin', 'customer_admin'].includes(user?.role)) {
    return <Layout><p>You do not have access to this page.</p></Layout>;
  }

  if (error) {
    return (
      <Layout>
        <Link to="/">&larr; Back to dashboard</Link>
        <p className="error-text">{error}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <Link to="/">&larr; Back to dashboard</Link>
      {!data ? <p>Loading driver...</p> : !driver ? (
        <p className="error-text">Driver not found.</p>
      ) : (
        <>
          <DriverInfoCard driver={driver} vehicle={vehicle} />
          <DriverTripsByMonth vehicle={vehicle} setError={setError} setShowArchivedLeaves={setShowArchivedLeaves} />
          <DriverLeavesList
            customerId={customerId}
            driverId={driverId}
            driver={driver}
            setError={setError}
            showArchivedLeaves={showArchivedLeaves}
            setShowArchivedLeaves={setShowArchivedLeaves}
          />
          <DriverSalaryPanel
            customerId={customerId}
            driverId={driverId}
            data={data}
            driver={driver}
            vehicle={vehicle}
            setError={setError}
          />
          {vehicle && (
            <DriverReminderEditor vehicle={vehicle} setData={setData} setError={setError} />
          )}
        </>
      )}
    </Layout>
  );
}
