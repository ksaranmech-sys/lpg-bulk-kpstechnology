const PDFDocument = require('pdfkit');
const { calculateClosingOdometerKm } = require('./tripCalculations');

/**
 * Builds a printable trip settlement report as a PDF Buffer.
 * `trip` must be populated with .vehicle and .customer, and must already
 * have `trip.settlement` calculated (see tripCalculations.js).
 */
function buildTripSettlementPdf(trip, previousTrip = trip.previousTrip) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const reportStartY = doc.page.margins.top - 10;
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
    const turnExpenseTotal = Number(trip.turnExpense || 0);
    const parkingExpenseTotal = Number(trip.parkingExpense || 0);
    const unloadingExpenseTotal = Number(trip.unloadingExpense || 0);
    const rtoExpenseTotal = rtoEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const otherExpenseTotal = otherExpenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const totalExpenses = loadingExpenseTotal + turnExpenseTotal + parkingExpenseTotal + unloadingExpenseTotal + rtoExpenseTotal + otherExpenseTotal;
    const balance = totalAdvance - (dieselCashTotal + totalExpenses);

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#102f52').text('Single Trip', { align: 'left' });
    doc.moveDown(0.25);

    styledSectionHeader(doc, 'Single Trip');
    renderSalaryRows(doc, [
      ['Customer', trip.customer?.companyName || '-'],
      ['Vehicle Number', trip.vehicle?.vehicleNumber || '-'],
      ['Trip ID', String(trip._id || '-')],
      ['Loading Location', `${trip.loadingLocation || '-'} (${fmtDate(trip.loadingDate)})`],
      ['Unloading Location', `${trip.unloadingLocation || '-'} (${fmtDate(trip.unloadingDate)})`],
      ...(trip.isDiverted ? [['Divert Location', `${trip.divertUnloadingLocation ? `${trip.divertUnloadingLocation} (Divert)` : '-'} (${fmtDate(trip.divertDate)})`]] : []),
      ['Trip Status', trip.status || '-'],
    ]);

    styledSectionHeader(doc, 'Odometer KM');
    renderSalaryRows(doc, [
      ['Odometer KM', formatKm(odometerKm)],
      ['Manual KM', formatKm(trip.manualKm)],
    ]);

    styledSectionHeader(doc, 'Driver Advance Details');
    renderTable(doc, ['Date', 'Advance'],
      advances.length ? advances.map((a) => [fmtDate(a.date), `Rs ${fmtMoney(a.amount)}`]) : [['-', 'No advances added']],
      { totalLabel: 'Total', totalValue: `Rs ${fmtMoney(totalAdvance)}` }, { styled: true });
    doc.moveDown(0.25);

    styledSectionHeader(doc, 'Diesel Filled Details');
    renderTable(doc, ['Date', 'Purchase Type', 'Odometer KM', 'Tank Fill', 'Amount'],
      dieselEntries.length ? dieselEntries.map((d) => [
        fmtDate(d.filledAt),
        d.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card',
        d.odometerKm != null ? `${fmtMoney(d.odometerKm)} km` : '-',
        d.loadingPointTankFill ? '✓' : '-',
        `Rs ${fmtMoney(d.amount)}`,
      ]) : [['-', 'No diesel entries', '-', '-', '-']],
      { totalLabel: 'Diesel Card', totalValue: `Rs ${fmtMoney(dieselCardTotal)}`, extraRows: [
        ['Cash', '', `Rs ${fmtMoney(dieselCashTotal)}`],
        ['Total', '', `Rs ${fmtMoney(totalDiesel)}`],
      ] }, { styled: true });
    doc.moveDown(0.25);

    styledSectionHeader(doc, 'Expenses');
    renderTable(doc, ['Item', 'Date', 'Amount'], [
      ['Cleaner Loading', fmtDate(trip.loadingDate), `Rs ${fmtMoney(loadingExpenseTotal)}`],
      ['Turn', fmtDate(trip.turnDate), `Rs ${fmtMoney(turnExpenseTotal)}`],
      ['Parking', '-', `Rs ${fmtMoney(parkingExpenseTotal)}`],
      ...(unloadingExpenseTotal > 0 ? [['Unloading', fmtDate(trip.unloadingDate), `Rs ${fmtMoney(unloadingExpenseTotal)}`]] : []),
      ...rtoEntries.map((entry) => ['RTO', fmtDate(entry.date), `Rs ${fmtMoney(entry.amount)}`]),
      ...otherExpenses.map((entry) => [entry.description || 'Other', fmtDate(entry.date), `Rs ${fmtMoney(entry.amount)}`]),
    ], { totalLabel: 'Total Expenses', totalValue: `Rs ${fmtMoney(totalExpenses)}` }, { styled: true });
    doc.moveDown(0.25);

    styledSectionHeader(doc, 'Balance');
    renderSalaryRows(doc, [['Balance', `Rs ${fmtMoney(balance)}`], ['Driver Advance - (Cash Diesel + Expenses Total)', '']]);

    doc.fontSize(7).fillColor('gray').text(
      `Generated on ${new Date().toLocaleString('en-IN')} by KPS Fleet Management System`,
      { align: 'center' }
    );

    doc.roundedRect(
      doc.page.margins.left - 8,
      reportStartY,
      doc.page.width - doc.page.margins.left - doc.page.margins.right + 16,
      doc.y - reportStartY + 8,
      8
    ).lineWidth(1).strokeColor('#1f4d2b').stroke();

    doc.end();
  });
}

