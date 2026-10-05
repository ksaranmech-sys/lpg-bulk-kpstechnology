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

// Diesel entry sanity limits (keep in sync with backend constants DIESEL_MIN_LITRES /
// DIESEL_MIN_RATE_PER_LITRE): a fill must be more than 5 L and cost more than Rs 50 per litre.
export const DIESEL_ENTRY_LIMITS = Object.freeze({ minLitres: 5, minRatePerLitre: 50 });

// Returns a user-facing message when a diesel fill breaks the limits above, else null.
export function dieselEntryError(volumeLitres, totalValue) {
  const volume = Number(volumeLitres);
  const amount = Number(totalValue);
  if (!Number.isFinite(volume) || !Number.isFinite(amount) || volume <= 0 || amount < 0) {
    return 'Enter the litres filled and the total amount.';
  }
  if (volume <= DIESEL_ENTRY_LIMITS.minLitres) return `Diesel volume must be more than ${DIESEL_ENTRY_LIMITS.minLitres} litres.`;
  const rate = amount / volume;
  if (rate <= DIESEL_ENTRY_LIMITS.minRatePerLitre) {
    return `Diesel price must be more than Rs ${DIESEL_ENTRY_LIMITS.minRatePerLitre} per litre (entered ${rate.toFixed(2)}/L) - check the litres and total amount.`;
  }
  return null;
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
