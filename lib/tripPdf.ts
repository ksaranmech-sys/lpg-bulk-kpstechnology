// @ts-nocheck
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Generates a simple, printable one-page settlement sheet as a PDF buffer.
export async function buildTripPdf(trip, vehicleNumber) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const line = (text, opts = {}) => {
    page.drawText(text, { x: 50, y, size: opts.size || 11, font: opts.bold ? bold : font, color: rgb(0, 0, 0) });
    y -= opts.gap || 18;
  };

  line("KPS Technology - Trip Settlement Report", { size: 16, bold: true, gap: 28 });
  line(`Vehicle: ${vehicleNumber}`, { bold: true });
  line(`Loading: ${trip.loadingLocation}   ->   Unloading: ${trip.unloadingLocation || "-"}`);
  line(`Driver Advance: Rs ${trip.driverAdvance.amount} (on ${new Date(trip.driverAdvance.date).toDateString()})`);
  y -= 8;

  line("Diesel Fills", { bold: true });
  trip.dieselFills.forEach((f, i) => {
    line(
      `${i === 0 ? "[Carry-over, excluded] " : ""}${new Date(f.date).toDateString()}  |  ${f.volume} L @ Rs${f.rate}  =  Rs ${f.value}${f.odometerKm ? "  |  ODO " + f.odometerKm : ""}`,
      { size: 10 }
    );
  });
  y -= 8;

  line("Settlement", { bold: true });
  line(`Total Diesel (billable): ${trip.settlement.totalDieselLitres} L  =  Rs ${trip.settlement.totalDieselValue}`);
  line(`Total KM: ${trip.settlement.totalKm ?? "-"}`);
  line(`Mileage: ${trip.settlement.mileage ?? "-"} km/l`);
  line(`Total Other Expenses (loading+unloading+RTO+misc): Rs ${trip.settlement.totalOtherExpenses}`);
  line(`Balance (Advance - Expenses): Rs ${trip.settlement.balance}`, { bold: true });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
