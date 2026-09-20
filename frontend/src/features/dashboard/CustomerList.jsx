import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../../api/api';

export default function CustomerList({ user, customers, setCustomers }) {
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState('');
  const [customerActionId, setCustomerActionId] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [customerEditMode, setCustomerEditMode] = useState(false);
  const [customerDrafts, setCustomerDrafts] = useState({});
  const [customerSaving, setCustomerSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    setCustomersLoading(true);
    api
      .listCustomers()
      .then((res) => {
        setCustomers(res.data.customers);
        setSelectedCustomers([]);
        setCustomerEditMode(false);
        setCustomerDrafts({});
      })
      .catch((err) => setCustomersError(err.response?.data?.error || 'Failed to load customers'))
      .finally(() => setCustomersLoading(false));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleCustomerStatus(customer) {
    setCustomersError('');
    setCustomerActionId(customer._id);
    try {
      const res = await api.setCustomerStatus(customer._id, !customer.isActive);
      setCustomers((current) => current.map((item) => (
        item._id === customer._id ? res.data.customer : item
      )));
    } catch (err) {
      setCustomersError(err.response?.data?.error || 'Failed to update customer status');
    } finally {
      setCustomerActionId(null);
    }
  }

  function editSelectedCustomers() {
    if (!selectedCustomers.length) return;
    setCustomerDrafts(Object.fromEntries(
      customers
        .filter((customer) => selectedCustomers.includes(customer._id))
        .map((customer) => [customer._id, {
          companyName: customer.companyName || '',
          email: customer.email || '',
          mobileNumber: customer.mobileNumber || '',
        }])
    ));
    setCustomerEditMode(true);
  }

  async function saveCustomerChanges() {
    if (!selectedCustomers.length) return;
    setCustomersError('');
    setCustomerSaving(true);
    try {
      const updatedCustomers = await Promise.all(selectedCustomers.map(async (customerId) => {
        const res = await api.updateCustomer(customerId, customerDrafts[customerId]);
        return res.data.customer;
      }));
      const updatedById = Object.fromEntries(updatedCustomers.map((customer) => [customer._id, customer]));
      setCustomers((current) => current.map((customer) => updatedById[customer._id] || customer));
      setSelectedCustomers([]);
      setCustomerDrafts({});
      setCustomerEditMode(false);
    } catch (err) {
      setCustomersError(err.response?.data?.error || 'Failed to save customer changes');
    } finally {
      setCustomerSaving(false);
    }
  }

  async function deleteSelectedCustomers() {
    if (!selectedCustomers.length) return;
    if (!window.confirm(`Delete ${selectedCustomers.length} selected customer(s)? This will also delete their users, vehicles, and trips.`)) return;
    setCustomersError('');
    setCustomerActionId('bulk');
    try {
      await Promise.all(selectedCustomers.map((customerId) => api.deleteCustomer(customerId)));
      setCustomers((current) => current.filter((customer) => !selectedCustomers.includes(customer._id)));
      setSelectedCustomers([]);
      setCustomerDrafts({});
      setCustomerEditMode(false);
    } catch (err) {
      setCustomersError(err.response?.data?.error || 'Failed to delete selected customers');
    } finally {
      setCustomerActionId(null);
    }
  }

  return (
    <div className="superadmin-customer-section">
      <h2 className="section-title">Customers ({customers.length})</h2>
      {customersLoading && <p>Loading customers...</p>}
      {customersError && <p className="error-text">{customersError}</p>}
      {!customersLoading && !customersError && customers.length === 0 && <p>No customers found yet.</p>}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {customers.map((customer) => (
          <div key={customer._id} className="list-item">
          <input
            type="checkbox"
            checked={selectedCustomers.includes(customer._id)}
            onChange={() => setSelectedCustomers((current) => (
              current.includes(customer._id)
                ? current.filter((id) => id !== customer._id)
                : [...current, customer._id]
            ))}
            aria-label={`Select ${customer.companyName}`}
            style={{ width: 'auto' }}
          />
        <div style={{ flex: 1, minWidth: 0 }}>
          {customerEditMode && selectedCustomers.includes(customer._id) ? (
            <div className="grid-2" style={{ marginBottom: 8 }}>
              <input
                value={customerDrafts[customer._id]?.companyName || ''}
                onChange={(event) => setCustomerDrafts((current) => ({
                  ...current,
                  [customer._id]: { ...current[customer._id], companyName: event.target.value },
                }))}
                aria-label="Company name"
              />
              <input
                value={customerDrafts[customer._id]?.email || ''}
                onChange={(event) => setCustomerDrafts((current) => ({
                  ...current,
                  [customer._id]: { ...current[customer._id], email: event.target.value },
                }))}
                aria-label="Customer email"
              />
              <input
                value={customerDrafts[customer._id]?.mobileNumber || ''}
                onChange={(event) => setCustomerDrafts((current) => ({
                  ...current,
                  [customer._id]: { ...current[customer._id], mobileNumber: event.target.value },
                }))}
                aria-label="Customer mobile number"
              />
            </div>
          ) : (
            <>
              <Link to={`/customers/${customer._id}`} style={{ color: 'var(--green-900)', fontWeight: 700 }}>
                {customer.companyName}
              </Link>
              <div style={{ fontSize: 12, color: '#666' }}>{customer.email} | {customer.mobileNumber}</div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className={`btn ${customer.isActive ? 'danger' : ''}`}
            onClick={() => toggleCustomerStatus(customer)}
            disabled={customerActionId === customer._id}
          >
            {customerActionId === customer._id ? 'Updating...' : customer.isActive ? 'Block' : 'Unblock'}
          </button>
        </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <button type="button" className="btn secondary" disabled={!selectedCustomers.length} onClick={editSelectedCustomers}>
          Edit selected
        </button>
        <button type="button" className="btn danger" disabled={!selectedCustomers.length || customerActionId === 'bulk'} onClick={deleteSelectedCustomers}>
          Delete selected
        </button>
        <button type="button" className="btn" disabled={!customerEditMode || customerSaving} onClick={saveCustomerChanges}>
          {customerSaving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
