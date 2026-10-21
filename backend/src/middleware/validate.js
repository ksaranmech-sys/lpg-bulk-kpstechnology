const { body, param, validationResult } = require('express-validator');
const {
  VEHICLE_CORPORATIONS,
  TYRE_EXPENSE_CATEGORIES,
  VEHICLE_TYRE_POSITIONS,
} = require('../config/constants');

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
const username = (field = 'username', optional = false) => {
  const chain = optional ? body(field).optional({ values: 'falsy' }) : body(field);
  return chain.isString().trim().toLowerCase().matches(/^[a-z0-9-]{3,50}$/).withMessage(`${field} must be 3-50 letters, numbers and hyphens only`);
};
const driverName = (field = 'name', optional = false) => {
  const chain = optional ? body(field).optional({ values: 'falsy' }) : body(field);
  return chain.isString().trim().matches(/^[A-Za-z0-9 ]+$/).withMessage(`${field} must contain only letters, numbers, and spaces`).isLength({ max: 100 }).withMessage(`${field} is too long`);
};
const mobileNumber = (field, optional = false) => {
  const chain = optional ? body(field).optional({ values: 'falsy' }) : body(field);
  return chain.isString().trim().matches(/^\d{10}$/).withMessage(`${field} must contain exactly 10 digits`);
};
const companyName = (field = 'companyName', optional = false) => {
  const chain = optional ? body(field).optional({ values: 'falsy' }) : body(field);
  return chain.isString().trim().notEmpty().withMessage(`${field} is required`)
    .matches(/^[A-Za-z ]+$/).withMessage(`${field} must contain only letters and spaces`)
    .isLength({ max: 150 }).withMessage(`${field} is too long`);
};
const email = (field = 'email', optional = false) => {
  const chain = optional ? body(field).optional({ values: 'falsy' }) : body(field);
  return chain.isString().trim().not().matches(/\s/).withMessage(`${field} must not contain spaces`)
    .isEmail().withMessage(`${field} must be a valid email address`);
};
const vehicleNumber = (field = 'vehicleNumber') => body(field)
  .isString()
  .trim()
  .notEmpty()
  .withMessage(`${field} is required`)
  .matches(/^[A-Za-z]{2}/)
  .withMessage(`${field} must start with 2 letters`)
  .isLength({ max: 20 })
  .withMessage(`${field} is too long`);
const tyreCategory = (req) => TYRE_EXPENSE_CATEGORIES.includes(String(req.body.category || '').trim().toLowerCase());
const requiredTyreText = (field) => body(field)
  .if((value, { req }) => tyreCategory(req))
  .exists({ values: 'falsy' })
  .withMessage(`${field} is required for Tyre expenses`)
  .bail()
  .isString()
  .trim()
  .notEmpty()
  .withMessage(`${field} is required for Tyre expenses`)
  .isLength({ max: 100 })
  .withMessage(`${field} must be 100 characters or fewer`);
const tyrePositionForExpense = () => body('tyrePosition')
  .if((value, { req }) => tyreCategory(req))
  .exists({ values: 'falsy' })
  .withMessage('tyrePosition is required for Tyre expenses')
  .bail()
  .isIn(VEHICLE_TYRE_POSITIONS)
  .withMessage('Select a valid tyre position');
