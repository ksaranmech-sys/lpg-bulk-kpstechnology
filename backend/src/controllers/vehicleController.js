const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Trip = require('../models/Trip');
const { ROLES } = require('../config/constants');
const { sendVehicleReminderEmail } = require('../utils/mailer');

const REMINDER_DEFINITIONS = {
  qTax: { label: 'QTax', reminderDays: 0 },
  fitness: { label: 'Fitness', reminderDays: 15 },
  permitOneYear: { label: '1 year permit', reminderDays: 15 },
  permitFiveYear: { label: '5 year permit', reminderDays: 15 },
  purging: { label: 'Purging', reminderDays: 15 },
  explosive: { label: 'Explosive', reminderDays: 15 },
  pli: { label: 'PLI', reminderDays: 15 },
  vehicleInsurance: { label: 'Vehicle Insurance', reminderDays: 15 },
  hydroCertificate: { label: 'Hydro certificate', reminderDays: 15 },
};

function getDocumentReminderStatus(doc, key) {
  if (!doc || !doc.expiryDate) return { due: false, status: 'Not set' };

  const expiry = new Date(doc.expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  const threshold = REMINDER_DEFINITIONS[key]?.reminderDays ?? 15;

  if (diffDays < 0) return { due: true, status: `Expired ${Math.abs(diffDays)} day(s) ago` };
  if (diffDays <= threshold) return { due: true, status: `${diffDays} day(s) remaining` };
  return { due: false, status: `${diffDays} day(s) remaining` };
}

async function withVehicleDetails(vehicles) {
  const vehicleIds = vehicles.map((vehicle) => vehicle._id);
  const drivers = await User.find({ role: ROLES.VEHICLE_USER, isActive: true, vehicle: { $in: vehicleIds } }).select('name mobileNumber vehicle');
  const driverByVehicle = new Map(drivers.map((driver) => [String(driver.vehicle), driver]));

  return vehicles.map((vehicle) => {
    const result = vehicle.toObject();
    const driver = driverByVehicle.get(String(vehicle._id));
    const documentReminders = {};
    Object.entries(REMINDER_DEFINITIONS).forEach(([key, def]) => {
      const doc = result.documentReminders?.[key] || {};
      documentReminders[key] = {
        ...doc,
        label: def.label,
        reminderDays: def.reminderDays,
        ...getDocumentReminderStatus(doc, key),
      };
    });
    return {
      ...result,
      documentReminders,
      customerName: result.customer?.companyName || null,
      driverName: driver?.name || null,
      driverMobile: driver?.mobileNumber || null,
    };
  });
}

// GET /api/v1/vehicles
// customer_admin -> all vehicles under their customer
// vehicle_user   -> just their single assigned vehicle
// super_admin    -> all vehicles (optionally filter by ?customerId=)
async function listVehicles(req, res) {
  const { user } = req;
  let filter = {};

  if (user.role === ROLES.CUSTOMER_ADMIN) {
    filter.customer = user.customer;
  } else if (user.role === ROLES.VEHICLE_USER) {
    filter._id = user.vehicle;
  } else if (user.role === ROLES.SUPER_ADMIN && req.query.customerId) {
    filter.customer = req.query.customerId;
  }

  const vehicles = await Vehicle.find(filter).populate('customer', 'companyName').sort('vehicleNumber');
  res.json({ vehicles: await withVehicleDetails(vehicles) });
}

// GET /api/v1/vehicles/:vehicleId
async function getVehicle(req, res) {
  const vehicle = await Vehicle.findById(req.params.vehicleId).populate('customer', 'companyName');
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json({ vehicle: (await withVehicleDetails([vehicle]))[0] });
}

async function updateVehicle(req, res) {
  const { vehicleId } = req.params;
  const { vehicleNumber, customerId, isActive } = req.body || {};

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  if (vehicleNumber !== undefined) {
    const trimmed = String(vehicleNumber).trim();
    if (!trimmed) return res.status(400).json({ error: 'vehicleNumber is required' });

    const normalized = trimmed.toUpperCase();
    const existing = await Vehicle.findOne({ _id: { $ne: vehicleId }, customer: vehicle.customer, vehicleNumber: normalized });
    if (existing) return res.status(409).json({ error: 'Vehicle number is already in use for this customer' });
    vehicle.vehicleNumber = normalized;
  }

  if (typeof isActive === 'boolean') {
    vehicle.isActive = isActive;
  }

  if (customerId && req.user?.role === ROLES.SUPER_ADMIN) {
    const targetCustomer = await Customer.findById(customerId).select('_id');
    if (!targetCustomer) return res.status(404).json({ error: 'Customer not found' });
    vehicle.customer = customerId;
  }

  await vehicle.save();
  res.json({ vehicle: (await withVehicleDetails([vehicle]))[0] });
}

async function deleteVehicle(req, res) {
  const { vehicleId } = req.params;
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  await Promise.all([
    User.deleteMany({ vehicle: vehicleId }),
    Trip.deleteMany({ vehicle: vehicleId }),
    vehicle.deleteOne(),
  ]);

  res.json({ message: 'Vehicle deleted successfully', vehicleId });
}

async function updateVehicleReminderDates(req, res) {
  const vehicle = await Vehicle.findById(req.params.vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const updates = req.body?.documentReminders || {};
  const nextDocumentReminders = { ...vehicle.documentReminders?.toObject ? vehicle.documentReminders.toObject() : (vehicle.documentReminders || {}) };

  Object.entries(REMINDER_DEFINITIONS).forEach(([key]) => {
    const rawValue = updates[key]?.expiryDate;
    const current = nextDocumentReminders[key] || {};
    current.expiryDate = rawValue ? new Date(rawValue) : null;
    current.lastReminderSentAt = current.lastReminderSentAt || null;
    nextDocumentReminders[key] = current;
  });

  vehicle.documentReminders = nextDocumentReminders;
  await vehicle.save();

  res.json({ vehicle: (await withVehicleDetails([vehicle]))[0] });
}

async function sendVehicleReminder(req, res) {
  const vehicle = await Vehicle.findById(req.params.vehicleId).populate('customer', 'companyName email');
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const type = req.body?.type;
  const config = REMINDER_DEFINITIONS[type];
  if (!config) return res.status(400).json({ error: 'Invalid reminder type' });

  const reminder = vehicle.documentReminders?.[type];
  if (!reminder || !reminder.expiryDate) {
    return res.status(400).json({ error: 'Expiry date not set for this reminder' });
  }

  const to = process.env.COMPANY_EMAIL || vehicle.customer?.email;
  if (!to) return res.status(400).json({ error: 'No email address available for reminder delivery' });

  await sendVehicleReminderEmail({
    vehicleNumber: vehicle.vehicleNumber,
    documentLabel: config.label,
    expiryDate: reminder.expiryDate,
    to,
    cc: vehicle.customer?.email,
  });

  reminder.lastReminderSentAt = new Date();
  await vehicle.save();

  res.json({ message: 'Reminder email sent successfully', reminder: type, sentAt: reminder.lastReminderSentAt });
}

module.exports = { listVehicles, getVehicle, updateVehicle, deleteVehicle, updateVehicleReminderDates, sendVehicleReminder };
