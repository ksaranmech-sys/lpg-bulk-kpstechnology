import React from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../features/dashboard/useDashboardData';
import ReminderPopup from '../features/dashboard/ReminderPopup';
import RouteKmTable from '../features/dashboard/RouteKmTable';
import ShortageRateForm from '../features/dashboard/ShortageRateForm';
import DieselPriceTable from '../features/dashboard/DieselPriceTable';
import RateTables from '../features/dashboard/RateTables';
import CustomerList from '../features/dashboard/CustomerList';
import OpenTripsCard from '../features/dashboard/OpenTripsCard';
import VehicleFilter from '../features/dashboard/VehicleFilter';
import VehicleList from '../features/dashboard/VehicleList';
import UserAccountCard from '../features/dashboard/UserAccountCard';
import VehicleReminderEditor from '../features/dashboard/VehicleReminderEditor';
import DriverLeaveSection from '../features/dashboard/DriverLeaveSection';
import ClosedTripHistory from '../features/dashboard/ClosedTripHistory';
import SalarySection from '../features/dashboard/SalarySection';
import AdminLeaveSection from '../features/dashboard/AdminLeaveSection';
import DriverList from '../features/dashboard/DriverList';
import MobileAppCard from '../features/dashboard/MobileAppCard';
import VehicleExpensesSection from '../features/dashboard/VehicleExpensesSection';
import VehicleExpenseManagementSection from '../features/dashboard/VehicleExpenseManagementSection';
import MonthlyIncomeSection from '../features/dashboard/MonthlyIncomeSection';
import VehicleMaintenanceSection from '../features/dashboard/VehicleMaintenanceSection';
import MaintenanceReminderPopup from '../features/dashboard/MaintenanceReminderPopup';
import VehiclesTable from '../features/customer/VehiclesTable';