function buildDriverMonthlySummaryPdf({ driver, vehicle, customer, summary, trips, detailTrips = trips }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 24, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

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

    // Temporary (substitute) driver gets their own sheet so both settlements can be handed
    // out independently - the split rows never overlap with the regular driver's sheet.
    const temporaryDriver = summary.temporaryDriver;
    if (temporaryDriver) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 24 });
      const period = `${fmtDate(temporaryDriver.joiningDate)} - ${temporaryDriver.returningDate ? fmtDate(temporaryDriver.returningDate) : 'Ongoing'}`;
      renderSalarySheet(doc, {
        title: 'Temporary Driver Salary Calculation',
        driverLabel: `Temporary Driver: ${temporaryDriver.name || '-'}`,
        vehicle,
        customer,
        month: summary.month,
        summary: temporaryDriver,
        trips: temporaryDriver.trips || [],
        subtitle: `Covering for ${driver?.name || driver?.username || '-'} (${period})`,
        basicSalaryLabel: `Basic Salary Payable (Days covered: ${temporaryDriver.days || 0})`,
      });
    }

    detailTrips.forEach((trip) => renderMonthlyTripDetailsPage(
      doc,
      trip,
      trip.driverNames?.length ? { name: trip.driverNames.join(', ') } : driver,
      vehicle,
      customer
    ));
    doc.end();
  });
}

