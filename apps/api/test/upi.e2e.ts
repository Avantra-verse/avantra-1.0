// End-to-end UPI QR payments: students send UTRs, admin exports Excel, the school marks Paid / Not paid, admin imports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { admin, call, logs, sleep, startApi, student } from './helpers.ts';

startApi(4105);

// The test database outlives runs, so UTRs must be new each time.
const utr = () => String(Math.floor(1e11 + Math.random() * 9e11));

async function download(cookie: string) {
  const res = await fetch('http://localhost:4105/admin/payments/upi.xlsx', { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /spreadsheetml/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await res.arrayBuffer()) as unknown as ExcelJS.Buffer);
  return wb;
}

// AVANTRA ID (column A) -> Excel row, for the rows this test made.
const rowOf = (wb: ExcelJS.Workbook, id: string) => {
  const ws = wb.worksheets[0];
  for (let n = 2; n <= ws.rowCount; n++) if (ws.getCell(n, 1).value === id) return n;
  return 0;
};

const upload = async (wb: ExcelJS.Workbook, cookie: string) => call('/admin/payments/upi/import', { file: Buffer.from(await wb.xlsx.writeBuffer()).toString('base64') }, cookie);

test('UPI: send UTR, export, school marks Paid / Not paid, import, failed students retry', async () => {
  const { cookie: adminCookie } = await admin();
  const [a, b, c] = [await student('upi-a'), await student('upi-b'), await student('upi-c')];
  const [utrA, utrB, utrC] = [utr(), utr(), utr()];

  // Sending: 12 digits only, one waiting payment each, a UTR can't be reused.
  assert.equal((await call('/payments/upi', { utr: '12345' }, a.cookie)).status, 400);
  const sent = await call('/payments/upi', { utr: ` ${utrA.slice(0, 6)} ${utrA.slice(6)} ` }, a.cookie);
  assert.equal(sent.status, 201, JSON.stringify(sent.json));
  assert.deepEqual([sent.json.method, sent.json.status, sent.json.utr], ['UPI', 'CREATED', utrA]);
  assert.equal((await call('/payments/upi', { utr: utr() }, a.cookie)).status, 409, 'one waiting payment');
  const reused = await call('/payments/upi', { utr: utrA }, b.cookie);
  assert.equal(reused.status, 409);
  assert.ok(reused.json.issues?.[0]?.path === 'utr');
  assert.equal((await call('/payments/upi', { utr: utrB }, b.cookie)).status, 201);
  assert.equal((await call('/payments/upi', { utr: utrC }, c.cookie)).status, 201);
  assert.equal((await call('/profile', undefined, a.cookie)).json.student.payments[0].status, 'CREATED');

  // Only admins see or export the list.
  assert.equal((await call('/admin/payments/upi', undefined, a.cookie)).status, 403);
  assert.equal((await fetch('http://localhost:4105/admin/payments/upi.xlsx', { headers: { cookie: a.cookie } })).status, 403);
  const waiting = (await call('/admin/payments/upi', undefined, adminCookie)).json as { avantraId: string }[];
  for (const s of [a, b, c]) assert.ok(waiting.some((w) => w.avantraId === s.avantraId));

  // The school: A paid, B not found in the statement, C not checked yet, plus a row with a typo.
  const wb = await download(adminCookie);
  const ws = wb.worksheets[0];
  const [ra, rb, rc] = [rowOf(wb, a.avantraId), rowOf(wb, b.avantraId), rowOf(wb, c.avantraId)];
  assert.ok(ra && rb && rc);
  assert.equal(ws.getCell(ra, 6).value, utrA);
  ws.getCell(ra, 8).value = 'Paid';
  ws.getCell(rb, 8).value = 'Not paid';
  ws.addRow([a.avantraId, '', '', '', '', '999999999999', 199, 'Paid']);
  const imported = await upload(wb, adminCookie);
  assert.equal(imported.status, 200, JSON.stringify(imported.json));
  assert.deepEqual([imported.json.paid, imported.json.failed, imported.json.already], [1, 1, 0]);
  assert.ok(imported.json.unchecked >= 1);
  assert.equal(imported.json.problems.length, 1);
  assert.match(imported.json.problems[0], /no UPI payment with UTR 999999999999/);

  // A is paid and emailed; B is told to try again.
  assert.ok((await call('/profile', undefined, a.cookie)).json.student.feePaidAt);
  assert.equal((await call('/profile', undefined, b.cookie)).json.student.payments[0].status, 'FAILED');
  await sleep(500);
  assert.match(logs(), new RegExp(`to ${a.email} \\| AVANTRA 2026: exhibition fee received[\\s\\S]*?UPI ${utrA}`));
  assert.match(logs(), new RegExp(`to ${b.email} \\| AVANTRA 2026: we could not confirm your payment`));
  assert.equal((await call('/payments/upi', { utr: utr() }, a.cookie)).status, 409, 'already paid');

  // Importing the same file again changes nothing.
  const again = await upload(wb, adminCookie);
  assert.deepEqual([again.json.paid, again.json.failed, again.json.already], [0, 0, 2]);

  // Next export: C still waiting, A and B gone. B checks the UTR and sends it again: back in the export.
  let next = await download(adminCookie);
  assert.deepEqual([!!rowOf(next, a.avantraId), !!rowOf(next, b.avantraId), !!rowOf(next, c.avantraId)], [false, false, true]);
  assert.equal((await call('/payments/upi', { utr: utrB }, b.cookie)).status, 201, 'a UTR marked Not paid can be sent again');
  next = await download(adminCookie);
  assert.ok(rowOf(next, b.avantraId));

  // Not an Excel file: explained, nothing changed.
  const junk = await call('/admin/payments/upi/import', { file: Buffer.from('hello').toString('base64') }, adminCookie);
  assert.equal(junk.status, 200);
  assert.match(junk.json.problems[0], /not an Excel/);
});
