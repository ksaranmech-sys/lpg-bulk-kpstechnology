import axios from 'axios';

/**
 * Builds the authenticated HTTP client used by both the web app and the mobile app.
 *
 * @param {object} options
 * @param {string} options.baseURL              e.g. '/api/v1' or 'https://api.example.com/api/v1'
 * @param {object} options.session              { getSession(), saveSession({token,refreshToken,user}), clearSession() }
 *                                              getSession may be sync (web) or async (mobile SecureStore).
 * @param {function} [options.onSessionExpired] Called when the refresh token is rejected; the app
 *                                              should navigate to its login screen.
 */
export function createApiClient({ baseURL, session, onSessionExpired }) {
  // 60s covers a Render free-tier cold start; without a timeout a dead connection hangs forever.
  const http = axios.create({ baseURL, timeout: 60000 });

  http.interceptors.request.use(async (config) => {
    const { token } = (await session.getSession()) || {};
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // Access tokens are short-lived. On the first 401 we swap the refresh token for a new pair and
  // replay the original request; concurrent 401s share one refresh call.
  let refreshPromise = null;
  async function refreshSession() {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const { refreshToken } = (await session.getSession()) || {};
        if (!refreshToken) throw new Error('No refresh token');
        const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        await session.saveSession(res.data);
        return res.data.token;
      })().finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  }

  http.interceptors.response.use(
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
        return http(original);
      } catch (refreshErr) {
        await session.clearSession();
        if (onSessionExpired) onSessionExpired();
        return Promise.reject(err);
      }
    }
  );

  return { http, ...createEndpoints(http) };
}

// Multipart body for photo uploads. `file` is a browser File on web, or { uri, name, type } on
// React Native - FormData.append accepts both.
function buildFormData(fields, file, fileField = 'photo') {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') fd.append(key, value);
  });
  if (file) fd.append(fileField, file);
  return fd;
}

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

