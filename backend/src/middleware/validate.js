const { body, param, validationResult } = require('express-validator');

// Runs the given express-validator chains and turns the first failure into a 400 JSON error,
// matching the { error: '...' } shape the rest of the API uses.
function validate(chains) {
  return [
    ...chains,
    (req, res, next) => {
      const result = validationResult(req);
      if (result.isEmpty()) return next();
      const first = result.array({ onlyFirstError: true })[0];
      return res.status(400).json({ error: first.msg, field: first.path });
    },
  ];
}

const objectId = (field, where = param) => where(field).isMongoId().withMessage(`${field} is not a valid id`);
const optionalString = (field, max = 200) => body(field).optional({ values: 'falsy' }).isString().trim().isLength({ max }).withMessage(`${field} is too long`);
const optionalNumber = (field) => body(field).optional({ values: 'null' }).isFloat({ min: 0 }).withMessage(`${field} must be a positive number`);
const optionalDate = (field) => body(field).optional({ values: 'falsy' }).isISO8601().withMessage(`${field} must be a valid date`);
const password = (field = 'password') => body(field).isString().isLength({ min: 6, max: 128 }).withMessage(`${field} must be 6-128 characters`);
const username = (field = 'username') => body(field).isString().trim().toLowerCase().isLength({ min: 3, max: 50 }).matches(/^[a-z0-9._@-]+$/).withMessage(`${field} must be 3-50 characters (letters, numbers, . _ @ -)`);

const rules = {
  login: validate([
    body('username').isString().trim().notEmpty().withMessage('username is required').isLength({ max: 100 }),
    body('password').isString().notEmpty().withMessage('password is required').isLength({ max: 128 }),
  ]),
  refresh: validate([
    body('refreshToken').isString().notEmpty().withMessage('refreshToken is required'),
  ]),
  resetPassword: validate([
    objectId('userId', body),
    password('newPassword'),
  ]),
  changePassword: validate([
    body('currentPassword').isString().notEmpty().withMessage('currentPassword is required'),
    password('newPassword'),
  ]),
  createCustomer: validate([
    body('companyName').isString().trim().notEmpty().withMessage('companyName is required').isLength({ max: 150 }),
    body('mobileNumber').isString().trim().notEmpty().withMessage('mobileNumber is required').isLength({ max: 20 }),
    body('email').isEmail().withMessage('email must be a valid email address').trim(),
    optionalString('address', 500),
    username('adminUsername'),
    password('adminPassword'),
  ]),
  updateCustomer: validate([
    objectId('customerId'),
    optionalString('companyName', 150),
    optionalString('mobileNumber', 20),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('email must be a valid email address'),
    optionalString('address', 500),
    body('adminUsername').optional({ values: 'falsy' }).isString().trim().isLength({ min: 3, max: 50 }),
    body('adminPassword').optional({ values: 'falsy' }).isString().isLength({ min: 6, max: 128 }).withMessage('adminPassword must be 6-128 characters'),
    optionalString('adminName', 100),
    optionalString('adminMobileNumber', 20),
  ]),
  customerId: validate([objectId('customerId')]),
  addVehicle: validate([
    objectId('customerId'),
    body('vehicleNumber').isString().trim().notEmpty().withMessage('vehicleNumber is required').isLength({ max: 20 }),
  ]),
  createVehicleUser: validate([
    objectId('customerId'),
    username(),
    password(),
    optionalString('name', 100),
    optionalString('mobileNumber', 20),
    optionalDate('joiningDate'),
    optionalDate('resigningDate'),
    body('vehicleId').optional({ values: 'falsy' }).isMongoId().withMessage('vehicleId is not a valid id'),
    optionalNumber('basicSalary'),
    optionalNumber('kmCharges'),
    optionalNumber('minKmCharges'),
  ]),
  updateVehicleUser: validate([
    objectId('customerId'),
    objectId('userId'),
    body('username').optional({ values: 'falsy' }).isString().trim().isLength({ min: 3, max: 50 }),
    body('password').optional({ values: 'falsy' }).isString().isLength({ min: 6, max: 128 }).withMessage('password must be 6-128 characters'),
    optionalString('name', 100),
    optionalString('mobileNumber', 20),
    optionalDate('joiningDate'),
    optionalDate('resigningDate'),
    body('vehicleId').optional({ values: 'falsy' }).isMongoId().withMessage('vehicleId is not a valid id'),
    optionalNumber('basicSalary'),
    optionalNumber('kmCharges'),
    optionalNumber('minKmCharges'),
  ]),
  createLeave: validate([
    body('startDate').isISO8601().withMessage('startDate must be a valid date'),
    body('endDate').isISO8601().withMessage('endDate must be a valid date'),
    optionalString('reason', 500),
    body('driverId').optional({ values: 'falsy' }).isMongoId().withMessage('driverId is not a valid id'),
  ]),
  updateLeave: validate([
    objectId('leaveId'),
    optionalDate('startDate'),
    optionalDate('endDate'),
    optionalString('reason', 500),
  ]),
  leaveId: validate([objectId('leaveId')]),
  vehicleId: validate([objectId('vehicleId')]),
  tripId: validate([objectId('tripId')]),
};

module.exports = { validate, rules };
