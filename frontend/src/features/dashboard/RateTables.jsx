import React, { useEffect, useState } from 'react';
import * as api from '../../api/api';
import RateTable from './RateTable';

// Super admin: one Rate/KM/Ton card per configured table (every state x tonnage class), in the
// server's order, so adding a table on the backend shows it here without a frontend change.
export default function RateTables({ user }) {
  const [tables, setTables] = useState([]);
  const [error, setError] = useState('');
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin) {
      setTables([]);
      return undefined;
    }
    let cancelled = false;
    api.listRateTables()
      .then((res) => { if (!cancelled) setTables(res.data.rateTables || []); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.error || 'Failed to load rate tables'); });
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;
  if (error) return <div className="card" style={{ marginTop: 24 }}><p className="error-text">{error}</p></div>;
  return (
    <>
      {tables.map((table) => (
        <RateTable key={table.id} user={user} tableId={table.id} title={table.title} initialTable={table} />
      ))}
    </>
  );
}
