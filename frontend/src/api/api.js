import axios from 'axios';
import { getSession, saveSession, clearSession } from './session';

// This client is intentionally framework-agnostic in shape: the React Native mobile app reuses
// the same request/refresh logic with a SecureStore-backed session module.
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

const api = axios.create({
  baseURL: getBaseURL(),
});

api.interceptors.request.use((config) => {
  const { token } = getSession();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function redirectToLogin() {
  clearSession();
  if (window.location.pathname !== '/login') window.location.href = '/login';
}

// Access tokens are short-lived (15 min). On the first 401 we swap the refresh token for a new
// pair and replay the original request; concurrent 401s share one refresh call.
let refreshPromise = null;
function refreshSession() {
  if (!refreshPromise) {
    const { refreshToken } = getSession();
    if (!refreshToken) return Promise.reject(new Error('No refresh token'));
    refreshPromise = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken })
      .then((res) => {
        saveSession(res.data);
        return res.data.token;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config || {};
    const isAuthCall = /\/auth\/(login|refresh)$/.test(original.url || '');
    if (err.response?.status !== 401 || original._retried || isAuthCall) {
      return Promise.reject(err);
    }
    try {
      const token = await refreshSession();
      original._retried = true;
      original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
      return api(original);
    } catch (refreshErr) {
      redirectToLogin();
      return Promise.reject(err);
    }
  }
);

// ---- Auth ----
export const login = (username, password) => api.post('/auth/login', { username, password });
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');

// ---- Meta ----
export const getMeta = () => api.get('/meta');
export const updateRouteKmTable = (routeKmTable, rowId, row) =>
  api.put('/meta/route-km', rowId && row ? { rowId, row } : { routeKmTable });

// ---- Vehicles ----
export const listVehicles = (customerId) =>
  api.get('/vehicles', { params: customerId ? { customerId } : {} });
export const getVehicle = (vehicleId) => api.get(`/vehicles/${vehicleId}`);
export const updateVehicle = (vehicleId, data) => api.patch(`/vehicles/${vehicleId}`, data);
export const deleteVehicle = (vehicleId) => api.delete(`/vehicles/${vehicleId}`);
export const updateVehicleReminderDates = (vehicleId, data) =>
  api.patch(`/vehicles/${vehicleId}/document-reminders`, data);
export const sendVehicleReminder = (vehicleId, type) =>
  api.post(`/vehicles/${vehicleId}/reminders/send`, { type });

// ---- Trips ----
export const listTripsForVehicle = (vehicleId, status) =>
  api.get(`/vehicles/${vehicleId}/trips`, { params: status ? { status } : {} });
export const createTrip = (vehicleId, data) => api.post(`/vehicles/${vehicleId}/trips`, data);
export const getTrip = (tripId) => api.get(`/trips/${tripId}`);
export const deleteTrip = (tripId) => api.delete(`/trips/${tripId}`);
export const addAdvance = (tripId, data) => api.post(`/trips/${tripId}/advances`, data);
export const updateAdvance = (tripId, index, data) => api.patch(`/trips/${tripId}/advances/${index}`, data);
export const deleteAdvance = (tripId, index) => api.delete(`/trips/${tripId}/advances/${index}`);
export const setLoadingDetails = (tripId, data) => api.patch(`/trips/${tripId}/loading`, data);
export const setLoadingDetailsWithPhoto = (tripId, fields, file) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') fd.append(k, v);
  });
  if (file) fd.append('parkingPhoto', file);
  return api.patch(`/trips/${tripId}/loading`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deleteLoadingExpense = (tripId) => api.delete(`/trips/${tripId}/loading-expense`);
export const setUnloading = (tripId, data) => api.patch(`/trips/${tripId}/unloading`, data);
export const setTurnDetails = (tripId, data) => api.patch(`/trips/${tripId}/turn`, data);
export const setUnloadingTurnDetails = (tripId, data) => api.patch(`/trips/${tripId}/unloading-turn`, data);
export const deleteUnloadingTurnDetails = (tripId) => api.delete(`/trips/${tripId}/unloading-turn`);
export const closeTrip = (tripId) => api.post(`/trips/${tripId}/close`);
export const sendReport = (tripId) => api.post(`/trips/${tripId}/send-report`);
export const reportDownloadUrl = (tripId) =>
  `${api.defaults.baseURL}/trips/${tripId}/report`;

// Multipart helpers for diesel/RTO/other-expense (photo + optional GPS)
function buildFormData(fields, file) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null) fd.append(k, v);
  });
  if (file) fd.append('photo', file);
  return fd;
}

