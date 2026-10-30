// Super admin only: add an admin (POST) or remove one for good (DELETE ?id=). The database functions check the
// caller is the super admin before the secret key is used; switching an admin off is a plain RPC (lib/api.ts).
import { CreateAdminRequest } from "@avantra/shared";
import { adminRpc, AdminError, answer, authAdmin, newAccount, requireAdmin } from "@/lib/server/admin";

export function POST(req: Request) {
  return answer(async () => {
    await requireAdmin();
    await adminRpc("admin_admins"); // refuses anyone but the super admin, before an account is made
    const parsed = CreateAdminRequest.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new AdminError(400, parsed.error.issues[0].message);
    const { name, email, password } = parsed.data;
    const admin = await newAccount(
      { email, password, email_confirm: true, user_metadata: { name }, app_metadata: { role: "ADMIN" } },
      (id) => adminRpc("admin_admin_setup", { p_user_id: id }),
      "Email already in use",
    );
    return Response.json(admin);
  });
}

export function DELETE(req: Request) {
  return answer(async () => {
    await requireAdmin();
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AdminError(400, "Pick an admin");
    await adminRpc("admin_check_removable", { p_user_id: id }); // super admin only, never a super admin
    const { error } = await authAdmin().deleteUser(id);
    // Their check-ins or scores keep the account: switching it off locks them out just the same.
    if (error) throw new AdminError(409, "This admin has done work that must be kept (check-ins or scores). Switch them off instead.");
    return Response.json({ id });
  });
}
