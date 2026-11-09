const PDFDocument = require('pdfkit');
const fs = require('fs/promises');
const path = require('path');
const config = require('../config/env');
const { calculateTripKm } = require('./tripCalculations');

/**
 * Builds a printable trip settlement report as a PDF Buffer.
 * `trip` must be populated with .vehicle and .customer, and must already
 * have `trip.settlement` calculated (see tripCalculations.js).
 */
async function buildTripSettlementPdf(trip, nextTrip = null) {
  // Photos are fetched up front - pdfkit's drawing API is synchronous.
  const photos = await loadTripPhotos(trip);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 24, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderTripSettlementSheet(doc, trip, photos, nextTrip);
    doc.end();
  });
}

function renderTripSettlementSheet(doc, trip, photos, nextTrip = null, title = 'Single Trip') {
  const reportStartY = doc.page.margins.top - 10;
  const advances = trip.driverAdvances || [];
  const dieselEntries = trip.dieselEntries || [];
  const rtoEntries = trip.rtoEntries || [];
  const otherExpenses = trip.otherExpenses || [];
  const odometerKm = trip.status === 'closed' && trip.settlement?.totalKm != null
    ? trip.settlement.totalKm
    : calculateTripKm(trip, nextTrip);

  const totalAdvance = advances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const dieselCardTotal = dieselEntries
    .filter((entry) => entry.paymentMethod !== 'cash')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const dieselCashTotal = dieselEntries
    .filter((entry) => entry.paymentMethod === 'cash')
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalDiesel = dieselEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const loadingExpenseTotal = Number(trip.loadingExpense || 0);
  const turnExpenseTotal = Number(trip.turnExpense || 0);
  const parkingExpenseTotal = Number(trip.parkingExpense || 0);
  const unloadingExpenseTotal = Number(trip.unloadingExpense || 0);
  const rtoExpenseTotal = rtoEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const otherExpenseTotal = otherExpenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalExpenses = dieselCashTotal + loadingExpenseTotal + turnExpenseTotal + parkingExpenseTotal + unloadingExpenseTotal + rtoExpenseTotal + otherExpenseTotal;
  const balance = totalAdvance - totalExpenses;

  doc.fontSize(15).font('Helvetica-Bold').fillColor('#102f52').text(title, { align: 'left' });
  doc.moveDown(0.12);

  compactStyledSectionHeader(doc, 'Trip Details');
  renderSalaryRows(doc, [
    ['Customer', trip.customer?.companyName || '-'],
    ['Vehicle Number', trip.vehicle?.vehicleNumber || '-'],
    ['Trip ID', String(trip._id || '-')],
    ['Loading Location', `${trip.loadingLocation || '-'} (${fmtDate(trip.loadingDate)})`],
    ['Unloading Location', `${trip.unloadingLocation || '-'} (${fmtDate(trip.unloadingDate)})`],
    ...(trip.isDiverted ? [['Divert Location', `${trip.divertUnloadingLocation ? `${trip.divertUnloadingLocation} (Divert)` : '-'} (${fmtDate(trip.divertDate)})`]] : []),
    ['Trip Status', trip.status || '-'],
  ], { compact: true });

  compactStyledSectionHeader(doc, 'Odometer & Mileage');
  renderSalaryRows(doc, [
    ['Odometer KM', formatKm(odometerKm)],
    ...manualKmRows(trip).map(([label, value, legText]) => [`${label} (${legText})`, value]),
  ], { compact: true });

  compactStyledSectionHeader(doc, 'Driver Advance Details');
  renderTable(doc, ['Date', 'Advance'],
    advances.length ? advances.map((a) => [fmtDate(a.date), `Rs ${fmtMoney(a.amount)}`]) : [['-', 'No advances added']],
    { totalLabel: 'Total', totalValue: `Rs ${fmtMoney(totalAdvance)}` }, { styled: true, compact: true });

  compactStyledSectionHeader(doc, 'Diesel Filled Details');
  renderTable(doc, ['Date', 'Purchase Type', 'Odometer KM', 'Litres', 'Tank Fill', 'Amount'],
    dieselEntries.length ? dieselEntries.map((d) => [
      fmtDate(d.filledAt),
      d.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card',
      d.odometerKm != null ? `${fmtMoney(d.odometerKm)} km` : '-',
      d.volumeLitres != null ? `${fmtMoney(d.volumeLitres)} L` : '-',
      d.loadingPointTankFill ? '✓' : '-',
      `Rs ${fmtMoney(d.amount)}`,
    ]) : [['-', 'No diesel entries', '-', '-', '-', '-']],
    { totalLabel: 'Diesel Card', totalValue: `Rs ${fmtMoney(dieselCardTotal)}`, extraRows: [
      ['Cash', '', `Rs ${fmtMoney(dieselCashTotal)}`],
      ['Total', '', `Rs ${fmtMoney(totalDiesel)}`],
    ] }, { styled: true, compact: true });

  compactStyledSectionHeader(doc, 'Expenses');
  renderTable(doc, ['Item', 'Date', 'Amount'], [
    ['Cash Diesel', '-', `Rs ${fmtMoney(dieselCashTotal)}`],
    ['Cleaner Loading', fmtDate(trip.loadingDate), `Rs ${fmtMoney(loadingExpenseTotal)}`],
    ['Turn', fmtDate(trip.loadingDate), `Rs ${fmtMoney(turnExpenseTotal)}`],
    ['Parking', fmtDate(trip.loadingDate), `Rs ${fmtMoney(parkingExpenseTotal)}`],
    ...(unloadingExpenseTotal > 0 ? [['Unloading', fmtDate(trip.unloadingDate), `Rs ${fmtMoney(unloadingExpenseTotal)}`]] : []),
    ...rtoEntries.map((entry) => ['RTO', fmtDate(entry.date), `Rs ${fmtMoney(entry.amount)}`]),
    ...otherExpenses.map((entry) => [entry.description || 'Other', fmtDate(entry.date), `Rs ${fmtMoney(entry.amount)}`]),
  ], { totalLabel: 'Total Expenses', totalValue: `Rs ${fmtMoney(totalExpenses)}` }, { styled: true, compact: true });

  compactStyledSectionHeader(doc, 'Balance');
  renderSalaryRows(doc, [
    ['Trip Advance', `Rs ${fmtMoney(totalAdvance)}`],
    ['Total Expenses', `Rs ${fmtMoney(totalExpenses)}`],
    ['Trip Balance (Advance - Expenses)', `Rs ${fmtMoney(balance)}`],
  ], { compact: true, highlightLast: true });

  doc.fontSize(7).fillColor('gray').text(
    `Generated on ${new Date().toLocaleString('en-IN')} by KPS Fleet Management System`,
    doc.page.margins.left,
    doc.y + 2,
    {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      align: 'center',
      lineBreak: false,
    }
  );
  doc.y += 12;

  doc.roundedRect(
    doc.page.margins.left - 8,
    reportStartY,
    doc.page.width - doc.page.margins.left - doc.page.margins.right + 16,
    doc.y - reportStartY + 8,
    8
  ).lineWidth(1).strokeColor('#1f4d2b').stroke();

  renderTripPhotos(doc, photos);
}