function renderSalarySheet(doc, { title, driverLabel, vehicle, customer, month, summary, trips, subtitle, basicSalaryLabel }) {
  const reportStartY = doc.page.margins.top - 10;
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
  doc.fillColor('black').fontSize(13).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(8.5);
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
  doc.y = metadataY + 12;
  doc.x = doc.page.margins.left;
  if (subtitle) {
    doc.text(subtitle, { align: 'center' });
    doc.x = doc.page.margins.left;
  }
  doc.text(`Closed trips: ${trips.length}`, { align: 'center' });
  doc.moveDown(0.2);
  doc.x = doc.page.margins.left;

  styledSectionHeader(doc, 'Closed Trips');
  renderSalaryTripsTable(doc, ['S.No', 'Loading Location', 'Unloading Location', 'Unloading Date', 'Divert Location', 'Divert Date', 'Driver KM', 'Diesel (Litres)', 'Trip Diesel', 'Trip Advance', 'Trip Expense', 'Balance'],
    trips.length ? trips.map((trip, index) => [
      String(index + 1),
      trip.loadingLocation || '-',
      trip.unloadingLocation || '-',
      fmtDate(trip.unloadingDate),
      trip.isDiverted ? trip.divertUnloadingLocation || '-' : '-',
      trip.isDiverted ? fmtDate(trip.divertDate) : '-',
      trip.corporationKm != null ? `${fmtMoney(trip.corporationKm)} km` : '-',
      `${fmtMoney(trip.dieselLitres || 0)} L`,
      `Rs ${fmtMoney(trip.dieselTotal || 0)}`,
      `Rs ${fmtMoney(trip.advanceTotal || 0)}`,
      `Rs ${fmtMoney(trip.expenseTotal || 0)}`,
      `Rs ${fmtMoney(trip.balance || 0)}`,
    ]) : [['-', 'No closed trips for this month', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']]);
  doc.moveDown(0.12);
  doc.x = doc.page.margins.left;

  styledSectionHeader(doc, 'Salary Calculation');
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
    salaryRows.splice(2, 0, [
      `Special Trip Charges (${summary.specialTripCount || 0} trips x Rs 1000)`,
      `Rs ${fmtMoney(summary.specialTripCharges)}`,
    ]);
  }
  renderSalaryRows(doc, salaryRows);
  doc.moveDown(0.25);
  doc.fontSize(7).fillColor('gray').text(
    `Generated on ${new Date().toLocaleString('en-IN')} by KPS Fleet Management System`,
    { align: 'center' }
  );
  doc.roundedRect(
    doc.page.margins.left - 8,
    reportStartY,
    doc.page.width - doc.page.margins.left - doc.page.margins.right + 16,
    doc.y - reportStartY + 8,
    8
  ).lineWidth(1).strokeColor('#1f4d2b').stroke();
}

function renderMonthlyTripDetailsPage(doc, trip, driver, vehicle, customer) {
  doc.addPage({ size: 'A4', layout: 'portrait', margin: 36 });
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.page.margins.top - 10;
  const advances = trip.driverAdvances || [];
  const dieselEntries = trip.dieselEntries || [];
  const rtoEntries = trip.rtoEntries || [];
  const otherExpenses = trip.otherExpenses || [];
  const totalAdvance = advances.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const dieselCardTotal = dieselEntries.filter((entry) => entry.paymentMethod !== 'cash').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const dieselCashTotal = dieselEntries.filter((entry) => entry.paymentMethod === 'cash').reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalDiesel = dieselEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const loadingExpense = Number(trip.loadingExpense || 0);
  const turnExpense = Number(trip.turnExpense || 0);
  const parkingExpense = Number(trip.parkingExpense || 0);
  const unloadingExpense = Number(trip.unloadingExpense || 0);
  const rtoExpense = rtoEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const otherExpense = otherExpenses.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalExpenses = loadingExpense + turnExpense + parkingExpense + unloadingExpense + rtoExpense + otherExpense;
  // Same formula as the salary sheet's Balance column so both agree per trip.
  const balance = totalAdvance - totalExpenses;
  const settlement = trip.settlement || {};

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#102f52').text('Single Trip', x, doc.y, { width, align: 'left' });
  doc.moveDown(0.35);
  styledSectionHeader(doc, 'Trip Details');
  renderTripOverview(
    doc,
    trip,
    customer,
    driver,
    vehicle,
    settlement.totalKm,
    settlement.mileageKmPerLitre,
    settlement.totalDieselLitres
  );

  styledSectionHeader(doc, 'Driver Advance Details');
  renderTable(doc, ['Date', 'Advance'], advances.length ? advances.map((entry) => [fmtDate(entry.date), `Rs ${fmtMoney(entry.amount)}`]) : [['-', 'No advances added']], { totalLabel: 'Total', totalValue: `Rs ${fmtMoney(totalAdvance)}` }, { styled: true });
  styledSectionHeader(doc, 'Diesel Filled Details');
  renderTable(doc, ['Date', 'Purchase Type', 'Amount'], dieselEntries.length ? dieselEntries.map((entry) => [fmtDate(entry.filledAt), entry.paymentMethod === 'cash' ? 'Cash' : 'Diesel Card', `Rs ${fmtMoney(entry.amount)}`]) : [['-', 'No diesel entries', '-']], { totalLabel: 'Diesel Card', totalValue: `Rs ${fmtMoney(dieselCardTotal)}`, extraRows: [['Cash', '', `Rs ${fmtMoney(dieselCashTotal)}`], ['Total', '', `Rs ${fmtMoney(totalDiesel)}`]] }, { styled: true });
  styledSectionHeader(doc, 'Expenses');
  renderTable(doc, ['Item', 'Date', 'Amount'], [
    ['Cleaner Loading', fmtDate(trip.loadingDate), `Rs ${fmtMoney(loadingExpense)}`],
    ['Turn', fmtDate(trip.turnDate), `Rs ${fmtMoney(turnExpense)}`],
    ['Parking', '-', `Rs ${fmtMoney(parkingExpense)}`],
    ...(unloadingExpense > 0 ? [['Unloading', fmtDate(trip.unloadingDate), `Rs ${fmtMoney(unloadingExpense)}`]] : []),
    ...rtoEntries.map((entry) => ['RTO', fmtDate(entry.date), `Rs ${fmtMoney(entry.amount)}`]),
    ...otherExpenses.map((entry) => [entry.description || 'Other', fmtDate(entry.date), `Rs ${fmtMoney(entry.amount)}`]),
  ], { totalLabel: 'Total', totalValue: `Rs ${fmtMoney(totalExpenses)}` }, { styled: true });
  styledSectionHeader(doc, 'Balance');
  renderSalaryRows(doc, [['Trip balance (Trip Advance - Trip Expenses)', `Rs ${fmtMoney(balance)}`]]);
  doc.roundedRect(x - 8, startY, width + 16, doc.y - startY + 8, 8).lineWidth(1).strokeColor('#1f4d2b').stroke();
}

function renderTripOverview(doc, trip, customer, driver, vehicle, odometerKm = null, mileageKmPerLitre = null, totalDieselLitres = null) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = width * 0.10;
  const valueWidth = width * 0.40;
  const y = doc.y;
  const rowHeight = 18;
  const rows = [
    ['Customer', customer?.companyName || '-', 'Driver', driver?.name || driver?.username || '-'],
    ['Trip Route', `${trip.loadingLocation || '-'} (${fmtDate(trip.loadingDate)}) -> ${trip.unloadingLocation || '-'} (${fmtDate(trip.unloadingDate)})${trip.isDiverted ? ` -> ${trip.divertUnloadingLocation || '-'} (${fmtDate(trip.divertDate)})` : ''}`, '', ''],
  ];
  const totalHeight = rowHeight * rows.length + 54;
  doc.rect(x, y, width, totalHeight).fillAndStroke('#ffffff', '#1f4d2b');
  rows.forEach((row, index) => {
    const rowY = y + index * rowHeight;
    if (index > 0) doc.moveTo(x, rowY).lineTo(x + width, rowY).lineWidth(0.5).strokeColor('#b8c9d1').stroke();
    doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(7.5).text(row[0], x + 8, rowY + 5, { width: labelWidth - 16, lineBreak: false });
    doc.font('Helvetica').text(row[1], x + labelWidth + 8, rowY + 5, {
      width: row[0] === 'Trip Route' ? width - labelWidth - 16 : valueWidth - 16,
      lineBreak: false,
    });
    if (row[2]) {
      const driverRow = row[2] === 'Driver';
      // Wide value cell so "Regular, Temp (Temporary)" fits on one line when both worked a trip.
      const driverLabelX = driverRow ? x + width * 0.50 : x + labelWidth * 2;
      const driverValueX = driverRow ? x + width * 0.60 : x + labelWidth * 3;
      const driverLabelWidth = driverRow ? width * 0.10 - 16 : labelWidth - 16;
      const driverValueWidth = driverRow ? width * 0.40 - 24 : valueWidth - 24;
      doc.font('Helvetica-Bold').text(row[2], driverLabelX + 8, rowY + 5, { width: driverLabelWidth, align: 'right', lineBreak: false });
      doc.font('Helvetica').text(row[3], driverValueX + 8, rowY + 5, { width: driverValueWidth, align: 'right', lineBreak: false });
    }
  });

  const tableY = y + rowHeight * rows.length + 4;
  const tableRowHeight = 18;
  function drawKmTable(startY, headers, tableRows, columnWidths) {
    const tableHeight = tableRowHeight * (tableRows.length + 1);
    doc.rect(x, startY, width, tableHeight).fillAndStroke('#ffffff', '#1f4d2b');
    doc.rect(x, startY, width, tableRowHeight).fillAndStroke('#eaf2f5', '#1f4d2b');
    headers.forEach((header, index) => {
      const columnX = x + columnWidths.slice(0, index).reduce((sum, value) => sum + value, 0);
      doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(7).text(header, columnX + 8, startY + 6, {
        width: columnWidths[index] - 16,
        align: index === 0 ? 'left' : 'right',
      });
    });
    tableRows.forEach((row, rowIndex) => {
      const rowY = startY + tableRowHeight * (rowIndex + 1);
      doc.moveTo(x, rowY).lineTo(x + width, rowY).lineWidth(0.5).strokeColor('#b8c9d1').stroke();
      row.forEach((value, index) => {
        const columnX = x + columnWidths.slice(0, index).reduce((sum, itemWidth) => sum + itemWidth, 0);
        doc.fillColor('#102f52').font(index === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).text(
          String(value), columnX + 8, rowY + 5, { width: columnWidths[index] - 16, align: index === 0 ? 'left' : 'right' }
        );
      });
    });
    return startY + tableHeight + 5;
  }

  const twoColumnWidths = [width * 0.6, width * 0.4];
  const threeColumnWidths = [width * 0.4, width * 0.3, width * 0.3];
  const remainingTableY = drawKmTable(tableY, ['Trip KM', 'Diesel for Trip', 'Mileage'], [
    [odometerKm != null ? `${fmtMoney(odometerKm)} km` : 'NA', totalDieselLitres != null ? `${fmtMoney(totalDieselLitres)} L` : 'NA', mileageKmPerLitre != null ? `${fmtMoney(mileageKmPerLitre)} km/L` : 'NA'],
  ], threeColumnWidths);
  doc.y = drawKmTable(remainingTableY, ['KM Type', 'KM'], [
    ['Corp. KM', trip.corpKm != null ? `${fmtMoney(trip.corpKm)} km` : 'NA'],
    ...(trip.manualKm != null ? [['Manual KM', `${fmtMoney(trip.manualKm)} km`]] : []),
    ['Driver KM', trip.corporationKm != null ? `${fmtMoney(trip.corporationKm)} km` : 'NA'],
  ], twoColumnWidths);
}

function styledSectionHeader(doc, text) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.roundedRect(x, y, width, 20, 4).fillAndStroke('#f3f6f3', '#1f4d2b');
  doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(9).text(text, x + 8, y + 6, { width: width - 16 });
  doc.y = y + 24;
}

