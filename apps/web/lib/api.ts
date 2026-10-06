// Talks to the AVANTRA API (apps/api). The session is an httpOnly cookie the browser sends itself.
// NEXT_PUBLIC_API_URL is set per environment (.env.local for dev). While it's unset, the account
// pages show "opens soon" instead of forms that can't work.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const apiReady = API_URL !== "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {}, // field name -> message, from validation errors
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach AVANTRA right now. Check your connection and try again.");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return data as T;

  if (res.status === 429) throw new ApiError(429, "Too many attempts. Try again in a minute.");
  const fields: Record<string, string> = {};
  for (const issue of data?.issues ?? []) fields[issue.path] ??= issue.message;
  const message = typeof data?.message === "string" ? data.message : "Something went wrong. Please try again.";
  throw new ApiError(res.status, message, fields);
}

export type Role = "STUDENT" | "SCHOOL_COORDINATOR" | "JUDGE" | "VOLUNTEER" | "ADMIN";
export type Me = { id: string; email: string; name: string; role: Role; profileComplete: boolean };

// null = not logged in
export const getMe = () => api<Me>("/auth/me").catch((e) => (e instanceof ApiError && e.status === 401 ? null : Promise.reject(e)));