// Every photo attached to a trip, in report order, with a short caption.
function collectTripPhotos(trip) {
  const photos = [];
  if (trip.parkingPhoto?.url) photos.push({ url: trip.parkingPhoto.url, caption: `Parking (${fmtDate(trip.loadingDate)})` });
  (trip.dieselEntries || []).forEach((entry) => {
    if (entry.photo?.url) photos.push({ url: entry.photo.url, caption: `Diesel ${fmtDate(entry.filledAt)} - Rs ${fmtMoney(entry.amount)}` });
  });
  (trip.rtoEntries || []).forEach((entry) => {
    if (entry.photo?.url) photos.push({ url: entry.photo.url, caption: `RTO ${fmtDate(entry.date)} - Rs ${fmtMoney(entry.amount)}` });
  });
  (trip.otherExpenses || []).forEach((entry) => {
    if (entry.photo?.url) photos.push({ url: entry.photo.url, caption: `${entry.description || 'Other'} ${fmtDate(entry.date)} - Rs ${fmtMoney(entry.amount)}` });
  });
  return photos;
}

// pdfkit can only embed JPEG and PNG.
function isPdfKitImage(buffer) {
  if (!buffer || buffer.length < 8) return false;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  return isJpeg || isPng;
}

async function loadPhotoBuffer(url) {
  const localPrefix = `${config.apiBaseUrl}/uploads/`;
  if (url.startsWith(localPrefix)) {
    const filename = path.basename(url.slice(localPrefix.length));
    return fs.readFile(path.join(path.resolve(__dirname, '..', '..', config.storage.uploadDir), filename));
  }
  if (!/^https?:\/\//i.test(url) || typeof fetch !== 'function') return null;
  // Cloudinary: ask for a small JPEG so the PDF stays light and pdfkit can decode it.
  const fetchUrl = url.includes('/image/upload/')
    ? url.replace('/image/upload/', '/image/upload/f_jpg,w_800,q_auto:eco/')
    : url;
  const response = await fetch(fetchUrl, { signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function loadTripPhotos(trip) {
  const photos = collectTripPhotos(trip);
  const loaded = await Promise.all(photos.map(async (photo) => {
    try {
      const buffer = await loadPhotoBuffer(photo.url);
      return isPdfKitImage(buffer) ? { ...photo, buffer } : null;
    } catch (err) {
      return null;
    }
  }));
  return loaded.filter(Boolean);
}

// Two-column photo grid appended after the report frame; spills onto new pages as needed.
function renderTripPhotos(doc, photos) {
  if (!photos.length) return;
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = doc.page.height - doc.page.margins.bottom;
  const columns = 2;
  const gap = 10;
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const imageHeight = 170;
  const cellHeight = imageHeight + 24;

  if (doc.y + 34 + cellHeight > bottom) doc.addPage();
  else doc.y += 10;
  doc.x = x;
  styledSectionHeader(doc, 'Trip Photos');

  let rowY = doc.y;
  photos.forEach((photo, index) => {
    const column = index % columns;
    if (column === 0 && index > 0) rowY += cellHeight + gap;
    if (column === 0 && rowY + cellHeight > bottom) {
      doc.addPage();
      rowY = doc.page.margins.top;
    }
    const cellX = x + column * (cellWidth + gap);
    doc.rect(cellX, rowY, cellWidth, cellHeight).lineWidth(0.5).strokeColor('#b8c9d1').stroke();
    try {
      doc.image(photo.buffer, cellX + 4, rowY + 4, { fit: [cellWidth - 8, imageHeight], align: 'center', valign: 'center' });
    } catch (err) {
      doc.fillColor('gray').font('Helvetica').fontSize(9).text('Photo unavailable', cellX + 4, rowY + imageHeight / 2, { width: cellWidth - 8, align: 'center', lineBreak: false });
    }
    doc.fillColor('#102f52').font('Helvetica').fontSize(9).text(photo.caption, cellX + 4, rowY + imageHeight + 9, { width: cellWidth - 8, align: 'center', lineBreak: false });
  });
  doc.x = x;
  doc.y = rowY + cellHeight + 6;
}

// One PDF per person: `which` is 'regular' (the driver's own sheet + their split of each trip)
// or 'temporary' (the substitute's sheet + their split). Each PDF only carries that person's
// rows, so the two settlements can be handed out independently.
async function buildDriverMonthlySummaryPdf({ driver, vehicle, customer, summary, which = 'regular' }) {
  const temporaryDriver = summary.temporaryDriver;
  const isTemporary = which === 'temporary' && temporaryDriver;
  const sheetSummary = isTemporary ? temporaryDriver : summary;
  const trips = sheetSummary.trips || [];
  const tripReports = [];
  for (const trip of trips) {
    tripReports.push({
      trip: { ...trip, customer, vehicle },
      photos: await loadTripPhotos(trip),
    });
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 24, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (isTemporary) {
      const period = `${fmtDate(temporaryDriver.joiningDate)} - ${temporaryDriver.returningDate ? fmtDate(temporaryDriver.returningDate) : 'Ongoing'}`;
      renderSalarySheet(doc, {
        title: 'Temporary Driver Salary Calculation',
        driverLabel: `Temporary Driver: ${temporaryDriver.name || '-'}`,
        vehicle,
        customer,
        month: summary.month,
        summary: temporaryDriver,
        trips,
        subtitle: `Covering for ${driver?.name || driver?.username || '-'} (${period})`,
        basicSalaryLabel: `Basic Salary Payable (Days covered: ${temporaryDriver.days || 0})`,
      });
    } else {
      renderSalarySheet(doc, {
        title: 'Monthly Salary Calculation',
        driverLabel: `Driver: ${driver?.name || driver?.username || '-'}`,
        vehicle,
        customer,
        month: summary.month,
        summary,
        trips,
        basicSalaryLabel: `Basic Salary Payable (Payable days: ${summary.payableDays || 0}, Leaves taken: ${summary.unpaidLeaveDays || 0})`,
      });
    }

    tripReports.forEach(({ trip, photos }, index) => {
      doc.addPage({ size: 'A4', layout: 'portrait', margin: 24 });
      renderTripSettlementSheet(doc, trip, photos, null, `Single Trip ${index + 1} of ${tripReports.length}`);
    });

    doc.end();
  });
}

function renderSalarySheet(doc, { title, driverLabel, vehicle, customer, month, summary, trips, subtitle, basicSalaryLabel }) {
  const reportStartY = doc.page.margins.top - 10;
  renderSalarySheetHeader(doc, { title, driverLabel, vehicle, customer, month, trips, subtitle });
  compactStyledSectionHeader(doc, 'Closed Trips & Amounts');
  const specialTripCharges = Number(summary.specialTripCharges || 0);
  // Sub Total = Basic + KM Beta + Special Trip Charges + Total Expenses (earnings and
  // reimbursable expenses owed to the driver). Settlement to Driver = Sub Total - Total
  // Advance (money already paid out) - this matches summary.salaryBalance exactly.
  const subTotal = Number(summary.basicSalary || 0) + Number(summary.kmBeta || 0) + specialTripCharges + Number(summary.totalExpense || 0);
  const salaryRows = [
    [basicSalaryLabel, `Rs ${fmtMoney(summary.basicSalary)}`],
    [`KM Beta (Total Driver KM ${fmtMoney(summary.corporationKm)} x Rs ${fmtMoney(summary.kmCharges)})`, `Rs ${fmtMoney(summary.kmBeta)}`],
    ['Total Expenses', `Rs ${fmtMoney(summary.totalExpense)}`],
    ['Sub Total', `Rs ${fmtMoney(subTotal)}`],
    ['Total Advance', `Rs ${fmtMoney(summary.totalAdvance)}`],
    ['Settlement to Driver', `Rs ${fmtMoney(summary.salaryBalance)}`],
  ];
  if (specialTripCharges > 0) {
    const splitByDate = specialTripCharges !== Number(summary.specialTripCount || 0) * Number(summary.specialTripRate || 0);
    salaryRows.splice(2, 0, [
      `Special Trip Charges (${summary.specialTripCount || 0} x Rs ${fmtMoney(summary.specialTripRate)}${splitByDate ? ', shared' : ''})`,
      `Rs ${fmtMoney(summary.specialTripCharges)}`,
    ]);
  }
  const tableRows = trips.length ? trips.map((trip, index) => [
    String(index + 1),
    `${trip.loadingLocation || '-'} to ${trip.unloadingLocation || '-'}`,
    fmtDate(trip.unloadingDate),
    trip.isDiverted ? trip.divertUnloadingLocation || '-' : '-',
    trip.isDiverted ? fmtDate(trip.divertDate) : '-',
    trip.corporationKm != null ? `${fmtMoney(trip.corporationKm)} km` : '-',
    `${fmtMoney(trip.dieselLitres || 0)} L`,
    `Rs ${fmtMoney(trip.dieselTotal || 0)}`,
    `Rs ${fmtMoney(trip.advanceTotal || 0)}`,
    `Rs ${fmtMoney(trip.expenseTotal || 0)}`,
    `Rs ${fmtMoney(trip.balance || 0)}`,
  ]) : [['-', 'No closed trips for this month', '-', '-', '-', '-', '-', '-', '-', '-', '-']];
  const salaryTableHeight = 19 + salaryRows.length * 13 + 4;
  const footerHeight = 16;
  const remainingHeight = doc.page.height - doc.page.margins.bottom - doc.y - salaryTableHeight - footerHeight - 8;
  const headerHeight = 28;
  const rowHeight = Math.min(22, (remainingHeight - headerHeight) / (tableRows.length + 1));
  renderSalaryTripsTable(
    doc,
    ['Trip', 'Route', 'Date', 'Divert To', 'Divert Date', 'Driver KM', 'Diesel L', 'Diesel Amt', 'Advance', 'Expense', 'Balance'],
    tableRows,
    {},
    { rowHeight, headerHeight, fontSize: Math.min(8, Math.max(5.5, rowHeight * 0.36)) }
  );
  compactStyledSectionHeader(doc, 'Salary Calculation');
  renderSalaryRows(doc, salaryRows, { compact: true });
  renderSalarySheetFooter(doc, reportStartY);
}

function renderSalarySheetHeader(doc, { title, driverLabel, vehicle, customer, month, trips, subtitle }) {
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
  doc.fillColor('#102f52').fontSize(17).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10);
  const metadataWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 4;
  const metadataY = doc.y;
  doc.text(`Customer: ${customer?.companyName || '-'}`, doc.page.margins.left, metadataY, {
    width: metadataWidth,
    align: 'left',
  });
  doc.text(driverLabel, doc.page.margins.left + metadataWidth, metadataY, {
    width: metadataWidth,
    align: 'center',
  });
  doc.text(`Vehicle: ${vehicle?.vehicleNumber || '-'}`, doc.page.margins.left + metadataWidth * 2, metadataY, {
    width: metadataWidth,
    align: 'center',
  });
  doc.text(`Month: ${formatMonth(month)}`, doc.page.margins.left + metadataWidth * 3, metadataY, {
    width: metadataWidth,
    align: 'right',
  });
  doc.y = metadataY + 14;
  doc.x = doc.page.margins.left;
  if (subtitle) {
    doc.text(subtitle, { align: 'center' });
    doc.x = doc.page.margins.left;
  }
  doc.text(`Closed trips: ${trips.length}`, { align: 'center' });
  doc.moveDown(0.2);
  doc.x = doc.page.margins.left;
}

function renderSalarySheetFooter(doc, reportStartY) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.moveDown(0.25);
  doc.x = x;
  doc.fontSize(8.5).fillColor('gray').text(
    `Generated on ${new Date().toLocaleString('en-IN')} by KPS Fleet Management System`,
    x,
    doc.y,
    { width, align: 'center', lineBreak: false }
  );
  doc.roundedRect(
    doc.page.margins.left - 8,
    reportStartY,
    doc.page.width - doc.page.margins.left - doc.page.margins.right + 16,
    doc.y - reportStartY + 8,
    8
  ).lineWidth(1).strokeColor('#1f4d2b').stroke();
}

// [label, value, leg] for each manual KM entered on the trip - mirrors the web single-trip print.
function manualKmRows(trip) {
  const hasValue = (value) => value != null && value !== '';
  const returnTarget = trip.isDiverted && trip.divertUnloadingLocation ? trip.divertUnloadingLocation : (trip.unloadingLocation || '-');
  return [
    ...(hasValue(trip.manualKm) ? [['Manual KM Load', `${fmtMoney(trip.manualKm)} km (One Way)`, `${trip.loadingLocation || '-'} -> ${trip.unloadingLocation || '-'}`]] : []),
    ...(hasValue(trip.manualKmDivert) ? [['Manual KM Divert', `${fmtMoney(trip.manualKmDivert)} km (One Way)`, `${trip.unloadingLocation || '-'} -> ${trip.divertUnloadingLocation || '-'}`]] : []),
    ...(hasValue(trip.manualKmReturn) ? [['Manual KM Return', `${fmtMoney(trip.manualKmReturn)} km (One Way)`, `${trip.fillingOrderLocation || '-'} -> ${returnTarget}`]] : []),
  ];
}

function styledSectionHeader(doc, text) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.roundedRect(x, y, width, 24, 4).fillAndStroke('#f3f6f3', '#1f4d2b');
  doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(11).text(text, x + 8, y + 7, { width: width - 16 });
  doc.y = y + 28;
}

