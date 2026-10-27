import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { readUpiSheet, writeUpiSheet } from './upi-sheet.ts';

const row = (avantraId: string, utr: string) => ({
  avantraId,
  name: 'Asha Rao',
  school: 'DPS Rourkela',
  grade: 9,
  section: 'B',
  submittedAt: new Date('2026-12-01T06:30:00Z'),
  utr,
  amountPaise: 19900,
});

test('upi sheet: export, school fills Verified, import reads every case', async () => {
  const exported = await writeUpiSheet([row('AV26-AAAAA', '111111111111'), row('AV26-BBBBB', '222222222222'), row('AV26-CCCCC', '333333333333'), row('AV26-DDDDD', '444444444444'), row('AV26-EEEEE', '555555555555')]);

  // What the school does in Excel: pick from the dropdown, retype a UTR as a number, add a column.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(exported as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  assert.deepEqual((ws.getRow(1).values as unknown[]).slice(1), ['AVANTRA ID', 'Name', 'School', 'Class', 'Submitted (IST)', 'UTR', 'Amount (₹)', 'Verified']);
  assert.equal(ws.getCell('D2').value, '9-B');
  assert.equal(ws.getCell('E2').value, '1 Dec 2026, 12:00 pm');
  assert.deepEqual(ws.getCell('H2').dataValidation.formulae, ['"Paid,Not paid"']);
  ws.getCell('H2').value = 'Paid';
  ws.getCell('H3').value = 'Not paid';
  ws.getCell('F4').value = 333333333333; // retyped as a number
  ws.getCell('H4').value = ' paid ';
  // row 5 left empty: not checked yet
  ws.getCell('H6').value = 'done';
  ws.getCell('I1').value = 'Remarks';
  ws.addRow([]); // trailing empty row
  const filled = Buffer.from(await wb.xlsx.writeBuffer());

  const { decisions, unchecked, problems } = await readUpiSheet(filled);
  assert.deepEqual(decisions, [
    { row: 2, avantraId: 'AV26-AAAAA', utr: '111111111111', status: 'PAID' },
    { row: 3, avantraId: 'AV26-BBBBB', utr: '222222222222', status: 'FAILED' },
    { row: 4, avantraId: 'AV26-CCCCC', utr: '333333333333', status: 'PAID' },
  ]);
  assert.equal(unchecked, 1);
  assert.deepEqual(problems, ['Row 6: Verified says "done". Use Paid or Not paid.']);
});

test('upi sheet: wrong files are explained, not crashed on', async () => {
  assert.match((await readUpiSheet(Buffer.from('avantraId,utr\n'))).problems[0], /not an Excel/);
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Sheet1').addRow(['Name', 'Amount']);
  const other = Buffer.from(await wb.xlsx.writeBuffer());
  assert.equal((await readUpiSheet(other)).problems[0], 'The first row needs the columns "AVANTRA ID", "UTR", "Verified". Upload the file you exported.');
});
