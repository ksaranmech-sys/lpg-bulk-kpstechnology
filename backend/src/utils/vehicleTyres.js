const { TYRE_EXPENSE_CATEGORIES, VEHICLE_TYRE_POSITIONS } = require('../config/constants');

function withTyreExpenseNumbers(tyres = [], vehicleId, expenses = []) {
  const latestByPosition = new Map();
  expenses
    .filter((expense) => TYRE_EXPENSE_CATEGORIES.includes(String(expense.category || '').trim().toLowerCase()))
    .forEach((expense) => {
      const expenseVehicleId = expense.vehicle?._id || expense.vehicle;
      if (String(expenseVehicleId) !== String(vehicleId)) return;
      const expensePosition = String(expense.tyrePosition || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const position = VEHICLE_TYRE_POSITIONS.findIndex(
        (label) => label.toLowerCase() === expensePosition,
      ) + 1;
      if (position === 0) return;

      const numbers = latestByPosition.get(position) || {};
      if (!numbers.tyreNumber && expense.tyreNumber) numbers.tyreNumber = expense.tyreNumber;
      if (!numbers.tyreNumber2 && expense.tyreNumber2) numbers.tyreNumber2 = expense.tyreNumber2;
      latestByPosition.set(position, numbers);
    });

  return tyres.map((tyre) => {
    const expense = latestByPosition.get(Number(tyre.position)) || {};
    return {
      ...tyre,
      tyreNumber: String(tyre.tyreNumber || '').trim() || expense.tyreNumber || '',
      tyreNumber2: String(tyre.tyreNumber2 || '').trim() || expense.tyreNumber2 || '',
    };
  });
}

module.exports = { withTyreExpenseNumbers };
