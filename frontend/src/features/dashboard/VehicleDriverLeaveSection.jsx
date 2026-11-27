import React from 'react';
import DriverList from './DriverList';
import AdminLeaveSection from './AdminLeaveSection';

export default function VehicleDriverLeaveSection({
  user,
  vehicles,
  setVehicles,
  customerData,
  setCustomerData,
  driverUsers,
  leaves,
  setLeaves,
  leavesLoading,
  leaveError,
  setLeaveError,
}) {
  return (
    <section className="card" data-dashboard-section="vehicle-driver-leave">
      <DriverList
        user={user}
        vehicles={vehicles}
        setVehicles={setVehicles}
        customerData={customerData}
        setCustomerData={setCustomerData}
        driverUsers={driverUsers}
        embedded
      />
      <AdminLeaveSection
        leaves={leaves}
        setLeaves={setLeaves}
        leavesLoading={leavesLoading}
        leaveError={leaveError}
        setLeaveError={setLeaveError}
        driverUsers={driverUsers}
        embedded
      />
    </section>
  );
}
