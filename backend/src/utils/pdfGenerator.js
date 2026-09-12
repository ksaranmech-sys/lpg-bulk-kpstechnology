const PDFDocument = require('pdfkit');
const { calculateClosingOdometerKm } = require('./tripCalculations');

/**
 * Builds a printable trip settlement report as a PDF Buffer.
 * `trip` must be populated with .vehicle and .customer, and must already
 * have `trip.settlement` calculated (see tripCalculations.js).
 */
function buildTripSettlementPdf(trip, previousTrip = trip.previousTrip) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 72, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const s = trip.settlement || {};
    const advances = trip.driverAdvances || [];
    const dieselEntries = trip.dieselEntries || [];
    const rtoEntries = trip.rtoEntries || [];
    const otherExpenses = trip.otherExpenses || [];
    const odometerKm = trip.status === 'closed' && trip.settlement?.totalKm != null
      ? trip.settlement.totalKm
      : calculateClosingOdometerKm(trip, previousTrip);

    const totalAdvance = advances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const dieselCardTotal = dieselEntries
      .filter((entry) => entry.paymentMethod !== 'cash')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const dieselCashTotal = dieselEntries
      .filter((entry) => entry.paymentMethod === 'cash')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const totalDiesel = dieselEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const loadingExpenseTotal = Number(trip.loadingExpense || 0);
    const unloadingExpenseTotal = Number(trip.unloadingExpense || 0);
    const rtoExpenseTotal = rtoEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const otherExpenseTotal = otherExpenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const totalExpenses = loadingExpenseTotal + rtoExpenseTotal + unloadingExpenseTotal + otherExpenseTotal;
    const balance = totalAdvance - (dieselCashTotal + totalExpenses);

    doc.fontSize(16).text('KPS Technology - Trip Settlement Report', { align: 'center' });
    doc.moveDown(0.45);

    doc.fontSize(9.5);
    doc.text(`Customer: ${trip.customer?.companyName || ''}`);
    doc.text(`Vehicle Number: ${trip.vehicle?.vehicleNumber || ''}`);
    doc.text(`Trip ID: ${trip._id}`);
    doc.text(`Loading Location: ${trip.loadingLocation || '-'} (${fmtDate(trip.loadingDate)})`);
    doc.text(`Unloading Location: ${trip.unloadingLocation || '-'} (${fmtDate(trip.unloadingDate)})`);
    doc.text(`Trip Status: ${trip.status}`);
    doc.moveDown(0.45);

    sectionHeader(doc, 'Odometer KM');
    renderKeyValueRows(doc, [
      ['Odometer KM', formatKm(odometerKm)],
      ['Manual KM', formatKm(trip.manualKm)],
    ]);

    sectionHeader(doc, 'Driver Advance Details');
    renderTable(doc, ['Date', 'Advance'],
      advances.length ? advances.map((a) => [fmtDate(a.date), `Rs ${fmtMoney(a.amount)}`]) : [['-', 'No advances added']],
      { totalLabel: 'Total', totalValue: `Rs ${fmtMoney(totalAdvance)}` });
    doc.moveDown(0.25);

    sectionHeader(doc, 'Diesel Filled Details');
    renderTable(doc, ['Date', 'Purchase Type', 'Amount'],
      dieselEntries.length ? dieselEntries.map((d) => [
        fmtDate(d.filledAt),
        d.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card',
        `Rs ${fmtMoney(d.amount)}`,
      ]) : [['-', 'No diesel entries', '-']],
      { totalLabel: 'Diesel Card', totalValue: `Rs ${fmtMoney(dieselCardTotal)}`, extraRows: [
        ['Cash', '', `Rs ${fmtMoney(dieselCashTotal)}`],
        ['Total', '', `Rs ${fmtMoney(totalDiesel)}`],
      ] });
    doc.moveDown(0.25);

    sectionHeader(doc, 'Expenses');
    renderTable(doc, ['Item', 'Amount'], [
      ['Loading Expenses', `Rs ${fmtMoney(loadingExpenseTotal)}`],
      ['RTO Expenses', `Rs ${fmtMoney(rtoExpenseTotal)}`],
      ['Unloading Expenses', `Rs ${fmtMoney(unloadingExpenseTotal)}`],
      ['Other Expenses', `Rs ${fmtMoney(otherExpenseTotal)}`],
    ], { totalLabel: 'Total', totalValue: `Rs ${fmtMoney(totalExpenses)}` });
    doc.moveDown(0.25);

    sectionHeader(doc, 'Balance');
    doc.fontSize(11).font('Helvetica-Bold').text(`Balance`, { continued: true });
    doc.font('Helvetica').text(`  (Driver Advance - (Cash Diesel + Expenses Total))`, { continued: false });
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(14).text(`Rs ${fmtMoney(balance)}`);
    doc.moveDown(0.55);

    doc.fontSize(9).fillColor('gray').text(
      `Generated on ${new Date().toLocaleString('en-IN')} by KPS Fleet Management System`,
      { align: 'center' }
    );

    doc.end();
  });
}

