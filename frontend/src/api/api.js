import { createApiClient } from '@kps/shared';
import * as session from './session';

function getBaseURL() {
  const envUrl = process.env.REACT_APP_API_BASE_URL;
  // In a browser environment, if envUrl is missing, relative, or points to a vercel.app domain,
  // prefer relative '/api/v1' to ensure same-origin requests on custom domains (e.g. lpg-bulk.kpstechnology.in).
  if (typeof window !== 'undefined') {
    if (!envUrl || envUrl.startsWith('/') || envUrl.includes('.vercel.app')) {
      return '/api/v1';
    }
  }
  return envUrl || '/api/v1';
}

const client = createApiClient({
  baseURL: getBaseURL(),
  session,
  onSessionExpired() {
    if (window.location.pathname !== '/login') window.location.href = '/login';
  },
});

const api = client.http;

export const {
  login, logout, getMe, changePassword, setRecoveryContact, forgotPassword, resetPasswordWithCode,
  getMeta, updateRouteKmTable,
  listVehicles, getVehicle, updateVehicle, deleteVehicle, updateVehicleReminderDates, sendVehicleReminder,
  listTripsForVehicle, createTrip, getTrip, deleteTrip,
  addAdvance, updateAdvance, deleteAdvance,
  setLoadingDetails, setLoadingDetailsWithPhoto, deleteLoadingExpense,
  setUnloading, setTurnDetails, setUnloadingTurnDetails, deleteUnloadingTurnDetails,
  closeTrip, sendReport, reportDownloadUrl,
  addDieselEntry, updateDieselEntry, deleteDieselEntry,
  addRtoEntry, updateRtoEntry,
  addOtherExpense, updateOtherExpense, deleteOtherExpense,
  createCustomer, listCustomers, getCustomer,
  getDriverMonthlySalary, downloadDriverMonthlySummary, getDriverMonthlySummaryUrl,
  updateCustomer, setCustomerStatus, deleteCustomer,
  addVehicleToCustomer, createVehicleUser, updateVehicleUser, deleteVehicleUser,
  bulkUpdateVehicleUsers, bulkDeleteVehicleUsers,
  listLeaves, createLeave, updateLeave, deleteLeave,
} = client;

// Helper: grab the browser's current GPS position (used before RTO/diesel/expense uploads)
export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    );
  });
}

export default api;
