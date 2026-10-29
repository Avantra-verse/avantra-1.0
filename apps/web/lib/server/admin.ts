// Admin downloads and uploads (app/admin/**/route.ts): database functions run with the admin's own session cookie,
// so each function's private.my_admin() check decides access, same as the admin page's calls.
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export class AdminError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function session() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", {
    // A refreshed session must be saved: a refresh token can't be reused.
    cookies: { getAll: () => store.getAll(), setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)) },
  });
}

// Throws AdminError (status from the PTxxx code, like lib/api.ts) so routes can answer with it.
export async function adminRpc<T>(fn: string, args: object = {}): Promise<T> {
  const { data, error } = await (await session()).rpc(fn, args);
  if (error?.code === "42501") throw new AdminError(403, "Admins only. Log in at /admin/login first.");
  if (error) throw new AdminError(/^PT\d{3}$/.test(error.code) ? Number(error.code.slice(2)) : 500, error.message);
  return data as T;
}

// Before anything uses the secret key: the caller must be a working admin (the same rule as private.my_admin()).
export async function requireAdmin() {
  const sb = await session();
  const { data } = await sb.auth.getUser();
  const u = data.user && (await sb.from("User").select("role, disabledAt").eq("id", data.user.id).maybeSingle()).data;
  if (u?.role !== "ADMIN" || u.disabledAt) throw new AdminError(403, "Admins only. Log in at /admin/login first.");
}

// Supabase Auth's admin API (making accounts). SUPABASE_SECRET_KEY is server-only: never NEXT_PUBLIC_.
export function authAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new AdminError(503, "Account creation isn't set up yet (SUPABASE_SECRET_KEY).");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", key, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;
}

// Makes the Auth user, then runs the admin function that finishes it; a failed finish deletes the user again.
export async function newAccount<T>(attrs: Parameters<ReturnType<typeof authAdmin>["createUser"]>[0], finish: (id: string) => Promise<T>, taken: string): Promise<T> {
  const auth = authAdmin();
  const { data, error } = await auth.createUser(attrs);
  if (error?.code === "email_exists") throw new AdminError(409, taken);
  if (error) throw new AdminError(error.status === 422 ? 400 : 500, error.message);
  try {
    return await finish(data.user.id);
  } catch (e) {
    await auth.deleteUser(data.user.id);
    throw e;
  }
}

// Route body: AdminError -> JSON error the admin page shows; anything else is logged and hidden.
export async function answer(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof AdminError) return Response.json({ message: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ message: "Something went wrong. Try again." }, { status: 500 });
  }
}

// CSV for admin exports. UTF-8 BOM so Excel shows Indian names correctly.
// Cells starting with = + - @ get a leading ' so a name like "=HYPERLINK(...)" can't run as a formula in Excel.
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const cell = (v: unknown) => {
    let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export const csvFile = (name: string, csv: string) =>
  new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="avantra-${name}.csv"`, "cache-control": "no-store" } });
