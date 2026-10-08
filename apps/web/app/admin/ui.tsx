"use client";

// Small helpers shared by the admin sections.
import { useCallback, useEffect, useState } from "react";
import { api, API_URL, ApiError } from "@/lib/api";

// GET a path, with a reload after changes.
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}

// One button press = one API call: busy flag, error text and a success note.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const run = useCallback(async <T,>(fn: () => Promise<T>, ok?: (r: T) => string) => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const r = await fn();
      if (ok) setNote(ok(r));
      return r;
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, note, run, setError };
}

// Downloads: a plain link works because the session cookie goes with top-level GETs to the API.
export const fileUrl = (path: string) => API_URL + path;

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
