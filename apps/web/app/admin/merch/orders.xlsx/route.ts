// Every merch order as an Excel file, one row per order (admin_merch_orders checks the caller is an admin).
import ExcelJS from "exceljs";
import { adminRpc, answer } from "@/lib/server/admin";
import type { AdminMerchOrder } from "../../merch";

const ist = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const when = (d: string | null) => (d ? ist.format(new Date(d)) : "");

export function GET() {
  return answer(async () => {
    const orders = await adminRpc<AdminMerchOrder[]>("admin_merch_orders");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Merch orders", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: "Tracking ID", key: "trackingId", width: 16 },
      { header: "Status", key: "status", width: 11 },
      { header: "Ordered (IST)", key: "createdAt", width: 20 },
      { header: "Verified (IST)", key: "verifiedAt", width: 20 },
      { header: "Buyer", key: "buyerName", width: 24 },
      { header: "Email", key: "buyerEmail", width: 30 },
      { header: "Contact", key: "contactNo", width: 14, style: { numFmt: "@" } },
      { header: "School", key: "schoolName", width: 30 },
      { header: "Class", key: "studentClass", width: 8 },
      { header: "Name to print", key: "nameToPrint", width: 20 },
      { header: "Coordinator", key: "isCoordinator", width: 12 },
      { header: "UTR / Ref", key: "paymentNote", width: 16, style: { numFmt: "@" } }, // text, so Excel never shows 1.23457E+11
      { header: "Items", key: "items", width: 50 },
      { header: "Amount (₹)", key: "amount", width: 11 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const o of orders)
      ws.addRow({
        ...o,
        createdAt: when(o.createdAt),
        verifiedAt: when(o.verifiedAt),
        isCoordinator: o.isCoordinator ? "Yes" : "No",
        items: o.items
          .map((i) => `${i.name}${i.size ? ` (${i.size})` : ""} x${i.quantity}${i.nameToPrint ? ` "${i.nameToPrint}"` : ""}`)
          .join("; "),
        amount: o.totalPaise / 100,
      });
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return new Response(new Uint8Array(await wb.xlsx.writeBuffer()), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="avantra-merch-orders-${day}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  });
}
