// Calls a public database function as a logged-out visitor, from route handlers. Returns null on any failure.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export async function publicRpc<T>(fn: string, args: object = {}): Promise<T | null> {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  }).catch(() => null);
  return res?.ok ? res.json() : null;
}
