// Walk-in at the desk: account + profile + cash fee in one step. No password: they set one later via "Forgot password".
import { WalkInRequest } from "@avantra/shared";
import { adminRpc, AdminError, answer, newAccount, requireAdmin } from "@/lib/server/admin";

export function POST(req: Request) {
  return answer(async () => {
    await requireAdmin();
    const parsed = WalkInRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AdminError(400, parsed.error.issues[0].message);
    const { name, email, note, ...profile } = parsed.data;
    const student = await newAccount(
      { email, email_confirm: true, user_metadata: { name } },
      (id) => adminRpc("admin_walk_in", { p_user_id: id, p_profile: profile, p_note: note ?? null }),
      "An account with this email already exists. Use mark-paid with their AVANTRA ID.",
    );
    return Response.json(student);
  });
}