export default function Dashboard() {
  const { user } = useAuth();
  const {
    vehicles, setVehicles, loading,
    selectedCustomerId, setSelectedCustomerId,
    customers, setCustomers,
    selectedVehicleId, setSelectedVehicleId,
    customerData, setCustomerData,
    leaves, setLeaves, leavesLoading, leaveError, setLeaveError,
    vehicleExpenses, vehicleExpensesLoading, vehicleExpenseError,
    driverUsers, allDriverUsers,
  } = useDashboardData(user);
  const vehicleManagementCustomerId = user?.role === 'customer_admin'
    ? user.customer
    : selectedCustomerId && selectedCustomerId !== 'all'
      ? selectedCustomerId
      : '';
  const canManageDashboardVehicles = user?.role === 'customer_admin'
    || (user?.role === 'super_admin' && Boolean(vehicleManagementCustomerId));
  const dashboardVehicleData = { vehicles };

  function updateDashboardVehicleData(update) {
    const nextData = typeof update === 'function' ? update(dashboardVehicleData) : update;
    setVehicles(nextData.vehicles);
    if (user?.role === 'customer_admin') {
      setCustomerData((current) => current && ({ ...current, vehicles: nextData.vehicles }));
    }
  }

  return (
    <Layout>
      <ReminderPopup user={user} vehicles={vehicles} />
      {['super_admin', 'customer_admin'].includes(user?.role) && (
        <MaintenanceReminderPopup vehicles={vehicles} />
      )}
      {['super_admin', 'customer_admin'].includes(user?.role) && (
        <div style={{ order: user?.role === 'customer_admin' ? 5 : 0 }}>
          <div data-dashboard-section="reminder-expiry">
            <VehicleReminderEditor vehicles={vehicles} setVehicles={setVehicles} />
          </div>
        </div>
      )}
      {user?.role === 'super_admin' && (
        <>
          <MobileAppCard />
          <RouteKmTable user={user} />
          <ShortageRateForm user={user} />
          <DieselPriceTable user={user} />
          <RateTables user={user} />
          <CustomerList user={user} customers={customers} setCustomers={setCustomers} />
        </>
      )}
      {user?.role === 'customer_admin' && (
        <div style={{ order: 4 }}>
          <div data-dashboard-section="trip-history">
            <OpenTripsCard
              loading={loading}
              vehicles={vehicles}
              selectedVehicleId={selectedVehicleId}
              setSelectedVehicleId={setSelectedVehicleId}
            />
          </div>
        </div>
      )}
      {user?.role === 'super_admin' && (
        <VehicleFilter
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          customers={customers}
          loading={loading}
          vehicles={vehicles}
        />
      )}
      {user?.role === 'super_admin' && (
        <VehicleList selectedCustomerId={selectedCustomerId} loading={loading} vehicles={vehicles} />
      )}
      {canManageDashboardVehicles && (
        <section
          className="card"
          aria-label="Vehicle management"
          style={{ order: user?.role === 'customer_admin' ? 2 : 0 }}
        >
          <VehiclesTable
            customerId={vehicleManagementCustomerId}
            data={dashboardVehicleData}
            setData={updateDashboardVehicleData}
            user={user}
            vehicleExpenses={vehicleExpenses}
          />
        </section>
      )}
      {(loading || vehicles.length === 0) && (
        <div style={{ order: user?.role === 'customer_admin' ? 2 : 0 }}>
          {loading && <p>Loading...</p>}
          {!loading && vehicles.length === 0 && <p>No vehicles found for your account yet.</p>}
        </div>
      )}
      {user?.role === 'vehicle_user' && vehicles[0] && (
        <UserAccountCard user={user} vehicle={vehicles[0]} />
      )}
      {user?.role === 'vehicle_user' && (
        <DriverLeaveSection
          leaves={leaves}
          setLeaves={setLeaves}
          leavesLoading={leavesLoading}
          leaveError={leaveError}
          setLeaveError={setLeaveError}
        />
      )}
      {user?.role === 'vehicle_user' && vehicles[0] && (
        <ClosedTripHistory selectedVehicleId={selectedVehicleId} />
      )}
      {user?.role === 'customer_admin' && (
        <div style={{ order: 0 }}>
          <div data-dashboard-section="monthly-income">
            <MonthlyIncomeSection customerId={user.customer} className="customer-admin-income-section" />
          </div>
        </div>
      )}
      {user?.role === 'customer_admin' && (
        <div style={{ order: 1 }}>
          <div data-dashboard-section="salary-details">
            <SalarySection
              user={user}
              customerData={customerData}
              driverUsers={driverUsers}
              leaves={leaves}
              leavesLoading={leavesLoading}
            />
          </div>
        </div>
      )}
      {user?.role === 'customer_admin' && (
        <div style={{ order: 3 }}>
          <div data-dashboard-section="leave-entries">
            <AdminLeaveSection
              leaves={leaves}
              setLeaves={setLeaves}
              leavesLoading={leavesLoading}
              leaveError={leaveError}
              setLeaveError={setLeaveError}
              driverUsers={driverUsers}
            />
          </div>
        </div>
      )}
      {user?.role === 'customer_admin' && (
        <div style={{ order: 2 }}>
          <div data-dashboard-section="vehicle-driver-list">
            <DriverList
              user={user}
              vehicles={vehicles}
              setVehicles={setVehicles}
              customerData={customerData}
              setCustomerData={setCustomerData}
              driverUsers={allDriverUsers}
              vehicleExpenses={vehicleExpenses}
            />
          </div>
        </div>
      )}
      {['super_admin', 'customer_admin'].includes(user?.role) && (
        <div style={{ order: user?.role === 'customer_admin' ? 2 : 0 }}>
          <VehicleExpensesSection
            vehicles={vehicles}
            driverUsers={driverUsers}
            expenses={vehicleExpenses}
            loading={vehicleExpensesLoading}
            error={vehicleExpenseError}
          />
        </div>
      )}
      {canManageDashboardVehicles && (
        <div style={{ order: user?.role === 'customer_admin' ? 2 : 0 }}>
          <VehicleExpenseManagementSection
            vehicles={vehicles}
            customerId={vehicleManagementCustomerId}
          />
        </div>
      )}
      {['super_admin', 'customer_admin'].includes(user?.role) && (
        <div style={{ order: user?.role === 'customer_admin' ? 6 : 9999 }}>
          <div data-dashboard-section="vehicle-maintenance">
            <VehicleMaintenanceSection
              vehicles={vehicles}
              loading={loading}
              onVehicleUpdated={(updatedVehicle) => setVehicles((current) => current.map((vehicle) => (
                vehicle._id === updatedVehicle._id ? updatedVehicle : vehicle
              )))}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
