import React, { useEffect, useState } from 'react';
import { isCurrentOrPreviousMonth, monthKey as toMonthKey } from '@kps/shared';
import * as api from '../../api/api';

export default function DriverLeavesList({ customerId, driverId, driver, setError, showArchivedLeaves, setShowArchivedLeaves }) {
  const [driverLeaves, setDriverLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);

  const archivedLeaves = driverLeaves.filter((leave) => {
    const key = toMonthKey(leave.startDate);
    return !key || !isCurrentOrPreviousMonth(key);
  });
  const visibleLeaves = showArchivedLeaves
    ? driverLeaves
    : driverLeaves.filter((leave) => !archivedLeaves.includes(leave));

  useEffect(() => {
    if (!driver) return;
    setLeavesLoading(true);
    api
      .listLeaves(customerId)
      .then((res) => {
        const leaves = (res.data.leaves || []).filter((leave) => (
          String(leave.driver?._id || leave.driver?.id || leave.driver) === String(driverId)
        ));
        setDriverLeaves(leaves);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load leave details'))
      .finally(() => setLeavesLoading(false));
  }, [customerId, driver, driverId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Leave Details</h3>
      {leavesLoading ? <p>Loading leave details...</p> : visibleLeaves.length === 0 ? (
        <p style={{ margin: 0, color: '#666' }}>No leave entries found.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleLeaves.map((leave) => (
            <div key={leave._id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <strong>
                  {new Date(leave.startDate).toLocaleDateString('en-IN')} - {leave.endDate ? new Date(leave.endDate).toLocaleDateString('en-IN') : '-'}
                </strong>
                <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>{leave.reason || 'No reason provided'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {archivedLeaves.length > 0 && (
        <button
          type="button"
          className="btn secondary"
          style={{ marginTop: 12 }}
          onClick={() => setShowArchivedLeaves((current) => !current)}
        >
          {showArchivedLeaves ? 'Hide archived leaves' : `View archived leaves (${archivedLeaves.length})`}
        </button>
      )}
    </div>
  );
}
