export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  CUSTOMER_ADMIN: 'customer_admin',
  VEHICLE_USER: 'vehicle_user',
};

export const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN];

export const TRIP_STATUS = {
  OPEN: 'open',
  PENDING_CLOSE: 'pending_close',
  CLOSED: 'closed',
};

export function isAdmin(user) {
  return ADMIN_ROLES.includes(user?.role);
}

// Blank form state for the create/edit driver forms (web and mobile share the same fields).
export const EMPTY_DRIVER_FORM = Object.freeze({
  name: '',
  mobileNumber: '',
  joiningDate: '',
  resigningDate: '',
  username: '',
  password: '',
  vehicleId: '',
  basicSalary: '',
  kmCharges: '',
  minKmCharges: '',
  temporaryDriverRequired: false,
  temporaryDriverName: '',
  temporaryDriverJoiningDate: '',
  temporaryDriverReturningDate: '',
});
