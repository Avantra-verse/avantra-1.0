"use client";

// Account, profile and Wall status, loaded once for every /dashboard page (the layout stays mounted while
// students move between pages, so switching pages makes no database calls; pages that change things call reload).
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InviteCode } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, LOGIN_HREF, pendingInvite, type LastPayment, type Me } from "@/lib/api";

export type Student = {
  avantraId: string;
  qrToken: string;
  grade: number;
  section: string | null;
  schoolName: string;
  guardianEmail: string | null;
  guardianPhone: string | null;
  referralCode: string | null;
  feePaidAt: string | null;
  _count: { checkIns: number };
  payments: LastPayment[]; // the latest only
};
// One per event the student signed up for, with their team if they're in one.
export type MyReg = {
  id: string;
  topic: string | null;
  event: { slug: string; name: string; teamMax: number };
  teamMember: { isLeader: boolean; team: { id: string; name: string; members: unknown[] } } | null;
};
// UTR sent, the school hasn't decided yet: every page shows "under review" instead of asking to pay again.
export const feeReviewing = (s: Student | null) => !s?.feePaidAt && s?.payments[0]?.method === "UPI" && s.payments[0].status === "CREATED";
export type WallMe ={ open: boolean; points: number; solved: number; rank: number | null; players: number };

type Dashboard = {
  me: Me | null;
  student: Student | null; // null for staff or while loading
  wall: WallMe | null;
  regs: MyReg[];
  loaded: boolean;
  failed: string;
  reload: () => Promise<void>; // after a payment or a settings save
};

const Ctx = createContext<Dashboard | null>(null);

export function DashboardData({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<Dashboard, "reload">>({ me: null, student: null, wall: null, regs: [], loaded: false, failed: "" });

  const reload = useCallback(async () => {
    // Keep a team invite before any sign-up or log-in redirect can lose it.
    const invite = InviteCode.safeParse(new URLSearchParams(location.search).get("join"));
    if (invite.success) pendingInvite.set(invite.data);
    // All at once; profile, Wall and registrations fail harmlessly for someone not logged in (getMe decides).
    const [me, profile, wall, regs] = await Promise.all([
      getMe(),
      api<{ student: Student | null }>("/profile").catch(() => null),
      api<WallMe>("/wall/me").catch(() => null),
      api<MyReg[]>("/registrations/mine").catch(() => []),
    ]);
    if (!me) return router.replace(`${LOGIN_HREF}?next=${encodeURIComponent(location.pathname + location.search)}`);
    if (!me.profileComplete) return router.replace("/profile");
    setState({ me, student: profile?.student ?? null, wall, regs, loaded: true, failed: "" });
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
