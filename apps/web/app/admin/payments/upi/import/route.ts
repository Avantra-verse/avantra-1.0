// The school's filled-in UPI sheet: Paid confirms the fee, Not paid fails the payment. Safe to upload twice.
import { adminRpc, AdminError, answer } from "@/lib/server/admin";
import { readUpiSheet } from "@/lib/server/upi-sheet";

type Decided = { row: number; avantraId: string; utr: string; result: "missing" | "already" | "paid" | "double" | "failed" };

export function POST(req: Request) {
  return answer(async () => {
    const { file } = await req.json().catch(() => ({}));
    if (typeof file !== "string" || !file || file.length > 14_000_000) throw new AdminError(400, "Upload the .xlsx file (at most 10 MB).");
    const { decisions, unchecked, problems } = await readUpiSheet(Buffer.from(file, "base64"));
    const decided = decisions.length ? await adminRpc<Decided[]>("admin_upi_decide", { p_decisions: decisions }) : [];
    // The function queues the "fee confirmed" / "try again" emails itself.
    for (const d of decided) {
      if (d.result === "missing") problems.push(`Row ${d.row}: no UPI payment with UTR ${d.utr} from ${d.avantraId}.`);
      if (d.result === "double") problems.push(`Row ${d.row}: ${d.avantraId} had already paid the fee. Refund one of the two payments.`);
    }
    const count = (r: Decided["result"]) => decided.filter((d) => d.result === r).length;
    return Response.json({ paid: count("paid") + count("double"), failed: count("failed"), already: count("already"), unchecked, problems });
  });
}
