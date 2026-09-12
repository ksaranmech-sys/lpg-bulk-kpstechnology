const Leave = require('../models/Leave');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

// GET /api/v1/leaves
// customer_admin -> all leave entries for drivers under their customer
// vehicle_user   -> only their own leave entries
// super_admin    -> all leave entries (optionally filter by ?customerId=)
async function listLeaves(req, res) {
  const { user } = req;
  const filter = {};

  if (user.role === ROLES.CUSTOMER_ADMIN) {
    filter.customer = user.customer;
  } else if (user.role === ROLES.VEHICLE_USER) {
    filter.driver = user.id;
  } else if (user.role === ROLES.SUPER_ADMIN && req.query.customerId) {
    filter.customer = req.query.customerId;
  }

  const leaves = await Leave.find(filter)
    .populate('driver', 'name username mobileNumber vehicle')
    .sort('-startDate');
  const validLeaves = leaves.filter((leave) => leave.driver);
  const orphanedLeaveIds = leaves.filter((leave) => !leave.driver).map((leave) => leave._id);
  if (orphanedLeaveIds.length > 0) {
    await Leave.deleteMany({ _id: { $in: orphanedLeaveIds } });
  }
  res.json({ leaves: validLeaves.map((leave) => leave.toObject()) });
}

// POST /api/v1/leaves   body: { startDate, endDate, reason, driverId? }
// vehicle_user submits their own leave; customer_admin/super_admin may submit on behalf of a driver via driverId.
async function createLeave(req, res) {
  const { user } = req;
  const { startDate, endDate, reason, driverId } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ error: 'startDate and endDate must be valid dates' });
  }
  if (end < start) {
    return res.status(400).json({ error: 'endDate cannot be before startDate' });
  }

  let driver;
  if (user.role === ROLES.VEHICLE_USER) {
    driver = await User.findById(user.id);
  } else {
    if (!driverId) return res.status(400).json({ error: 'driverId is required' });
    driver = await User.findOne({ _id: driverId, role: ROLES.VEHICLE_USER });
    if (driver && user.role === ROLES.CUSTOMER_ADMIN && String(driver.customer) !== String(user.customer)) {
      return res.status(403).json({ error: 'Driver does not belong to your account' });
    }
  }
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  const leave = await Leave.create({
    customer: driver.customer,
    driver: driver._id,
    startDate: start,
    endDate: end,
    reason: reason ? String(reason).trim() : undefined,
    createdBy: user.id,
  });

  const populated = await leave.populate('driver', 'name username mobileNumber vehicle');
  res.status(201).json({ leave: populated.toObject() });
}

// PATCH /api/v1/leaves/:leaveId   body: { startDate, endDate, reason }
async function updateLeave(req, res) {
  const { user } = req;
  const leave = await Leave.findById(req.params.leaveId);
  if (!leave) return res.status(404).json({ error: 'Leave entry not found' });

  if (user.role === ROLES.VEHICLE_USER && String(leave.driver) !== String(user.id)) {
    return res.status(403).json({ error: 'Not allowed to edit this leave entry' });
  }
  if (user.role === ROLES.CUSTOMER_ADMIN && String(leave.customer) !== String(user.customer)) {
    return res.status(403).json({ error: 'Not allowed to edit this leave entry' });
  }
  const { startDate, endDate, reason } = req.body;
  const start = startDate != null ? new Date(startDate) : leave.startDate;
  const end = endDate != null ? new Date(endDate) : leave.endDate;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ error: 'startDate and endDate must be valid dates' });
  }
  if (end < start) {
    return res.status(400).json({ error: 'endDate cannot be before startDate' });
  }

  leave.startDate = start;
  leave.endDate = end;
  if (reason !== undefined) leave.reason = reason ? String(reason).trim() : undefined;
  await leave.save();

  const populated = await leave.populate('driver', 'name username mobileNumber vehicle');
  res.json({ leave: populated.toObject() });
}

// DELETE /api/v1/leaves/:leaveId
async function deleteLeave(req, res) {
  const { user } = req;
  const leave = await Leave.findById(req.params.leaveId);
  if (!leave) return res.status(404).json({ error: 'Leave entry not found' });

  if (user.role === ROLES.VEHICLE_USER && String(leave.driver) !== String(user.id)) {
    return res.status(403).json({ error: 'Not allowed to delete this leave entry' });
  }
  if (user.role === ROLES.CUSTOMER_ADMIN && String(leave.customer) !== String(user.customer)) {
    return res.status(403).json({ error: 'Not allowed to delete this leave entry' });
  }
  await leave.deleteOne();
  res.json({ message: 'Leave entry deleted successfully', leaveId: req.params.leaveId });
}

module.exports = { listLeaves, createLeave, updateLeave, deleteLeave };
