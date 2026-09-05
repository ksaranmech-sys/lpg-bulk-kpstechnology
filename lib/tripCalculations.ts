// @ts-nocheck
/**
 * Core trip settlement math, per the spec:
 *
 *  - Diesel: the 1st fill of the trip is a carry-over from the previous trip and is
 *    NOT counted. Every fill AFTER that, including the closing fill made at the next
 *    loading point, IS summed.
 *  - KM: odometer reading at the closing (last) fill minus odometer reading at the
 *    1st fill.
 *  - Mileage: KM / diesel litres (using the sum above, not total volume ever filled).
 *  - Expenses: loading expense + unloading expense + all RTO entries + all other
 *    expenses. Diesel is deliberately excluded from this sum.
 *  - Balance: driver advance - total expenses (diesel excluded, per spec).
 */
export function calculateTripSettlement(trip) {
  const fills = [...trip.dieselFills].sort((a, b) => new Date(a.date) - new Date(b.date));

  if (fills.length < 2) {
    throw new Error(
      "A trip needs at least 2 diesel fills to close: the opening (carry-over) fill and the closing fill at the next loading point."
    );
  }

  const firstFill = fills[0];
  const billableFills = fills.slice(1); // everything except the first (carry-over) fill

  const totalDieselLitres = billableFills.reduce((sum, f) => sum + f.volume, 0);
  const totalDieselValue = billableFills.reduce((sum, f) => sum + f.value, 0);

  const closingFill = fills[fills.length - 1];
  let totalKm = null;
  let mileage = null;
  if (firstFill.odometerKm != null && closingFill.odometerKm != null) {
    totalKm = closingFill.odometerKm - firstFill.odometerKm;
    mileage = totalDieselLitres > 0 ? +(totalKm / totalDieselLitres).toFixed(2) : null;
  }

  const rtoTotal = trip.rtoEntries.reduce((sum, r) => sum + r.amount, 0);
  const otherTotal = trip.otherExpenses.reduce((sum, o) => sum + o.amount, 0);
  const totalOtherExpenses =
    (trip.loadingExpense || 0) + (trip.unloadingExpense || 0) + rtoTotal + otherTotal;

  const balance = (trip.driverAdvance?.amount || 0) - totalOtherExpenses;

  return {
    totalDieselLitres: +totalDieselLitres.toFixed(2),
    totalDieselValue: +totalDieselValue.toFixed(2),
    totalKm,
    mileage,
    totalOtherExpenses: +totalOtherExpenses.toFixed(2),
    balance: +balance.toFixed(2),
  };
}
