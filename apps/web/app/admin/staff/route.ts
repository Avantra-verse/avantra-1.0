// New volunteer or judge account. The admin sets the password and hands it over; staff can change it via "Forgot password".
import { CreateStaffRequest } from "@avantra/shared";
import { adminRpc, AdminError, answer, newAccount, requireAdmin } from "@/lib/server/admin";

export function POST(req: Request) {
  return answer(async () => {
    await requireAdmin();
    const parsed = CreateStaffRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AdminError(400, parsed.error.issues[0].message);
    const { role, name, email, password, expiresAt, eventId } = parsed.data;
    const staff = await newAccount(
      // Role in app_metadata: only the secret key can set it; handle_new_user copies it to "User".role.
      { email, password, email_confirm: true, user_metadata: { name }, app_metadata: { role } },
      (id) => adminRpc("admin_staff_setup", { p_user_id: id, p_event_id: eventId ?? null, p_expires_at: expiresAt?.toISOString() ?? null }),
      "Email already in use",
    );
    return Response.json(staff);
  });
}
