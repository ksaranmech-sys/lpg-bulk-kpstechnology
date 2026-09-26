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

// Preset vehicle running-cost categories; admins may also type a custom one.
export const VEHICLE_EXPENSE_CATEGORIES = Object.freeze([
  'Quarter Tax',
  '1 Year Permit',
  '5 Year Permit',
  'Insurance',
  'CLL Insurance',
  'PLI Insurance',
  'FC',
  'Oil Service',
  'Tyre',
  'Paint',
  'Purging',
  'Hydro',
  'Explosive',
]);

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
