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
        <VehicleReminderEditor
          vehicles={vehicles}
          setVehicles={setVehicles}
        />
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
        <OpenTripsCard
          loading={loading}
          vehicles={vehicles}
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={setSelectedVehicleId}
        />
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
        <section className="card" aria-label="Vehicle management">
          <VehiclesTable
            customerId={vehicleManagementCustomerId}
            data={dashboardVehicleData}
            setData={updateDashboardVehicleData}
            user={user}
            vehicleExpenses={vehicleExpenses}
          />
        </section>
      )}
      {loading && <p>Loading...</p>}
      {!loading && vehicles.length === 0 && <p>No vehicles found for your account yet.</p>}
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
        <MonthlyIncomeSection customerId={user.customer} className="customer-admin-income-section" />
      )}
      {user?.role === 'customer_admin' && (
        <SalarySection
          user={user}
          customerData={customerData}
          driverUsers={driverUsers}
          leaves={leaves}
          leavesLoading={leavesLoading}
        />
      )}
      {user?.role === 'customer_admin' && (
        <AdminLeaveSection
          leaves={leaves}
          setLeaves={setLeaves}
          leavesLoading={leavesLoading}
          leaveError={leaveError}
          setLeaveError={setLeaveError}
          driverUsers={driverUsers}
        />
      )}
      {user?.role === 'customer_admin' && (
        <DriverList
          user={user}
          vehicles={vehicles}
          setVehicles={setVehicles}
          customerData={customerData}
          setCustomerData={setCustomerData}
          driverUsers={allDriverUsers}
          vehicleExpenses={vehicleExpenses}
        />
      )}
      {['super_admin', 'customer_admin'].includes(user?.role) && (
        <VehicleExpensesSection
          vehicles={vehicles}
          driverUsers={driverUsers}
          expenses={vehicleExpenses}
          loading={vehicleExpensesLoading}
          error={vehicleExpenseError}
        />
      )}
      {canManageDashboardVehicles && (
        <VehicleExpenseManagementSection
          vehicles={vehicles}
          customerId={vehicleManagementCustomerId}
        />
      )}
      {['super_admin', 'customer_admin'].includes(user?.role) && (
        <VehicleMaintenanceSection
          vehicles={vehicles}
          loading={loading}
          onVehicleUpdated={(updatedVehicle) => setVehicles((current) => current.map((vehicle) => (
            vehicle._id === updatedVehicle._id ? updatedVehicle : vehicle
          )))}
        />
      )}
    </Layout>
  );
}
