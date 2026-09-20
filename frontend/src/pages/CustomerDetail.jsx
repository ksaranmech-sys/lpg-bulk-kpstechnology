import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '../api/api';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import CustomerInfoForm from '../features/customer/CustomerInfoForm';
import VehiclesTable from '../features/customer/VehiclesTable';
import CustomerTripHistory from '../features/customer/CustomerTripHistory';
import DriversTable from '../features/customer/DriversTable';

export default function CustomerDetail() {
  const { user } = useAuth();
  const { customerId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!['super_admin', 'customer_admin'].includes(user?.role)) return;
    api
      .getCustomer(customerId)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load customer'));
  }, [customerId, user]);

  if (!['super_admin', 'customer_admin'].includes(user?.role)) {
    return <Layout><p>You do not have access to this page.</p></Layout>;
  }

  if (error) {
    return (
      <Layout>
        <Link to="/">&larr; Back to customers</Link>
        <p className="error-text">{error}</p>
      </Layout>
    );
  }

  const customer = data?.customer;

  return (
    <Layout>
      <Link to="/">&larr; Back to customers</Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          {customer ? customer.companyName : 'Loading...'}
        </h2>
        {customer && (
          <span className={`badge ${customer.isActive ? 'closed' : 'open'}`}>
            {customer.isActive ? 'Active' : 'Blocked'}
          </span>
        )}
      </div>

      {user?.role === 'super_admin' && (
        <CustomerInfoForm customerId={customerId} data={data} setData={setData} />
      )}

      <VehiclesTable customerId={customerId} data={data} setData={setData} user={user} />

      <CustomerTripHistory vehicles={data?.vehicles} />
      {user?.role === 'customer_admin' && (
        <DriversTable customerId={customerId} data={data} setData={setData} />
      )}

    </Layout>
  );
}