export function createEndpoints(api) {
  return {
    // ---- Auth ----
    login: (username, password) => api.post('/auth/login', { username, password }),
    logout: () => api.post('/auth/logout'),
    getMe: () => api.get('/auth/me'),
    changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }),
    setRecoveryContact: (data) => api.post('/auth/recovery-contact', data),
    forgotPassword: (username, recoveryMobile) => api.post('/auth/forgot-password', { username, recoveryMobile }),
    resetPasswordWithCode: (username, code, newPassword) => api.post('/auth/reset-password-with-code', { username, code, newPassword }),

    // ---- Meta ----
    getMeta: () => api.get('/meta'),
    updateRouteKmTable: (routeKmTable, rowId, row) =>
      api.put('/meta/route-km', rowId && row ? { rowId, row } : { routeKmTable }),
    updateMobileAppUrl: (mobileAppUrl) => api.put('/meta/mobile-app-url', { mobileAppUrl }),

    // ---- Vehicles ----
    listVehicles: (customerId) => api.get('/vehicles', { params: customerId ? { customerId } : {} }),
    getVehicle: (vehicleId) => api.get(`/vehicles/${vehicleId}`),
    updateVehicle: (vehicleId, data) => api.patch(`/vehicles/${vehicleId}`, data),
    deleteVehicle: (vehicleId) => api.delete(`/vehicles/${vehicleId}`),
    updateVehicleReminderDates: (vehicleId, data) => api.patch(`/vehicles/${vehicleId}/document-reminders`, data),
    sendVehicleReminder: (vehicleId, type) => api.post(`/vehicles/${vehicleId}/reminders/send`, { type }),

    // ---- Trips ----
    listTripsForVehicle: (vehicleId, status) =>
      api.get(`/vehicles/${vehicleId}/trips`, { params: status ? { status } : {} }),
    createTrip: (vehicleId, data) => api.post(`/vehicles/${vehicleId}/trips`, data),
    getTrip: (tripId) => api.get(`/trips/${tripId}`),
    deleteTrip: (tripId) => api.delete(`/trips/${tripId}`),
    addAdvance: (tripId, data) => api.post(`/trips/${tripId}/advances`, data),
    updateAdvance: (tripId, index, data) => api.patch(`/trips/${tripId}/advances/${index}`, data),
    deleteAdvance: (tripId, index) => api.delete(`/trips/${tripId}/advances/${index}`),
    setLoadingDetails: (tripId, data) => api.patch(`/trips/${tripId}/loading`, data),
    setLoadingDetailsWithPhoto: (tripId, fields, file) =>
      api.patch(`/trips/${tripId}/loading`, buildFormData(fields, file, 'parkingPhoto'), multipart),
    deleteLoadingExpense: (tripId) => api.delete(`/trips/${tripId}/loading-expense`),
    setUnloading: (tripId, data) => api.patch(`/trips/${tripId}/unloading`, data),
    setTurnDetails: (tripId, data) => api.patch(`/trips/${tripId}/turn`, data),
    setUnloadingTurnDetails: (tripId, data) => api.patch(`/trips/${tripId}/unloading-turn`, data),
    deleteUnloadingTurnDetails: (tripId) => api.delete(`/trips/${tripId}/unloading-turn`),
    closeTrip: (tripId) => api.post(`/trips/${tripId}/close`),
    sendReport: (tripId) => api.post(`/trips/${tripId}/send-report`),
    reportDownloadUrl: (tripId) => `${api.defaults.baseURL}/trips/${tripId}/report`,

    addDieselEntry: (tripId, fields, file) => api.post(`/trips/${tripId}/diesel`, buildFormData(fields, file), multipart),
    updateDieselEntry: (tripId, index, data) => api.patch(`/trips/${tripId}/diesel/${index}`, data),
    deleteDieselEntry: (tripId, index) => api.delete(`/trips/${tripId}/diesel/${index}`),

    addRtoEntry: (tripId, fields, file) => api.post(`/trips/${tripId}/rto`, buildFormData(fields, file), multipart),
    updateRtoEntry: (tripId, index, data) => api.patch(`/trips/${tripId}/rto/${index}`, data),

    addOtherExpense: (tripId, fields, file) => api.post(`/trips/${tripId}/other-expenses`, buildFormData(fields, file), multipart),
    updateOtherExpense: (tripId, index, data) => api.patch(`/trips/${tripId}/other-expenses/${index}`, data),
    deleteOtherExpense: (tripId, index) => api.delete(`/trips/${tripId}/other-expenses/${index}`),

    // ---- Customer / admin management ----
    createCustomer: (data) => api.post('/customers', data),
    listCustomers: () => api.get('/customers'),
    getCustomer: (customerId) => api.get(`/customers/${customerId}`),
    getDriverMonthlySalary: (customerId, driverId, month) =>
      api.get(`/customers/${customerId}/users/${driverId}/salary`, { params: { month } }),
    downloadDriverMonthlySummary: (customerId, driverId, month, which = 'regular') =>
      api.get(`/customers/${customerId}/users/${driverId}/monthly-summary`, { params: { month, driver: which }, responseType: 'blob' }),
    // Direct URL for the salary PDF, carrying a 2-minute scoped token so it can open in a new tab.
    // `which` is 'regular' (the driver's own PDF) or 'temporary' (the temporary driver's PDF).
    getDriverMonthlySummaryUrl: async (customerId, driverId, month, which = 'regular') => {
      const res = await api.post(`/customers/${customerId}/users/${driverId}/monthly-summary/token`, null, { params: { month, driver: which } });
      const query = new URLSearchParams({ month, driver: which, token: res.data.token });
      return `${api.defaults.baseURL}/customers/${customerId}/users/${driverId}/monthly-summary?${query}`;
    },
    updateCustomer: (customerId, data) => api.patch(`/customers/${customerId}`, data),
    setCustomerStatus: (customerId, isActive) => api.patch(`/customers/${customerId}/status`, { isActive }),
    deleteCustomer: (customerId) => api.delete(`/customers/${customerId}`),
    addVehicleToCustomer: (customerId, data) => api.post(`/customers/${customerId}/vehicles`, data),
    createVehicleUser: (customerId, data) => api.post(`/customers/${customerId}/users`, data),
    updateVehicleUser: (customerId, userId, data) => api.patch(`/customers/${customerId}/users/${userId}`, data),
    deleteVehicleUser: (customerId, userId) => api.delete(`/customers/${customerId}/users/${userId}`),
    bulkUpdateVehicleUsers: (customerId, updates) => api.patch(`/customers/${customerId}/users/bulk`, { updates }),
    bulkDeleteVehicleUsers: (customerId, userIds) => api.delete(`/customers/${customerId}/users/bulk`, { data: { userIds } }),

    // ---- Leave entries ----
    listLeaves: (customerId) => api.get('/leaves', { params: customerId ? { customerId } : {} }),
    createLeave: (data) => api.post('/leaves', data),
    updateLeave: (leaveId, data) => api.patch(`/leaves/${leaveId}`, data),
    deleteLeave: (leaveId) => api.delete(`/leaves/${leaveId}`),

    // ---- Vehicle expenses ----
    listVehicleExpenses: (params = {}) => api.get('/vehicle-expenses', { params }),
    createVehicleExpense: (data) => api.post('/vehicle-expenses', data),
    updateVehicleExpense: (expenseId, data) => api.patch(`/vehicle-expenses/${expenseId}`, data),
    deleteVehicleExpense: (expenseId) => api.delete(`/vehicle-expenses/${expenseId}`),
  };
}