export const addDieselEntry = (tripId, fields, file) =>
  api.post(`/trips/${tripId}/diesel`, buildFormData(fields, file), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const updateDieselEntry = (tripId, index, data) => api.patch(`/trips/${tripId}/diesel/${index}`, data);
export const deleteDieselEntry = (tripId, index) => api.delete(`/trips/${tripId}/diesel/${index}`);

export const addRtoEntry = (tripId, fields, file) =>
  api.post(`/trips/${tripId}/rto`, buildFormData(fields, file), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const updateRtoEntry = (tripId, index, data) => api.patch(`/trips/${tripId}/rto/${index}`, data);

export const addOtherExpense = (tripId, fields, file) =>
  api.post(`/trips/${tripId}/other-expenses`, buildFormData(fields, file), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const updateOtherExpense = (tripId, index, data) => api.patch(`/trips/${tripId}/other-expenses/${index}`, data);
export const deleteOtherExpense = (tripId, index) => api.delete(`/trips/${tripId}/other-expenses/${index}`);

// ---- Customer / admin management ----
export const createCustomer = (data) => api.post('/customers', data);
export const listCustomers = () => api.get('/customers');
export const getCustomer = (customerId) => api.get(`/customers/${customerId}`);
export const getDriverMonthlySalary = (customerId, driverId, month) =>
  api.get(`/customers/${customerId}/users/${driverId}/salary`, { params: { month } });
export const downloadDriverMonthlySummary = (customerId, driverId, month) =>
  api.get(`/customers/${customerId}/users/${driverId}/monthly-summary`, {
    params: { month },
    responseType: 'blob',
  });
// Direct browser URL for the salary PDF - opened in a new tab so the PDF viewer's "Save"
// uses the server's Content-Disposition filename instead of a random blob UUID.
export const getDriverMonthlySummaryUrl = async (customerId, driverId, month) => {
  const res = await api.post(`/customers/${customerId}/users/${driverId}/monthly-summary/token`, null, { params: { month } });
  const query = new URLSearchParams({ month, token: res.data.token });
  return `${api.defaults.baseURL}/customers/${customerId}/users/${driverId}/monthly-summary?${query}`;
};
export const updateCustomer = (customerId, data) => api.patch(`/customers/${customerId}`, data);
export const setCustomerStatus = (customerId, isActive) =>
  api.patch(`/customers/${customerId}/status`, { isActive });
export const deleteCustomer = (customerId) => api.delete(`/customers/${customerId}`);
export const addVehicleToCustomer = (customerId, data) => api.post(`/customers/${customerId}/vehicles`, data);
export const createVehicleUser = (customerId, data) => api.post(`/customers/${customerId}/users`, data);
export const updateVehicleUser = (customerId, userId, data) => api.patch(`/customers/${customerId}/users/${userId}`, data);
export const deleteVehicleUser = (customerId, userId) => api.delete(`/customers/${customerId}/users/${userId}`);
export const bulkUpdateVehicleUsers = (customerId, updates) => api.patch(`/customers/${customerId}/users/bulk`, { updates });
export const bulkDeleteVehicleUsers = (customerId, userIds) => api.delete(`/customers/${customerId}/users/bulk`, { data: { userIds } });

// ---- Leave entries ----
export const listLeaves = (customerId) => api.get('/leaves', { params: customerId ? { customerId } : {} });
export const createLeave = (data) => api.post('/leaves', data);
export const updateLeave = (leaveId, data) => api.patch(`/leaves/${leaveId}`, data);
export const deleteLeave = (leaveId) => api.delete(`/leaves/${leaveId}`);

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