function compactStyledSectionHeader(doc, text) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.roundedRect(x, y, width, 17, 3).fillAndStroke('#f3f6f3', '#1f4d2b');
  doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(8.5).text(text, x + 7, y + 4, {
    width: width - 14,
    lineBreak: false,
  });
  doc.y = y + 19;
}

function renderSalaryTripsTable(doc, headers, rows, total = {}, options = {}) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnRatios = [0.04, 0.22, 0.075, 0.12, 0.075, 0.075, 0.065, 0.105, 0.075, 0.075, 0.07];
  const numericTrailingCount = 6;
  const rowHeight = options.rowHeight || 22;
  const headerHeight = options.headerHeight || 28;
  const fontSize = options.fontSize || 8;
  const columnWidths = columnRatios.map((ratio) => width * ratio);
  const y = doc.y;
  const totalHeight = headerHeight + Math.max(rows.length, 1) * rowHeight + rowHeight;

  doc.rect(x, y, width, totalHeight).fillAndStroke('#ffffff', '#1f4d2b');
  doc.rect(x, y, width, headerHeight).fillAndStroke('#eaf2f5', '#1f4d2b');
  let columnX = x;
  headers.forEach((header, index) => {
    const numericColumn = index >= headers.length - numericTrailingCount;
    doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(fontSize).text(
      header.toUpperCase(), columnX + 4, y + 5, { width: columnWidths[index] - 8, align: numericColumn ? 'right' : 'left', lineBreak: false }
    );
    columnX += columnWidths[index];
  });

  rows.forEach((row, rowIndex) => {
    const rowY = y + headerHeight + rowIndex * rowHeight;
    if (rowIndex % 2 === 1) doc.rect(x, rowY, width, rowHeight).fill('#f8fbfc');
    doc.moveTo(x, rowY).lineTo(x + width, rowY).lineWidth(0.5).strokeColor('#b8c9d1').stroke();
    let cellX = x;
    row.forEach((cell, index) => {
      const numericColumn = index >= row.length - numericTrailingCount;
      doc.fillColor('#102f52').font('Helvetica').fontSize(fontSize).text(
        String(cell), cellX + 4, rowY + Math.max(2, (rowHeight - fontSize) / 2), { width: columnWidths[index] - 8, align: numericColumn ? 'right' : 'left', lineBreak: false }
      );
      cellX += columnWidths[index];
    });
  });

  const totalY = y + headerHeight + rows.length * rowHeight;
  doc.moveTo(x, totalY).lineTo(x + width, totalY).lineWidth(0.8).strokeColor('#1f4d2b').stroke();
  const labelColumnCount = headers.length - numericTrailingCount;
  const labelWidth = columnWidths.slice(0, labelColumnCount).reduce((sum, w) => sum + w, 0);
  doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(fontSize).text(total.totalLabel || 'Total', x + 4, totalY + Math.max(2, (rowHeight - fontSize) / 2), { width: labelWidth - 8, align: 'left', lineBreak: false });
  // Show a running total under each numeric column (Driver KM, Trip Diesel, Trip Advance, etc.),
  // not just the last one, so the report totals every figure the reader can see per trip.
  let numericColumnX = x + labelWidth;
  for (let index = labelColumnCount; index < headers.length; index += 1) {
    const columnTotal = rows.reduce((sum, row) => sum + (Number(String(row[index]).replace(/[^0-9.-]/g, '')) || 0), 0);
    const isLastColumn = index === headers.length - 1;
    const columnWidth = columnWidths[index];
    const displayValue = isLastColumn && total.totalValue != null
      ? total.totalValue
      : /km$/i.test(headers[index]) ? `${fmtMoney(columnTotal)} km`
      : /diesel\s*l/i.test(headers[index]) || /litre/i.test(headers[index]) ? `${fmtMoney(columnTotal)} L`
      : `Rs ${fmtMoney(columnTotal)}`;
    doc.text(displayValue, numericColumnX + 4, totalY + Math.max(2, (rowHeight - fontSize) / 2), { width: columnWidth - 8, align: 'right', lineBreak: false });
    numericColumnX += columnWidth;
  }
  doc.y = y + totalHeight + 4;
}