function renderSalaryTripsTable(doc, headers, rows, total = {}) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnRatios = headers.length === 12
    ? [0.035, 0.12, 0.12, 0.085, 0.12, 0.085, 0.0725, 0.0725, 0.0725, 0.0725, 0.0725, 0.0725]
    : headers.length === 11
    ? [0.04, 0.115, 0.085, 0.115, 0.085, 0.115, 0.085, 0.09, 0.09, 0.09, 0.09]
    : headers.length === 9
    ? [0.04, 0.14, 0.11, 0.14, 0.11, 0.14, 0.11, 0.10, 0.11]
    : headers.length === 8
    ? [0.05, 0.18, 0.13, 0.17, 0.13, 0.10, 0.10, 0.14]
    : headers.length === 4
      ? [0.08, 0.34, 0.34, 0.24]
      : [0.05, 0.15, 0.12, 0.15, 0.12, 0.08, 0.08, 0.09, 0.16];
  // The trailing columns (KM/money figures) are right-aligned - how many varies by table shape.
  const numericTrailingCount = headers.length === 12 ? 6 : headers.length === 11 ? 4 : headers.length === 4 ? 1 : 2;
  const rowHeight = 22;
  const headerHeight = 30;
  const columnWidths = columnRatios.map((ratio) => width * ratio);
  const y = doc.y;
  const totalHeight = headerHeight + Math.max(rows.length, 1) * rowHeight + rowHeight;

  doc.rect(x, y, width, totalHeight).fillAndStroke('#ffffff', '#1f4d2b');
  doc.rect(x, y, width, headerHeight).fillAndStroke('#eaf2f5', '#1f4d2b');
  let columnX = x;
  headers.forEach((header, index) => {
    const numericColumn = index >= headers.length - numericTrailingCount;
    doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(7).text(
      header.toUpperCase(), columnX + 8, y + 6, { width: columnWidths[index] - 16, align: numericColumn ? 'right' : 'left', lineBreak: true }
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
      doc.fillColor('#102f52').font('Helvetica').fontSize(7.5).text(
        String(cell), cellX + 8, rowY + 5, { width: columnWidths[index] - 16, align: numericColumn ? 'right' : 'left', lineBreak: false }
      );
      cellX += columnWidths[index];
    });
  });

  const totalY = y + headerHeight + rows.length * rowHeight;
  doc.moveTo(x, totalY).lineTo(x + width, totalY).lineWidth(0.8).strokeColor('#1f4d2b').stroke();
  const labelColumnCount = headers.length - numericTrailingCount;
  const labelWidth = columnWidths.slice(0, labelColumnCount).reduce((sum, w) => sum + w, 0);
  doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(7.5).text(total.totalLabel || 'Total', x + 8, totalY + 5, { width: labelWidth - 16, align: 'left' });
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
      : /litre/i.test(headers[index]) ? `${fmtMoney(columnTotal)} L`
      : `Rs ${fmtMoney(columnTotal)}`;
    doc.text(displayValue, numericColumnX + 8, totalY + 5, { width: columnWidth - 16, align: 'right' });
    numericColumnX += columnWidth;
  }
  doc.y = y + totalHeight + 4;
}

