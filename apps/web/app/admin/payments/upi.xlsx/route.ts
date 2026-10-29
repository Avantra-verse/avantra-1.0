// UPI payments still under review, as the Excel file the school fills in (lib/server/upi-sheet.ts).
import { adminRpc, answer } from "@/lib/server/admin";
import { type UpiSheetRow, writeUpiSheet } from "@/lib/server/upi-sheet";

export function GET() {
  return answer(async () => {
    const rows = await adminRpc<(Omit<UpiSheetRow, "submittedAt"> & { submittedAt: string })[]>("admin_export", { p_kind: "upi" });
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // 2026-12-01
    return new Response(new Uint8Array(await writeUpiSheet(rows.map((r) => ({ ...r, submittedAt: new Date(r.submittedAt) })))), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="avantra-upi-payments-${day}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  });
}
