// Print-ready chits: 6 per A4 page, each with its own QR. ?numbers=4,9,12 reprints just those.
import { adminRpc, AdminError, answer } from "@/lib/server/admin";
import { type Chit, renderChits } from "@/lib/server/chits";

export function GET(req: Request) {
  return answer(async () => {
    const url = new URL(req.url);
    const only = url.searchParams.get("numbers")?.split(",").map(Number).filter(Number.isInteger);
    const chits = (await adminRpc<Chit[]>("admin_export", { p_kind: "chits" })).filter((c) => !only || only.includes(c.number));
    if (!chits.length) throw new AdminError(404, "No active challenges to print");
    return new Response(Buffer.from(await renderChits(chits, url.origin)), {
      headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="avantra-wall-chits.pdf"', "cache-control": "no-store" },
    });
  });
}
