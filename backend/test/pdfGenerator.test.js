const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFParse } = require('pdf-parse');
const {
  buildDriverMonthlySummaryPdf,
  buildTripSettlementPdf,
} = require('../src/utils/pdfGenerator');

test('keeps the single-trip summary, expenses, and balance on one A4 page', async () => {
  const trip = {
    _id: 'single-trip-1',
    status: 'closed',
    customer: { companyName: 'KPS Transports' },
    vehicle: { vehicleNumber: 'TN28BL6304' },
    loadingLocation: 'IPPL, Chennai',
    unloadingLocation: 'Erode',
    loadingDate: '2026-10-12T00:00:00.000Z',
    unloadingDate: '2026-10-25T00:00:00.000Z',
    settlement: { totalKm: 952, totalDieselLitres: 339.89, mileageKmPerLitre: 2.8 },
    corporationKm: 952,
    corpKm: 900,
    dieselEntries: Array.from({ length: 6 }, (_, index) => ({
      filledAt: `2026-10-${String(12 + index).padStart(2, '0')}T00:00:00.000Z`,
      paymentMethod: index === 0 ? 'cash' : 'diesel_card',
      odometerKm: 10000 + index * 200,
      volumeLitres: 85,
      amount: 10000 + index * 500,
    })),
    driverAdvances: Array.from({ length: 6 }, (_, index) => ({
      date: `2026-10-${String(12 + index).padStart(2, '0')}T00:00:00.000Z`,
      amount: 1000,
    })),
    rtoEntries: [
      { date: '2026-10-17T00:00:00.000Z', amount: 250 },
      { date: '2026-10-18T00:00:00.000Z', amount: 300 },
    ],
    otherExpenses: Array.from({ length: 8 }, (_, index) => ({
      date: `2026-10-${String(19 + index).padStart(2, '0')}T00:00:00.000Z`,
      amount: 200,
      description: `Other expense ${index + 1}`,
    })),
    loadingExpense: 700,
    turnExpense: 500,
    parkingExpense: 100,
    unloadingExpense: 300,
  };
  const pdf = await buildTripSettlementPdf(trip);
  const parser = new PDFParse({ data: pdf });
  try {
    const result = await parser.getText();
    assert.equal(result.pages.length, 1);
    assert.match(result.pages[0].text, /Trip Details/);
    assert.match(result.pages[0].text, /Diesel Filled Details/);
    assert.match(result.pages[0].text, /Expenses/);
    assert.match(result.pages[0].text, /Trip Balance/);
    assert.match(result.pages[0].text, /Generated on/);
  } finally {
    await parser.destroy();
  }
});

test('renders monthly salary trip details and amounts in separate readable summary pages', async () => {
  const trip = {
    _id: 'trip-1',
    loadingLocation: 'IPPL, Chennai',
    unloadingLocation: 'Erode',
    unloadingDate: '2026-10-25T00:00:00.000Z',
    loadingDate: '2026-10-20T00:00:00.000Z',
    corporationKm: 952,
    dieselLitres: 339.89,
    dieselTotal: 42470.98,
    advanceTotal: 4000,
    expenseTotal: 1200,
    balance: 2800,
    driverAdvances: [],
    dieselEntries: [],
    rtoEntries: [],
    otherExpenses: [],
    settlement: { totalKm: 952, totalDieselLitres: 339.89 },
    status: 'closed',
  };
  const buffer = buildDriverMonthlySummaryPdf({
    driver: { name: 'MANIKANDAN' },
    vehicle: { vehicleNumber: 'TN28BL6304' },
    customer: { companyName: 'KPS Transports' },
    summary: {
      month: '2026-10',
      trips: [trip],
      basicSalary: 15000,
      corporationKm: 952,
      kmCharges: 2,
      kmBeta: 1904,
      totalExpense: 0,
      totalAdvance: 4000,
      salaryBalance: 12904,
      payableDays: 31,
      unpaidLeaveDays: 0,
      specialTripCharges: 0,
    },
  });
  const pdf = await buffer;
  const parser = new PDFParse({ data: pdf });
  try {
    const result = await parser.getText();
    assert.equal(result.pages.length, 3);
    assert.match(result.pages[0].text, /Closed Trips/);
    assert.match(result.pages[0].text, /DRIVER KM/);
    assert.match(result.pages[0].text, /DIESEL \(L\)/);
    assert.match(result.pages[1].text, /Closed Trip Amounts/);
    assert.match(result.pages[1].text, /TRIP ADVANCE/);
    assert.match(result.pages[1].text, /TRIP EXPENSE/);
    assert.match(result.pages[1].text, /42,470\.98/);
    assert.match(result.pages[1].text, /Salary Calculation/);
  } finally {
    await parser.destroy();
  }
});
