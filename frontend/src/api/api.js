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

// Shrinks a camera photo before upload (max 1024px on the long edge, JPEG ~60%) so a 4-8 MB
// phone picture becomes a few hundred KB. Falls back to the original file if the browser can't
// decode it (e.g. HEIC) or anything goes wrong.
const PHOTO_MAX_EDGE = 1024;
const PHOTO_JPEG_QUALITY = 0.6;
export async function compressPhoto(file) {
  if (!file || typeof window === 'undefined' || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const name = String(file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (err) {
    return file;
  }
}

// Every photo-carrying endpoint compresses the file first.
const withCompressedPhoto = (fn) => async (tripId, fields, file, ...rest) => fn(tripId, fields, await compressPhoto(file), ...rest);
export const setLoadingDetailsWithPhoto = withCompressedPhoto(client.setLoadingDetailsWithPhoto);
export const addDieselEntry = withCompressedPhoto(client.addDieselEntry);
export const addRtoEntry = withCompressedPhoto(client.addRtoEntry);
export const addOtherExpense = withCompressedPhoto(client.addOtherExpense);

export const {
  login, logout, getMe, changePassword, setRecoveryContact, forgotPassword, resetPasswordWithCode,
  getMeta, updateRouteKmTable, updateMobileAppUrl,
  listVehicles, getVehicle, updateVehicle, deleteVehicle, updateVehicleReminderDates, sendVehicleReminder,
  listTripsForVehicle, createTrip, getTrip, deleteTrip,
  addAdvance, updateAdvance, deleteAdvance,
  setLoadingDetails, deleteLoadingExpense,
  setUnloading, setTurnDetails, setUnloadingTurnDetails, deleteUnloadingTurnDetails,
  closeTrip, sendReport, reportDownloadUrl,
  updateDieselEntry, deleteDieselEntry,
  updateRtoEntry,
  updateOtherExpense, deleteOtherExpense,
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
