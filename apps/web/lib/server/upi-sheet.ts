// The Excel file the school checks UPI payments in. We export the payments still under review; the school fills
// "Verified" (a Paid / Not paid dropdown) from its bank statement and sends the file back; we import it.
// Rows are matched on UTR + AVANTRA ID, so the school can sort, filter or add columns freely.
import ExcelJS from 'exceljs';

export const PAID = 'Paid';
export const NOT_PAID = 'Not paid';

export type UpiSheetRow = {
  avantraId: string;
  name: string;
  school: string;
  grade: number;
  section: string | null;
  submittedAt: Date;
  utr: string;
  amountPaise: number;
};

export type UpiDecision = { row: number; avantraId: string; utr: string; status: 'PAID' | 'FAILED' };

const COLUMNS = [
  { header: 'AVANTRA ID', key: 'avantraId', width: 14 },
  { header: 'Name', key: 'name', width: 26 },
  { header: 'School', key: 'school', width: 32 },
  { header: 'Class', key: 'grade', width: 8 },
  { header: 'Submitted (IST)', key: 'submitted', width: 20 },
  { header: 'UTR', key: 'utr', width: 16, style: { numFmt: '@' } }, // text, so Excel never shows 1.23457E+11
  { header: 'Amount (₹)', key: 'amount', width: 11 },
  { header: 'Verified', key: 'verified', width: 12 },
];

const ist = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

export async function writeUpiSheet(rows: UpiSheetRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payments', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      avantraId: r.avantraId,
      name: r.name,
      school: r.school,
      grade: r.section ? `${r.grade}-${r.section}` : String(r.grade),
      submitted: ist.format(r.submittedAt),
      utr: r.utr,
      amount: r.amountPaise / 100,
    });
  }
  const verified = COLUMNS.findIndex((c) => c.key === 'verified') + 1;
  for (let i = 2; i <= rows.length + 1; i++) {
    ws.getCell(i, verified).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${PAID},${NOT_PAID}"`],
      showErrorMessage: true,
      errorTitle: 'Paid or Not paid',
      error: 'Pick Paid or Not paid from the list. Leave it empty if you have not checked this payment yet.',
    };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// A cell as plain text. A UTR the school retyped may come back as a number; 12 digits are exact in a double.
function text(cell: ExcelJS.Cell): string {
  if (typeof cell.value === 'number') return String(cell.value);
  return (cell.text ?? '').trim();
}

// Rows with Verified empty are counted as not checked yet. Problems are listed by Excel row number.
export async function readUpiSheet(file: Buffer): Promise<{ decisions: UpiDecision[]; unchecked: number; problems: string[] }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file as unknown as ExcelJS.Buffer);
  } catch {
    return { decisions: [], unchecked: 0, problems: ['This is not an Excel (.xlsx) file. Upload the file you exported, after the school has filled it in.'] };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { decisions: [], unchecked: 0, problems: ['The file has no sheets.'] };

  const col: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, n) => void (col[text(cell).toLowerCase()] = n));
  const missing = ['AVANTRA ID', 'UTR', 'Verified'].filter((h) => !col[h.toLowerCase()]);
  if (missing.length) return { decisions: [], unchecked: 0, problems: [`The first row needs the columns ${missing.map((m) => `"${m}"`).join(', ')}. Upload the file you exported.`] };

  const decisions: UpiDecision[] = [];
  const problems: string[] = [];
  let unchecked = 0;
  for (let n = 2; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const avantraId = text(row.getCell(col['avantra id'])).toUpperCase();
    const utr = text(row.getCell(col['utr'])).replace(/\s/g, '');
    const verified = text(row.getCell(col['verified'])).toLowerCase();
    if (!avantraId && !utr) continue; // empty row
    if (!verified) {
      unchecked++;
      continue;
    }
    const status = verified === PAID.toLowerCase() ? 'PAID' : verified === NOT_PAID.toLowerCase() ? 'FAILED' : null;
    if (!status) problems.push(`Row ${n}: Verified says "${verified}". Use ${PAID} or ${NOT_PAID}.`);
    else if (!/^\d{12}$/.test(utr)) problems.push(`Row ${n}: the UTR "${utr}" is not 12 digits.`);
    else if (!avantraId) problems.push(`Row ${n}: the AVANTRA ID is empty.`);
    else decisions.push({ row: n, avantraId, utr, status });
  }
  return { decisions, unchecked, problems };
}
