import React, { useEffect, useState } from 'react';
import { formatDate, isCurrentOrPreviousMonth, monthKey as toMonthKey } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, Loading, Muted } from '../../ui';
import { EntryRow } from '../../trip/common';
import { spacing } from '../../theme';

export default function DriverLeavesList({ customerId, driverId, driver, setError }) {
  const [driverLeaves, setDriverLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [showArchivedLeaves, setShowArchivedLeaves] = useState(false);

  const archivedLeaves = driverLeaves.filter((leave) => {
    const key = toMonthKey(leave.startDate);
    return !key || !isCurrentOrPreviousMonth(key);
  });
  const visibleLeaves = showArchivedLeaves ? driverLeaves : driverLeaves.filter((leave) => !archivedLeaves.includes(leave));

  useEffect(() => {
    let active = true;
    if (!driver) return undefined;
    setLeavesLoading(true);
    api.listLeaves(customerId)
      .then((res) => {
        if (!active) return;
        setDriverLeaves((res.data.leaves || []).filter((leave) => (
          String(leave.driver?._id || leave.driver?.id || leave.driver) === String(driverId)
        )));
      })
      .catch((err) => { if (active) setError(errorMessage(err, 'Failed to load leave details')); })
      .finally(() => { if (active) setLeavesLoading(false); });
    return () => { active = false; };
  }, [customerId, driverId, Boolean(driver)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card title="Leave Details">
      {leavesLoading ? <Loading text="Loading leave details..." /> : visibleLeaves.length === 0 ? (
        <Muted>No leave entries found.</Muted>
      ) : visibleLeaves.map((leave) => (
        <EntryRow
          key={leave._id}
          title={`${formatDate(leave.startDate)} - ${leave.endDate ? formatDate(leave.endDate) : '-'}`}
          subtitle={leave.reason || 'No reason provided'}
        />
      ))}
      {archivedLeaves.length > 0 && (
        <Button
          title={showArchivedLeaves ? 'Hide archived leaves' : `View archived leaves (${archivedLeaves.length})`}
          variant="secondary"
          onPress={() => setShowArchivedLeaves((current) => !current)}
          style={{ marginTop: spacing.md }}
        />
      )}
    </Card>
  );
}