function renderSalaryRows(doc, rows, options = {}) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rowHeight = options.compact ? 13 : 25;
  const y = doc.y;
  doc.rect(x, y, width, rows.length * rowHeight).fillAndStroke('#ffffff', '#1f4d2b');
  rows.forEach(([label, value], index) => {
    const rowY = y + index * rowHeight;
    if (index > 0) doc.moveTo(x, rowY).lineTo(x + width, rowY).lineWidth(0.5).strokeColor('#b8c9d1').stroke();
    const emphasized = options.highlightLast && index === rows.length - 1;
    if (emphasized) doc.rect(x, rowY, width, rowHeight).fill('#eaf2f5');
    const fontSize = options.compact ? 8 : 10;
    const textY = rowY + (options.compact ? 3 : 7);
    doc.fillColor('#102f52').font(emphasized ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).text(
      label, x + 8, textY, { width: width * 0.72 - 8, lineBreak: false }
    );
    doc.text(value, x + width * 0.72, textY, { width: width * 0.28 - 16, align: 'right', lineBreak: false });
  });
  doc.y = y + rows.length * rowHeight + (options.compact ? 2 : 4);
}

function compactSectionHeader(doc, text) {
  doc.moveDown(0.04);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('black').text(text);
  doc.moveDown(0.03);
  doc.fontSize(7).font('Helvetica');
}

