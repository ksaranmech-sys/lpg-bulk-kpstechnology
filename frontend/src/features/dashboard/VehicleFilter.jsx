import React from 'react';

export default function VehicleFilter({ selectedCustomerId, setSelectedCustomerId, customers, loading, vehicles }) {
  return (
    <div className="superadmin-filter-section" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div className="field" style={{ maxWidth: 360, flex: 1 }}>
        <label htmlFor="customer-filter">Filter Vehicles by Customer</label>
        <select id="customer-filter" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
          <option value="">Select customer...</option>
          <option value="all">All vehicles</option>
          {customers.map((customer) => (
            <option key={customer._id} value={customer._id}>{customer.companyName}</option>
          ))}
        </select>
      </div>
      <div style={{ paddingBottom: 12, fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>
        Vehicles: {!selectedCustomerId ? '-' : loading ? '...' : vehicles.length}
      </div>
    </div>
  );
}
