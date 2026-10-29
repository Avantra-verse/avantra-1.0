// The filled Wall sheet (saved as CSV). Any bad row = nothing added, with every problem listed by row number.
import { adminRpc, AdminError, answer } from "@/lib/server/admin";
import { readSheet } from "@/lib/server/wall-sheet";

export function POST(req: Request) {
  return answer(async () => {
    const { csv } = await req.json().catch(() => ({}));
    if (typeof csv !== "string" || !csv || csv.length > 2_000_000) throw new AdminError(400, "Upload the sheet saved as CSV (at most 2 MB).");
    const { challenges, errors } = readSheet(csv);
    if (errors.length) return Response.json({ message: "Fix these rows; nothing was added", errors }, { status: 400 });
    return Response.json(await adminRpc("admin_wall_add", { p_challenges: challenges }));
  });
}