function sectionHeader(doc, text) {
  doc.moveDown(0.12);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('black').text(text);
  doc.moveDown(0.08);
  doc.fontSize(8.5).font('Helvetica');
}

function renderTable(doc, headers, rows, summary, options = {}) {
  if (options.styled) {
    renderStyledReportTable(doc, headers, rows, summary, options);
    return;
  }
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / headers.length;
  const startX = doc.x;
  const rowGap = options.compact ? 0.02 : 0.08;

  doc.font('Helvetica-Bold').fontSize(options.compact ? 7 : 8.5);
  headers.forEach((header, index) => {
    doc.text(String(header), startX + index * colWidth, doc.y, { width: colWidth, align: index === headers.length - 1 ? 'right' : 'left' });
  });
  doc.font('Helvetica');
  doc.moveDown(options.compact ? 0.03 : 0.12);

  rows.forEach((row) => {
    row.forEach((cell, index) => {
      doc.text(String(cell), startX + index * colWidth, doc.y, { width: colWidth, align: index === headers.length - 1 ? 'right' : 'left' });
    });
    doc.moveDown(rowGap);
  });

  if (summary) {
    doc.moveDown(rowGap);
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
        doc.moveDown(rowGap);
      });
    }
  }
}

function renderStyledReportTable(doc, headers, rows, summary, options = {}) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = width / headers.length;
  const rowHeight = options.compact ? 12 : 18;
  const headerHeight = options.compact ? 14 : 20;
  const extraRows = summary?.extraRows || [];
  const totalHeight = headerHeight + (rows.length + 1 + extraRows.length) * rowHeight;
  const y = doc.y;

  doc.rect(x, y, width, totalHeight).fillAndStroke('#ffffff', '#1f4d2b');
  doc.rect(x, y, width, headerHeight).fillAndStroke('#eaf2f5', '#1f4d2b');
  headers.forEach((header, index) => {
    doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(options.compact ? 6.5 : 7).text(
      String(header).toUpperCase(), x + index * columnWidth + (options.compact ? 5 : 8), y + (options.compact ? 4 : 6),
      { width: columnWidth - (options.compact ? 10 : 24), align: index === headers.length - 1 ? 'right' : 'left', lineBreak: false }
    );
  });

  const renderRow = (row, rowIndex, bold = false) => {
    const rowY = y + headerHeight + rowIndex * rowHeight;
    if (rowIndex % 2 === 1) doc.rect(x, rowY, width, rowHeight).fill('#f8fbfc');
    doc.moveTo(x, rowY).lineTo(x + width, rowY).lineWidth(0.5).strokeColor('#b8c9d1').stroke();
    row.forEach((cell, index) => {
      doc.fillColor('#102f52').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(options.compact ? 7.5 : 9).text(
        String(cell), x + index * columnWidth + (options.compact ? 5 : 8), rowY + (options.compact ? 3 : 5),
        { width: columnWidth - (options.compact ? 10 : 24), align: index === row.length - 1 ? 'right' : 'left', lineBreak: false }
      );
    });
  };

  rows.forEach((row, index) => renderRow(row, index));
  const totalRow = Array(headers.length).fill('');
  totalRow[0] = summary?.totalLabel || 'Total';
  totalRow[headers.length - 1] = summary?.totalValue || '';
  renderRow(totalRow, rows.length, true);
  extraRows.forEach((row, index) => {
    const extraRow = Array(headers.length).fill('');
    extraRow[0] = row[0] || '';
    extraRow[headers.length - 1] = row[row.length - 1] || '';
    if (headers.length > 2 && row.length > 2) extraRow[1] = row[1] || '';
    renderRow(extraRow, rows.length + 1 + index, true);
  });
  doc.y = y + totalHeight + 4;
}

function renderKeyValueRows(doc, rows, options = {}) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.x;
  const columnWidth = pageWidth / 2;

  doc.font('Helvetica').fontSize(options.compact ? 7.5 : 8.5);
  rows.forEach(([label, value]) => {
    doc.text(label, startX, doc.y, { width: columnWidth, align: 'left' });
    doc.text(value, startX + columnWidth, doc.y, { width: columnWidth, align: 'right' });
    doc.moveDown(options.compact ? 0.04 : 0.08);
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

module.exports = { buildTripSettlementPdf, buildDriverMonthlySummaryPdf, formatMonth };
