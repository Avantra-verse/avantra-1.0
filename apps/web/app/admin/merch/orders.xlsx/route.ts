// Every merch order as an Excel file with totals (lib/server/merch-sheet.ts); admin_merch_orders checks the caller is an admin.
import type { AdminMerchOrder } from "@/app/admin/merch";
import { adminRpc, answer } from "@/lib/server/admin";
import { writeMerchSheet } from "@/lib/server/merch-sheet";

export function GET() {
  return answer(async () => {
    const orders = await adminRpc<AdminMerchOrder[]>("admin_merch_orders");
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return new Response(new Uint8Array(await writeMerchSheet(orders)), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="avantra-merch-orders-${day}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  });
}