function renderSalaryRows(doc, rows) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rowHeight = 20;
  const y = doc.y;
  doc.rect(x, y, width, rows.length * rowHeight).fillAndStroke('#ffffff', '#1f4d2b');
  rows.forEach(([label, value], index) => {
    const rowY = y + index * rowHeight;
    if (index > 0) doc.moveTo(x, rowY).lineTo(x + width, rowY).lineWidth(0.5).strokeColor('#b8c9d1').stroke();
    if (index === rows.length - 1) doc.rect(x, rowY, width, rowHeight).fill('#f3f6f3');
    doc.fillColor('#102f52').font(index === rows.length - 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).text(label, x + 8, rowY + 6, { width: width * 0.72 - 8 });
    doc.text(value, x + width * 0.72, rowY + 6, { width: width * 0.28 - 16, align: 'right' });
  });
  doc.y = y + rows.length * rowHeight + 4;
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
    renderStyledReportTable(doc, headers, rows, summary);
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

function renderStyledReportTable(doc, headers, rows, summary) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = width / headers.length;
  const rowHeight = 18;
  const headerHeight = 20;
  const extraRows = summary?.extraRows || [];
  const totalHeight = headerHeight + (rows.length + 1 + extraRows.length) * rowHeight;
  const y = doc.y;

  doc.rect(x, y, width, totalHeight).fillAndStroke('#ffffff', '#1f4d2b');
  doc.rect(x, y, width, headerHeight).fillAndStroke('#eaf2f5', '#1f4d2b');
  headers.forEach((header, index) => {
    doc.fillColor('#102f52').font('Helvetica-Bold').fontSize(7).text(
      String(header).toUpperCase(), x + index * columnWidth + 8, y + 6,
      { width: columnWidth - 24, align: index === headers.length - 1 ? 'right' : 'left' }
    );
  });

  const renderRow = (row, rowIndex, bold = false) => {
    const rowY = y + headerHeight + rowIndex * rowHeight;
    if (rowIndex % 2 === 1) doc.rect(x, rowY, width, rowHeight).fill('#f8fbfc');
    doc.moveTo(x, rowY).lineTo(x + width, rowY).lineWidth(0.5).strokeColor('#b8c9d1').stroke();
    row.forEach((cell, index) => {
      doc.fillColor('#102f52').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).text(
        String(cell), x + index * columnWidth + 8, rowY + 5,
        { width: columnWidth - 24, align: index === row.length - 1 ? 'right' : 'left', lineBreak: false }
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
