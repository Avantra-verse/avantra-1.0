"use client";

// Account, profile and Wall status, loaded once for every /dashboard page (the layout stays mounted while
// students move between Home, Payment and Settings, so switching pages makes no database calls).
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, apiReady, getMe, LOGIN_HREF, type LastPayment, type Me } from "@/lib/api";

export type Student = {
  avantraId: string;
  qrToken: string;
  grade: number;
  section: string | null;
  schoolName: string;
  guardianEmail: string | null;
  guardianPhone: string | null;
  feePaidAt: string | null;
  _count: { checkIns: number };
  payments: LastPayment[]; // the latest only
};
export type WallMe = { open: boolean; points: number; solved: number; rank: number | null; players: number };

type Dashboard = {
  me: Me | null;
  student: Student | null; // null for staff or while loading
  wall: WallMe | null;
  loaded: boolean;
  failed: string;
  reload: () => Promise<void>; // after a payment or a settings save
};

const Ctx = createContext<Dashboard | null>(null);

export function DashboardData({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<Dashboard, "reload">>({ me: null, student: null, wall: null, loaded: false, failed: "" });

  const reload = useCallback(async () => {
    // All three at once; profile and Wall fail harmlessly for someone not logged in (getMe decides).
    const [me, profile, wall] = await Promise.all([
      getMe(),
      api<{ student: Student | null }>("/profile").catch(() => null),
      api<WallMe>("/wall/me").catch(() => null),
    ]);
    if (!me) return router.replace(LOGIN_HREF);
    if (!me.profileComplete) return router.replace("/profile");
    setState({ me, student: profile?.student ?? null, wall, loaded: true, failed: "" });
  }, [router]);

  useEffect(() => {
    if (!apiReady) return;
    reload().catch((e: ApiError) => setState((s) => ({ ...s, failed: e.message })));
  }, [reload]);

  return <Ctx.Provider value={{ ...state, reload }}>{children}</Ctx.Provider>;
}

export function useDashboard() {
  const d = useContext(Ctx);
  if (!d) throw new Error("useDashboard needs <DashboardData>");
  return d;
}
