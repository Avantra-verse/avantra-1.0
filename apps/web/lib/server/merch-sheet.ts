// The merch orders Excel file: a Summary sheet (orders + ₹ per status) and an Orders sheet (one row per order).
// Totals are formulas, so they stay right if someone edits a status or amount; each also carries its value for viewers that don't recalculate.
import ExcelJS from 'exceljs';
import type { AdminMerchOrder } from '@/app/admin/merch';

const LABEL: Record<AdminMerchOrder['status'], string> = {
  PAID: 'Paid',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  PENDING: 'Pending',
  NOT_ORDERED: 'Tried, not ordered',
  CANCELLED: 'Cancelled',
};
const VERIFIED = ['PAID', 'SHIPPED', 'DELIVERED'] as const;
const ALL = Object.keys(LABEL) as AdminMerchOrder['status'][];
const RUPEES = '"₹"#,##0';
// Excel has no time zones: shift to IST so the cell shows Indian time.
const ist = (d: string | null) => (d ? new Date(new Date(d).getTime() + 5.5 * 3600e3) : null);

export async function writeMerchSheet(orders: AdminMerchOrder[], exportedAt = new Date()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  const ws = wb.addWorksheet('Orders', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'Tracking ID', key: 'trackingId', width: 16 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Ordered (IST)', key: 'createdAt', width: 18, style: { numFmt: 'dd mmm yyyy hh:mm' } },
    { header: 'Verified (IST)', key: 'verifiedAt', width: 18, style: { numFmt: 'dd mmm yyyy hh:mm' } },
    { header: 'Buyer', key: 'buyerName', width: 24 },
    { header: 'Email', key: 'buyerEmail', width: 30 },
    { header: 'Contact', key: 'contactNo', width: 14, style: { numFmt: '@' } },
    { header: 'School', key: 'schoolName', width: 30 },
    { header: 'Class', key: 'studentClass', width: 8 },
    { header: 'Name to print', key: 'nameToPrint', width: 20 },
    { header: 'Coordinator', key: 'isCoordinator', width: 12 },
    { header: 'UTR / Ref', key: 'paymentNote', width: 16, style: { numFmt: '@' } }, // text, so Excel never shows 1.23457E+11
    { header: 'Items', key: 'items', width: 50 },
    { header: 'Amount (₹)', key: 'amount', width: 13, style: { numFmt: RUPEES } },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };

  for (const o of orders)
    ws.addRow({
      ...o,
      status: LABEL[o.status] ?? o.status,
      createdAt: ist(o.createdAt),
      verifiedAt: ist(o.verifiedAt),
      isCoordinator: o.isCoordinator ? 'Yes' : 'No',
      items: o.items
        .map((i) => `${i.name}${i.size ? ` (${i.size})` : ''} x${i.quantity}${i.nameToPrint ? ` "${i.nameToPrint}"` : ''}`)
        .join('; '),
      amount: o.totalPaise / 100,
    });

  const last = orders.length + 1; // last data row
  const status = ws.getColumn('status').letter;
  const amount = ws.getColumn('amount').letter;
  const rupees = (list: readonly AdminMerchOrder['status'][]) =>
    orders.filter((o) => list.includes(o.status)).reduce((s, o) => s + o.totalPaise, 0) / 100;
  ws.autoFilter = { from: 'A1', to: { row: Math.max(last, 2), column: ws.columnCount } };

  // SUBTOTAL ignores rows hidden by a filter, so this total follows whatever the filter shows.
  // No orders, no total row: it would land on row 2 and add itself up.
  if (orders.length) {
    const total = ws.addRow({});
    total.getCell('trackingId').value = { formula: `SUBTOTAL(103,A2:A${last})`, result: orders.length };
    total.getCell('trackingId').numFmt = '0 "orders"';
    total.getCell('items').value = 'Total of rows shown';
    total.getCell('amount').value = { formula: `SUBTOTAL(109,${amount}2:${amount}${last})`, result: rupees(ALL) };
    total.font = { bold: true };
    total.getCell('items').alignment = { horizontal: 'right' };
    total.border = { top: { style: 'thin' } };
  }

  summary.columns = [{ width: 34 }, { width: 10 }, { width: 16, style: { numFmt: RUPEES } }];
  summary.addRow(['AVANTRA 2026 merch orders']).font = { bold: true, size: 14 };
  summary.addRow([`Exported ${exportedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST`]).font = { color: { argb: 'FF666666' } };
  summary.addRow([]);
  const sh = summary.addRow(['Status', 'Orders', 'Amount (₹)']);
  sh.font = { bold: true };
  sh.fill = head.fill;

  const range = (c: string) => `Orders!$${c}$2:$${c}$${Math.max(last, 2)}`;
  const line = (name: string, list: readonly AdminMerchOrder['status'][], bold = false) => {
    const all = list === ALL;
    const count = all ? `COUNTA(${range(status)})` : list.map((s) => `COUNTIF(${range(status)},"${LABEL[s]}")`).join('+');
    const sum = all ? `SUM(${range(amount)})` : list.map((s) => `SUMIF(${range(status)},"${LABEL[s]}",${range(amount)})`).join('+');
    const row = summary.addRow([
      name,
      { formula: count, result: orders.filter((o) => list.includes(o.status)).length },
      { formula: sum, result: rupees(list) },
    ]);
    if (bold) row.font = { bold: true };
  };
  line('Verified revenue (paid, shipped, delivered)', VERIFIED, true);
  line('  Paid', ['PAID']);
  line('  Shipped', ['SHIPPED']);
  line('  Delivered', ['DELIVERED']);
  line('Pending (not verified yet)', ['PENDING']);
  line('Tried, not ordered', ['NOT_ORDERED']);
  line('Cancelled (payment rejected)', ['CANCELLED']);
  line('All orders', ALL, true);
  summary.lastRow!.border = { top: { style: 'thin' } };

  wb.calcProperties.fullCalcOnLoad = true; // Excel recomputes every total on open (exceljs drops cached zeros)
  return Buffer.from(await wb.xlsx.writeBuffer());
}