function buildDriverMonthlySummaryPdf({ driver, vehicle, summary, trips }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).font('Helvetica-Bold').text('KPS Technology - Monthly Salary Calculation', { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    const metadataWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 3;
    const metadataY = doc.y;
    doc.text(`Driver: ${driver.name || driver.username || '-'}`, doc.page.margins.left, metadataY, {
      width: metadataWidth,
      align: 'left',
    });
    doc.text(`Vehicle: ${vehicle?.vehicleNumber || '-'}`, doc.page.margins.left + metadataWidth, metadataY, {
      width: metadataWidth,
      align: 'center',
    });
    doc.text(`Month: ${formatMonth(summary.month)}`, doc.page.margins.left + metadataWidth * 2, metadataY, {
      width: metadataWidth,
      align: 'right',
    });
    doc.y = metadataY + 16;
    doc.text(`Closed trips: ${trips.length}`, { align: 'center' });
    doc.moveDown(0.6);

    sectionHeader(doc, 'Closed Trips');
    renderTable(doc, ['S.No', 'Loading Location', 'Loading Date', 'Unloading Location', 'Unloading Date'],
      trips.length ? trips.map((trip, index) => [
        String(index + 1),
        trip.loadingLocation || '-',
        fmtDate(trip.loadingDate),
        trip.unloadingLocation || '-',
        fmtDate(trip.unloadingDate),
      ]) : [['-', 'No closed trips for this month', '-', '-', '-']]);
    doc.moveDown(0.35);

    sectionHeader(doc, 'Salary Calculation');
    renderKeyValueRows(doc, [
      ['Basic Salary Payable', `Rs ${fmtMoney(summary.basicSalary)}`],
      ['Corporation KM', `${fmtMoney(summary.corporationKm)} km`],
      [`KM Beta (Rs ${fmtMoney(summary.kmCharges)} x ${fmtMoney(summary.corporationKm)})`, `Rs ${fmtMoney(summary.kmBeta)}`],
      [`Special Trip Charges (${summary.specialTripCount || 0} trips x Rs 1000)`, `Rs ${fmtMoney(summary.specialTripCharges || 0)}`],
      ['Sum of all balances for the month', `Rs ${fmtMoney(summary.totalBalance)}`],
      ['Salary Balance', `Rs ${fmtMoney(summary.salaryBalance)}`],
    ]);
    doc.moveDown(0.8);
    doc.fontSize(9).fillColor('gray').text(
      `Generated on ${new Date().toLocaleString('en-IN')} by KPS Fleet Management System`,
      { align: 'center' }
    );
    doc.end();
  });
}

function sectionHeader(doc, text) {
  doc.moveDown(0.12);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('black').text(text);
  doc.moveDown(0.08);
  doc.fontSize(8.5).font('Helvetica');
}

function renderTable(doc, headers, rows, summary) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / headers.length;
  const startX = doc.x;

  doc.font('Helvetica-Bold');
  headers.forEach((header, index) => {
    doc.text(String(header), startX + index * colWidth, doc.y, { width: colWidth, align: index === headers.length - 1 ? 'right' : 'left' });
  });
  doc.font('Helvetica');
  doc.moveDown(0.12);

  rows.forEach((row) => {
    row.forEach((cell, index) => {
      doc.text(String(cell), startX + index * colWidth, doc.y, { width: colWidth, align: index === headers.length - 1 ? 'right' : 'left' });
    });
    doc.moveDown(0.08);
  });

  if (summary) {
    doc.moveDown(0.08);
    doc.font('Helvetica-Bold');
    doc.text(String(summary.totalLabel), startX, doc.y, { width: colWidth, align: 'left' });
    doc.text(String(summary.totalValue), startX + (headers.length - 1) * colWidth, doc.y, { width: colWidth, align: 'right' });
    doc.moveDown(0.08);

    if (summary.extraRows && summary.extraRows.length) {
      summary.extraRows.forEach((row) => {
        const [label, middle, value] = row;
        doc.text(String(label), startX, doc.y, { width: colWidth, align: 'left' });
        if (middle !== '') {
          doc.text(String(middle), startX + colWidth, doc.y, { width: colWidth, align: 'center' });
        }
        doc.text(String(value), startX + (headers.length - 1) * colWidth, doc.y, { width: colWidth, align: 'right' });
        doc.moveDown(0.08);
      });
    }
  }
}

function renderKeyValueRows(doc, rows) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.x;
  const columnWidth = pageWidth / 2;

  doc.font('Helvetica');
  rows.forEach(([label, value]) => {
    doc.text(label, startX, doc.y, { width: columnWidth, align: 'left' });
    doc.text(value, startX + columnWidth, doc.y, { width: columnWidth, align: 'right' });
    doc.moveDown(0.08);
  });
}

function formatKm(value) {
  return Number.isFinite(value) ? `${fmtMoney(value)} km` : 'NA';
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN');
}

function formatMonth(month) {
  const [year, monthNumber] = String(month).split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

module.exports = { buildTripSettlementPdf, buildDriverMonthlySummaryPdf };