const requiredTyreNumber = (field) => body(field)
  .if((value, { req }) => tyreCategory(req))
  .exists({ values: 'falsy' })
  .withMessage(`${field} is required for tyre expenses`)
  .bail()
  .isString()
  .trim()
  .notEmpty()
  .withMessage(`${field} is required for tyre expenses`)
  .isLength({ max: 50 })
  .withMessage(`${field} must be 50 characters or fewer`);

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
  recoveryContact: validate([
    body('currentPassword').isString().notEmpty().withMessage('currentPassword is required'),
    email('recoveryEmail'),
  ]),
  forgotPassword: validate([
    body('username').isString().trim().notEmpty().withMessage('username is required').isLength({ max: 100 }),
    email('recoveryEmail'),
  ]),
  resetPasswordWithToken: validate([
    body('token').isString().trim().matches(/^[a-f0-9]{64}$/).withMessage('token is not a valid reset link'),
    password('newPassword'),
  ]),
  createCustomer: validate([
    companyName('companyName'),
    mobileNumber('mobileNumber'),
    email('email'),
    optionalString('address', 500),
    username('adminUsername'),
    password('adminPassword'),
  ]),
  updateCustomer: validate([
    objectId('customerId'),
    companyName('companyName', true),
    mobileNumber('mobileNumber', true),
    email('email', true),
    optionalString('address', 500),
    username('adminUsername', true),
    body('adminPassword').optional({ values: 'falsy' }).isString().isLength({ min: 6, max: 128 }).withMessage('adminPassword must be 6-128 characters'),
  ]),
  customerId: validate([objectId('customerId')]),
  addVehicle: validate([
    objectId('customerId'),
    vehicleNumber(),
    body('corporation').isIn(VEHICLE_CORPORATIONS).withMessage(`corporation must be one of ${VEHICLE_CORPORATIONS.join(', ')}`),
  ]),
  createVehicleUser: validate([
    objectId('customerId'),
    username(),
    password(),
    driverName('name', true),
    mobileNumber('mobileNumber', true),
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
    username('username', true),
    body('password').optional({ values: 'falsy' }).isString().isLength({ min: 6, max: 128 }).withMessage('password must be 6-128 characters'),
    driverName('name', true),
    mobileNumber('mobileNumber', true),
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
  createVehicleExpense: validate([
    body('vehicleId').isMongoId().withMessage('vehicleId is not a valid id'),
    body('category').isString().trim().isLength({ min: 1, max: 100 }).withMessage('category is required'),
    body('amount').isInt({ min: 0 }).withMessage('amount must be a whole number (no decimals)'),
    body('date').isISO8601().withMessage('date must be a valid date'),
    requiredTyreText('tyreMaker'),
    requiredTyreText('tyreModel'),
    tyrePositionForExpense(),
    requiredTyreNumber('tyreNumber'),
    requiredTyreNumber('tyreNumber2'),
    optionalString('note', 500),
  ]),
  updateVehicleExpense: validate([
    objectId('expenseId'),
    body('vehicleId').optional({ values: 'falsy' }).isMongoId().withMessage('vehicleId is not a valid id'),
    body('category').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('category is required'),
    body('amount').optional({ values: 'null' }).isInt({ min: 0 }).withMessage('amount must be a whole number (no decimals)'),
    optionalDate('date'),
    requiredTyreText('tyreMaker'),
    requiredTyreText('tyreModel'),
    tyrePositionForExpense(),
    requiredTyreNumber('tyreNumber'),
    requiredTyreNumber('tyreNumber2'),
    optionalString('note', 500),
  ]),
  expenseId: validate([objectId('expenseId')]),
  vehicleId: validate([objectId('vehicleId')]),
  createTrip: validate([
    body('startOdometerKm').exists().withMessage('startOdometerKm is required')
      .bail().isFloat({ min: 0 }).withMessage('startOdometerKm must be a non-negative number'),
  ]),
  updateVehicleTyres: validate([
    body('tyres').isArray({ min: 7, max: 7 }).withMessage('Exactly 7 tyre positions are required')
      .bail()
      .custom((tyres) => {
        const positions = new Set();
        for (const tyre of tyres) {
          const position = Number(tyre?.position);
          const tyreNumber = tyre?.tyreNumber == null ? '' : tyre.tyreNumber;
          const tyreNumber2 = tyre?.tyreNumber2 == null ? '' : tyre.tyreNumber2;
          const odometer = tyre?.installedOdometerKm;
          const expectedMileage = tyre?.expectedMileageKm;
          if (!Number.isInteger(position) || position < 1 || position > 7 || positions.has(position)) return false;
          if (typeof tyreNumber !== 'string' || tyreNumber.trim().length > 50) return false;
          if (typeof tyreNumber2 !== 'string' || tyreNumber2.trim().length > 50) return false;
          if (odometer !== null && odometer !== undefined && odometer !== ''
            && (!Number.isFinite(Number(odometer)) || Number(odometer) < 0)) return false;
          if (expectedMileage !== null && expectedMileage !== undefined && expectedMileage !== ''
            && (!Number.isFinite(Number(expectedMileage)) || Number(expectedMileage) < 0)) return false;
          positions.add(position);
        }
        return positions.size === 7;
      })
      .withMessage('Each tyre position must include a valid tyre number and odometer value'),
  ]),
  tripId: validate([objectId('tripId')]),
  mobileAppUrl: validate([
    body('mobileAppUrl').optional({ values: 'falsy' }).isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('mobileAppUrl must be a full http(s) link').isLength({ max: 500 }),
  ]),
};

module.exports = { validate, rules };
