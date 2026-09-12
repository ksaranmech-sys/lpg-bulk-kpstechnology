// Central place for enums so web + mobile clients can fetch them via
// GET /api/v1/meta and never hardcode dropdown values.

const LOADING_LOCATIONS = [];

const UNLOADING_LOCATIONS = [
  'Trichy',
  'Chengalpattu',
  'Madurai',
  'Manargudi',
  'Mayladuthurai',
  'Coimbatore',
  'Belgaum',
  'Shimoga',
  'Devanagunthi',
];

const ROUTE_KM_TABLE = [
  { loadingLocation: 'MRPL', corporation: 'KPS', unloadingLocation: 'Belgaum', km: 450 },
  { loadingLocation: 'AEGIS-Mangalore', corporation: 'KPS', unloadingLocation: 'Trichy', km: 620 },
  { loadingLocation: 'Total-Mangalore', corporation: 'KPS', unloadingLocation: 'Chengalpattu', km: 510 },
];

const ROLES = {
  SUPER_ADMIN: 'super_admin', // KPS Technology staff
  CUSTOMER_ADMIN: 'customer_admin', // full access to all vehicles under their customer/subgroup
  VEHICLE_USER: 'vehicle_user', // access limited to a single assigned vehicle
};

const TRIP_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
};

module.exports = {
  LOADING_LOCATIONS,
  UNLOADING_LOCATIONS,
  ROUTE_KM_TABLE,
  ROLES,
  TRIP_STATUS,
};
