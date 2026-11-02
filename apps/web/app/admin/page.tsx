"use client";

// Admin dashboard: numbers and exports, school approvals, the registration desk, staff accounts,
// event results and the Engagement Wall. Laptop-first, still usable on a phone at the desk.
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav, ADMIN_LINKS } from "@/components/Nav";
import QRCode from "qrcode";
import { CreateAdminRequest, CreateStaffRequest, WalkInRequest } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { Field, FormError, OpensSoon, SelectField, styles as account } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { fileUrl, rupees, useAction, useHashTab, useLoad } from "./ui";
import o from "./overview.module.css";
import { siteConfig } from "@/content/site";
import { Events } from "./events";
import { UpiPayments } from "./payments";
import { Wall } from "./wall";
import { Messages } from "./messages";
import { Teams } from "./teams";
import { Avatar, Profile, Students, toneOf } from "./people";
import px from "./people.module.css";

const TABS = { overview: "Overview", students: "Students", teams: "Teams", payments: "UPI payments", messages: "Messages", referrals: "Referral codes", events: "Events", desk: "Desk", wall: "Wall", staff: "Staff", admins: "Admins" } as const;
type Tab = keyof typeof TABS;

// One line under each tab's title.
const INTRO: Record<Tab, string> = {
  overview: "Sign-ups, fees and the gate at a glance, plus the CSV downloads.",
  students: "Find any student and see everything about them. Only the super admin can fix details, change the fee or delete.",
  teams: "Every team in every event, with each member's class, school and fee. Set places in Events.",
  referrals: "How many students each ambassador code brought in.",
  messages: "What visitors sent from the Contact page. Sort them into categories and mark them resolved once answered.",
  payments: "UPI payments for the school to check, and their answers coming back.",
  desk: "Cash fees and walk-in registrations at the registration desk.",
  staff: "Volunteer and judge accounts, and which event each judge scores. Open one to see their whole account.",
  events: "Open or close events and see the judges' results.",
  wall: "The Engagement Wall: switch it on for event day, add and print challenges.",
  admins: "Add admins, switch them off or remove them. Only the super admin sees this.",
};

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState("");
  const tab = useHashTab(TABS, "overview");

  useEffect(() => {
    if (!apiReady) return;
    getMe()
      .then((m) => (m?.role === "ADMIN" ? setMe(m) : router.replace("/admin/login")))
      .catch((e: ApiError) => setFailed(e.message));
  }, [router]);

  return (
    <>
      <AppNav links={me?.superAdmin ? ADMIN_LINKS : ADMIN_LINKS.filter((l) => l.href !== "/admin#admins")} badge={me?.superAdmin ? "SUPER ADMIN" : "ADMIN"} loginHref="/admin/login" portal />
      {/* md+: no top bar (the sidebar replaces it), so take back <main>'s top padding and clear the sidebar. */}
      <div className={`${account.registrationPage} md:-mt-16 md:pl-60`}>
        <div className={account.starfieldLayer} aria-hidden="true" />
        <div className={`${t.page} ${t.appPage}`}>
          {!apiReady ? (
            <div className={t.panel}>
              <OpensSoon what="Admin" />
            </div>
          ) : !me ? (
            failed ? <FormError message={failed} /> : <p className={t.mute} role="status">Loading…</p>
          ) : (
            <>
              <header className={t.pageHead}>
                <h1>{TABS[tab]}</h1>
                <p>{INTRO[tab]}</p>
              </header>
              {tab === "overview" && <Overview name={me.name} />}
              {tab === "students" && <Students canEdit={!!me.superAdmin} />}
              {tab === "teams" && <Teams />}
              {tab === "referrals" && <Referrals />}
              {tab === "messages" && <Messages />}
              {tab === "payments" && <UpiPayments />}
              {tab === "desk" && <Desk />}
              {tab === "staff" && <Staff canEdit={!!me.superAdmin} />}
              {tab === "events" && <Events />}
              {tab === "wall" && <Wall />}
              {tab === "admins" && (me.superAdmin ? <Admins meId={me.id} /> : <FormError message="Only the super admin can manage admins." />)}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---- overview ----

type Stats = {
  students: { total: number; paid: number; unpaid: number; juniors: number; seniors: number; below6: number };
  signups: { today: number; week: number; profileUnfinished: number };
  upiWaiting: number;
  exhibition: { registered: number; paidNoTeam: number; teamSizes: Record<"1" | "2" | "3", number>; themes: { topic: string; students: number }[] };
  topSchools: { school: string; students: number; paid: number }[];
  staff: { volunteers: number; judges: number; admins: number };
  referralCodes: number;
  fees: { onlinePaise: number; onlineCount: number; cashPaise: number; cashCount: number };
  gate: { checkedInToday: number };
  events: { id: string; name: string; capacity: number | null; registrations: number; teams: number; deskScans: number }[];
};

// Coloured tile for the overview.
function Stat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: "red" | "green" | "gold" | "pink" }) {
  return (
    <div className={o.stat} data-tone={tone}>
      <span className={o.statValue}>{value}</span>
      <span className={o.statLabel}>{label}</span>
    </div>
  );
}

// A bar out of `max`; 0 when there is nothing to compare against.
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className={o.bar} aria-hidden="true">
      <div className={o.barFill} style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` }} />
    </div>
  );
}

function Overview({ name }: { name: string }) {
  const { data: s, error, reload } = useLoad<Stats>("/admin/stats");
  if (!s) return error ? <FormError message={error} /> : <p className={t.mute}>Loading…</p>;
  const collected = s.fees.onlinePaise + s.fees.cashPaise;
  const paidPct = s.students.total ? Math.round((s.students.paid / s.students.total) * 100) : 0;
  const days = Math.max(0, Math.ceil((new Date(siteConfig.eventDateISO).getTime() - Date.now()) / 86_400_000));
  const sizes = s.exhibition.teamSizes;
  const teams = sizes["1"] + sizes["2"] + sizes["3"];
  const topTheme = Math.max(1, ...s.exhibition.themes.map((x) => x.students));
  const topSchool = Math.max(1, ...s.topSchools.map((x) => x.students));
  return (
    <>
      <section className={o.hero} aria-labelledby="collected">
        <button type="button" className={`${t.ghost} ${o.refresh}`} onClick={reload}>Refresh</button>
        <div>
          <p className={o.hello}>Namaste, {name.split(" ")[0]}</p>
          <h2 id="collected" className={o.money}>{rupees(collected)}</h2>
          <p className={o.heroSub}>
            collected · {s.students.paid} of {s.students.total} students paid
            {s.upiWaiting > 0 && ` · ${s.upiWaiting} UPI waiting for the school`}
          </p>
          <Bar value={s.students.paid} max={s.students.total} />
          <div className={o.barLabel}>
            <span>{paidPct}% paid</span>
            <span>{s.students.unpaid} not paid yet</span>
          </div>
        </div>
        <div className={o.countdown}>
          <strong>{days}</strong>
          <span>{days === 1 ? "day" : "days"} to AVANTRA</span>
        </div>
      </section>

      <h3 className={o.groupTitle}>Sign-ups</h3>
      <div className={o.tiles}>
        <Stat value={s.students.total} label="students with a profile" />
        <Stat value={s.signups.today} label="signed up today" tone="green" />
        <Stat value={s.signups.week} label="signed up in the last 7 days" tone="green" />
        <Stat value={s.signups.profileUnfinished} label="signed up, profile not finished" tone="gold" />
      </div>

      <h3 className={o.groupTitle}>Money</h3>
      <div className={o.tiles}>
        <Stat value={rupees(s.fees.onlinePaise)} label={`online · ${s.fees.onlineCount} payments`} tone="red" />
        <Stat value={rupees(s.fees.cashPaise)} label={`cash at desk · ${s.fees.cashCount} payments`} tone="red" />
        <Stat value={s.upiWaiting} label="UPI payments waiting for the school" tone="gold" />
        <Stat value={s.referralCodes} label="ambassador codes used" tone="pink" />
      </div>

      <h3 className={o.groupTitle}>People</h3>
      <div className={o.tiles}>
        <Stat value={s.students.juniors} label="juniors (classes 6–8)" />
        <Stat value={s.students.seniors} label="seniors (classes 9–12)" />
        <Stat value={`${s.staff.volunteers} · ${s.staff.judges} · ${s.staff.admins}`} label="volunteers · judges · admins" tone="pink" />
        <Stat value={s.gate.checkedInToday} label="through the gate today" tone="green" />
      </div>

      <section className={t.panel} aria-labelledby="exhibition-stats">
        <h2 id="exhibition-stats">Science Exhibition</h2>
        <div className={o.tiles}>
          <Stat value={s.exhibition.registered} label="registered" />
          <Stat value={s.exhibition.paidNoTeam} label="paid, no team yet" tone="gold" />
          <Stat value={teams} label="teams formed" tone="green" />
          <Stat value={`${sizes["1"]} · ${sizes["2"]} · ${sizes["3"]}`} label="teams of 1 · 2 · 3" tone="pink" />
        </div>
        <div className={o.split}>
          <div>
            <h3 className={o.groupTitle}>Team sizes</h3>
            <ul className={o.rows}>
              {(["1", "2", "3"] as const).map((k) => (
                <li key={k} className={o.row}>
                  <span className={o.rowName}>{k === "1" ? "Solo" : `Team of ${k}`}</span>
                  <span className={o.rowNum}>{sizes[k]}</span>
                  <Bar value={sizes[k]} max={Math.max(1, teams)} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className={o.groupTitle}>Themes</h3>
            {s.exhibition.themes.length === 0 ? (
              <p className={t.mute}>No themes picked yet.</p>
            ) : (
              <ul className={o.rows}>
                {s.exhibition.themes.map((x) => (
                  <li key={x.topic} className={o.row}>
                    <span className={o.rowName} title={x.topic}>{x.topic}</span>
                    <span className={o.rowNum}>{x.students}</span>
                    <Bar value={x.students} max={topTheme} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {s.topSchools.length > 0 && (
        <section className={t.panel} aria-labelledby="top-schools">
          <h2 id="top-schools">Top schools</h2>
          <p className={t.mute} style={{ marginTop: 0 }}>Typed by students, so one school spelled two ways shows twice.</p>
          <ul className={o.rows}>
            {s.topSchools.map((x) => (
              <li key={x.school} className={o.row}>
                <span className={o.rowName} title={x.school}>{x.school}</span>
                <span className={o.rowNum}>
                  {x.students} <span className={t.mute}>· {x.paid} paid</span>
                </span>
                <Bar value={x.students} max={topSchool} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={t.panel} aria-labelledby="by-event">
        <h2 id="by-event">Events</h2>
        <div className={t.scroll}>
          <table className={`${t.table} ${t.stack}`}>
            <thead>
              <tr>
                <th>Event</th>
                <th className={t.num}>Registered</th>
                <th className={t.num}>Teams</th>
                <th className={t.num}>Desk scans</th>
              </tr>
            </thead>
            <tbody>
              {s.events.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td className={t.num} data-label="Registered">
                    {e.registrations}
                    {e.capacity !== null && <span className={t.mute}> / {e.capacity}</span>}
                  </td>
                  <td className={t.num} data-label="Teams">{e.teams}</td>
                  <td className={t.num} data-label="Desk scans">{e.deskScans}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={t.panel} aria-labelledby="exports">
        <h2 id="exports">Downloads</h2>
        <p className={t.mute}>CSV files open in Excel. They hold students&apos; personal data: keep them off shared drives.</p>
        <div className={t.inline}>
          <a className={t.ghost} href={fileUrl("/admin/export/students.csv")}>Students</a>
          <a className={t.ghost} href={fileUrl("/admin/export/registrations.csv")}>Registrations &amp; teams</a>
          <a className={t.ghost} href={fileUrl("/admin/export/payments.csv")}>Payments</a>
          <a className={t.ghost} href={fileUrl("/admin/export/wall.csv")}>Wall standings</a>
        </div>
      </section>
    </>
  );
}

// ---- referral codes ----

type ReferralRow = { code: string; signups: number; paid: number };

// Codes are given to ambassadors by hand (Google Form, then email), so this is just a count per code.
function Referrals() {
  const { data, error, reload } = useLoad<ReferralRow[]>("/admin/referrals");
  return (
    <section className={t.panel} aria-labelledby="referrals">
      <div className={t.panelHead}>
        <h2 id="referrals">Codes</h2>
        <button type="button" className={t.ghost} onClick={reload}>Refresh</button>
      </div>
      <p className={t.mute}>Most sign-ups first. Students enter a code on their profile step; any code they typed shows here, so check for typos.</p>
      <FormError message={error} />
      {!data ? null : data.length === 0 ? (
        <p className={t.mute}>No student has used a code yet.</p>
      ) : (
        <div className={t.scroll}>
          <table className={`${t.table} ${t.stack}`}>
            <thead>
              <tr>
                <th>Code</th>
                <th className={t.num}>Sign-ups</th>
                <th className={t.num}>Paid</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.code}>
                  <td className={t.mono} data-label="Code">{r.code}</td>
                  <td className={t.num} data-label="Sign-ups">{r.signups}</td>
                  <td className={t.num} data-label="Paid">{r.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---- registration desk ----

function Desk() {
  return (
    <div className={t.dashGrid}>
      <WalkIn />
      <MarkPaid />
    </div>
  );
}

function MarkPaid() {
  const [id, setId] = useState("");
  const [note, setNote] = useState("");
  const act = useAction();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!id.trim()) return act.setError("Type the AVANTRA ID.");
    const ok = await act.run(
      () => api<{ avantraId: string; name: string }>(`/admin/students/${encodeURIComponent(id.trim())}/mark-paid`, { note: note.trim() || undefined }),
      (r) => `${r.name} (${r.avantraId}): ₹299 cash recorded. A receipt email is on its way.`,
    );
    if (ok) {
      setId("");
      setNote("");
    }
  }

  return (
    <section className={t.panel} aria-labelledby="cash">
      <h2 id="cash">Cash fee (signed up online)</h2>
      <form className={t.inline} onSubmit={submit} noValidate>
        <Field name="payId" label="AVANTRA ID" placeholder="AV26-K7M2Q" autoComplete="off" value={id} onChange={(e) => setId(e.target.value)} />
        <Field name="payNote" label="Receipt no. (optional)" autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit" className={t.btn} disabled={act.busy} style={{ marginBottom: 4 }}>Mark ₹299 paid</button>
      </form>
      <FormError message={act.error} />
      {act.note && <p role="status">{act.note}</p>}
    </section>
  );
}

const emptyWalkIn = { name: "", email: "", phone: "", grade: "", section: "", schoolName: "", guardianEmail: "", guardianPhone: "", note: "" };

function WalkIn() {
  const [form, setForm] = useState(emptyWalkIn);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [badge, setBadge] = useState<{ avantraId: string; name: string; qr: string } | null>(null);
  const act = useAction();

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const blank = (v: string) => v.trim() || undefined;
    const parsed = WalkInRequest.safeParse({
      name: form.name,
      email: form.email,
      phone: form.phone,
      grade: form.grade ? Number(form.grade) : undefined,
      section: blank(form.section),
      schoolName: form.schoolName,
      guardianEmail: blank(form.guardianEmail),
      guardianPhone: blank(form.guardianPhone),
      guardianConsent: consent || undefined,
      note: blank(form.note),
    });
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
      if (!form.grade) found.grade = "Pick a class.";
      return setErrors(found);
    }
    const r = await act.run(() => api<{ avantraId: string; qrToken: string; name: string }>("/admin/walk-in", parsed.data));
    if (r) {
      setBadge({ avantraId: r.avantraId, name: r.name, qr: await QRCode.toDataURL(r.qrToken, { width: 320, margin: 2 }) });
      setForm(emptyWalkIn);
      setConsent(false);
    }
  }

  return (
    <section className={t.panel} aria-labelledby="walkin">
      <h2 id="walkin">Walk-in (new student, pays cash)</h2>
      <p className={t.mute}>Creates the account, profile and ₹299 payment in one go. They set a password later with &ldquo;Forgot password&rdquo;.</p>
      {badge && (
        <div className={`${t.result} ${t.ok}`} role="status" style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginBottom: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badge.qr} alt={`Badge QR for ${badge.name}`} width={160} height={160} style={{ borderRadius: 10 }} />
          <div>
            <strong>{badge.name}</strong>
            <span className={t.mono} style={{ fontSize: "1.3rem" }}>{badge.avantraId}</span>
            <p style={{ margin: "6px 0 0" }}>Registered and paid. Write the ID on their badge or print this screen.</p>
          </div>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div className={t.formGrid}>
          <Field name="name" label="Student's name" value={form.name} onChange={set} error={errors.name} />
          <Field name="email" label="Email (theirs or a parent's)" type="email" value={form.email} onChange={set} error={errors.email} />
          <Field name="phone" label="Phone" type="tel" inputMode="tel" value={form.phone} onChange={set} error={errors.phone} />
          <SelectField name="grade" label="Class" value={form.grade} onChange={set} error={errors.grade}>
            <option value="">Pick…</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </SelectField>
          <Field name="section" label="Section (optional)" value={form.section} onChange={set} error={errors.section} />
          <Field name="schoolName" label="School name" value={form.schoolName} onChange={set} error={errors.schoolName} />
          <Field name="guardianEmail" label="Parent's email (optional)" type="email" value={form.guardianEmail} onChange={set} error={errors.guardianEmail} />
          <Field name="guardianPhone" label="Parent's phone (optional)" type="tel" value={form.guardianPhone} onChange={set} error={errors.guardianPhone} />
          <Field name="note" label="Receipt no. (optional)" value={form.note} onChange={set} error={errors.note} />
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "16px 0 4px" }}>
          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErrors((x) => ({ ...x, guardianConsent: "" })); }} style={{ marginTop: 5 }} />
          <span>A parent or guardian agreed to the student taking part and to AVANTRA keeping these details.</span>
        </label>
        {errors.guardianConsent && <span className={account.errorText}>Needed before registering.</span>}
        <FormError message={act.error} />
        <button type="submit" className={t.btn} disabled={act.busy} style={{ marginTop: 12 }}>
          {act.busy ? "Registering…" : "Register and record ₹299 cash"}
        </button>
      </form>
    </section>
  );
}

// ---- staff ----

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: "VOLUNTEER" | "JUDGE";
  expiresAt: string | null;
  disabledAt: string | null;
  assignedEvent: { id: string; name: string } | null;
};

function Staff({ canEdit }: { canEdit: boolean }) {
  const list = useLoad<StaffRow[]>("/admin/staff");
  const [open, setOpen] = useState<string | null>(null);
  const events = useLoad<{ id: string; name: string }[]>("/events");
  const act = useAction();
  const [form, setForm] = useState({ role: "VOLUNTEER", name: "", email: "", password: "", eventId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "" }));
  };

  // 12 readable characters, no look-alikes, so it can be read out loud or written on a card.
  function generate() {
    const abc = "abcdefghjkmnpqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    setForm((f) => ({ ...f, password: Array.from(bytes, (b) => abc[b % abc.length]).join("") }));
    setErrors((x) => ({ ...x, password: "" }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = CreateStaffRequest.safeParse({ ...form, eventId: form.role === "JUDGE" ? form.eventId || undefined : undefined });
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
      return setErrors(found);
    }
    const r = await act.run(
      () => api<StaffRow>("/admin/staff", parsed.data),
      (s) => `${s.name} can log in at /staff/login with ${s.email} and the password ${form.password}. Share it with them now; it isn't shown again.`,
    );
    if (r) {
      setForm({ role: form.role, name: "", email: "", password: "", eventId: form.eventId });
      list.reload();
    }
  }

  const toggle = (s: StaffRow) =>
    act.run(() => api(`/admin/users/${s.id}/${s.disabledAt ? "enable" : "disable"}`, {}), () => `${s.name} ${s.disabledAt ? "enabled" : "disabled and logged out"}.`).then(list.reload);
  const assign = (s: StaffRow, eventId: string) =>
    act.run(() => api(`/admin/staff/${s.id}/assign`, { eventId }), () => `${s.name} now judges ${events.data?.find((e) => e.id === eventId)?.name}.`).then(list.reload);

  if (open) return <Profile id={open} canEdit={canEdit} backLabel="staff" onClose={(changed) => { setOpen(null); if (changed) list.reload(); }} />;
  return (
    <>
      <section className={t.panel} aria-labelledby="new-staff">
        <h2 id="new-staff">Add a volunteer or judge</h2>
        <form onSubmit={create} noValidate>
          <div className={t.formGrid}>
            <SelectField name="role" label="Role" value={form.role} onChange={set}>
              <option value="VOLUNTEER">Volunteer</option>
              <option value="JUDGE">Judge</option>
            </SelectField>
            <Field name="name" label="Name" value={form.name} onChange={set} error={errors.name} />
            <Field name="email" label="Email" type="email" autoComplete="off" value={form.email} onChange={set} error={errors.email} />
            <div>
              <Field name="password" label="Password" autoComplete="new-password" value={form.password} onChange={set} error={errors.password} />
              <button type="button" className={account.link} onClick={generate}>Make one up</button>
            </div>
            {form.role === "JUDGE" && (
              <SelectField name="eventId" label="Judges" value={form.eventId} onChange={set} error={errors.eventId}>
                <option value="">Pick an event…</option>
                {events.data?.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </SelectField>
            )}
          </div>
          <button type="submit" className={t.btn} disabled={act.busy} style={{ marginTop: 14 }}>Create account</button>
        </form>
        <FormError message={act.error} />
        {act.note && <p role="status">{act.note}</p>}
      </section>

      <section className={t.panel} aria-labelledby="staff-list">
        <div className={t.panelHead}>
          <h2 id="staff-list">Volunteers and judges{list.data ? ` (${list.data.length})` : ""}</h2>
          {list.data && list.data.length > 0 && (
            <span className={t.mute}>
              {plural(list.data.filter((s) => s.role === "VOLUNTEER").length, "volunteer")} · {plural(list.data.filter((s) => s.role === "JUDGE").length, "judge")}
            </span>
          )}
        </div>
        <FormError message={list.error} />
        {!list.data ? (
          !list.error && <p className={t.mute} role="status">Loading…</p>
        ) : list.data.length === 0 ? (
          <div className={px.empty}>
            <strong>No staff yet</strong>
            Add volunteers and judges above. Each gets a login for /staff.
          </div>
        ) : (
          <ul className={`${px.roster} ${px.wide}`}>
            {list.data.map((s) => (
              <li key={s.id}>
                <div className={`${px.row} ${s.disabledAt ? px.off : ""}`}>
                  <Avatar name={s.name} tone={toneOf(s.role, !!s.disabledAt)} />
                  <span className={px.who}>
                    <span className={px.name}>{s.name}</span>
                    <span className={px.sub}>{s.email}</span>
                  </span>
                  <span className={px.who}>
                    <span className={t.inline} style={{ gap: 8 }}>
                      <span className={t.status} data-tone={s.disabledAt ? undefined : s.role === "JUDGE" ? "warn" : "ok"}>
                        {s.disabledAt ? "Switched off" : s.role === "JUDGE" ? "Judge" : "Volunteer"}
                      </span>
                      {s.role === "JUDGE" ? (
                        <select className={t.select} value={s.assignedEvent?.id ?? ""} disabled={act.busy} onChange={(e) => assign(s, e.target.value)} aria-label={`Event for ${s.name}`}>
                          {!s.assignedEvent && <option value="">Not assigned</option>}
                          {events.data?.map((e) => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={t.mute}>All events</span>
                      )}
                    </span>
                    {s.expiresAt && <span className={px.sub}>Access until {new Date(s.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                  </span>
                  <span className={px.end}>
                    <button type="button" className={t.ghost} disabled={act.busy} onClick={() => (s.disabledAt || confirm(`Disable ${s.name}? They are logged out at once.`)) && toggle(s)}>
                      {s.disabledAt ? "Enable" : "Disable"}
                    </button>
                    <button type="button" className={t.ghost} onClick={() => setOpen(s.id)}>Open</button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ---- admins (super admin only; every action is checked again in the database) ----

type AdminRow = { id: string; name: string; email: string; superAdmin: boolean; disabledAt: string | null; createdAt: string };

function Admins({ meId }: { meId: string }) {
  const list = useLoad<AdminRow[]>("/admin/admins");
  const [open, setOpen] = useState<string | null>(null);
  const act = useAction();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "" }));
  };

  // Same readable 12 characters as staff passwords, plus a capital and a digit for the Auth password rule.
  function generate() {
    const abc = "abcdefghjkmnpqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    setForm((f) => ({ ...f, password: "A" + Array.from(bytes, (b) => abc[b % abc.length]).join("") + "7" }));
    setErrors((x) => ({ ...x, password: "" }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const parsed = CreateAdminRequest.safeParse(form);
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
      return setErrors(found);
    }
    const r = await act.run(
      () => api<AdminRow>("/admin/admins", parsed.data),
      (a) => `${a.name} can log in at /admin/login with ${a.email} and the password ${form.password}. Share it with them now; it isn't shown again.`,
    );
    if (r) {
      setForm({ name: "", email: "", password: "" });
      list.reload();
    }
  }

  const toggle = (a: AdminRow) =>
    act.run(() => api(`/admin/admins/${a.id}/${a.disabledAt ? "enable" : "disable"}`, {}), () => `${a.name} ${a.disabledAt ? "switched on" : "switched off and logged out"}.`).then(list.reload);
  const remove = (a: AdminRow) =>
    confirm(`Remove ${a.name} as an admin? Their account is deleted and can't be brought back.`) &&
    act.run(() => api(`/admin/admins/${a.id}`, undefined, "DELETE"), () => `${a.name} removed.`).then(list.reload);

  if (open) return <Profile id={open} canEdit backLabel="admins" onClose={(changed) => { setOpen(null); if (changed) list.reload(); }} />;
  return (
    <>
      <section className={t.panel} aria-labelledby="new-admin">
        <h2 id="new-admin">Add an admin</h2>
        <p className={t.mute} style={{ marginTop: 0 }}>Admins see everything here except this tab: students, payments, staff, results and the Wall.</p>
        <form onSubmit={create} noValidate>
          <div className={t.formGrid}>
            <Field name="name" label="Name" value={form.name} onChange={set} error={errors.name} />
            <Field name="email" label="Email" type="email" autoComplete="off" value={form.email} onChange={set} error={errors.email} />
            <div>
              <Field name="password" label="Password" autoComplete="new-password" value={form.password} onChange={set} error={errors.password} />
              <button type="button" className={account.link} onClick={generate}>Make one up</button>
            </div>
          </div>
          <button type="submit" className={t.btn} disabled={act.busy} style={{ marginTop: 14 }}>Create admin</button>
        </form>
        <FormError message={act.error} />
        {act.note && <p role="status">{act.note}</p>}
      </section>

      <section className={t.panel} aria-labelledby="admin-list">
        <h2 id="admin-list">Admins{list.data ? ` (${list.data.length})` : ""}</h2>
        <FormError message={list.error} />
        {!list.data ? (
          !list.error && <p className={t.mute} role="status">Loading…</p>
        ) : (
          <ul className={`${px.roster} ${px.wide}`}>
            {list.data.map((a) => (
              <li key={a.id}>
                <div className={`${px.row} ${a.disabledAt ? px.off : ""}`}>
                  <Avatar name={a.name} tone={a.disabledAt ? "mute" : "red"} />
                  <span className={px.who}>
                    <span className={px.name}>{a.name}{a.id === meId && <span className={t.mute}> (you)</span>}</span>
                    <span className={px.sub}>{a.email}</span>
                  </span>
                  <span className={px.who}>
                    <span>
                      <span className={t.status} data-tone={a.superAdmin ? "warn" : a.disabledAt ? undefined : "ok"}>
                        {a.superAdmin ? "Super admin" : a.disabledAt ? "Switched off" : "Admin"}
                      </span>
                    </span>
                    <span className={px.sub}>Added {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </span>
                  <span className={px.end}>
                    {!a.superAdmin && (
                      <>
                        <button type="button" className={account.link} disabled={act.busy} onClick={() => remove(a)}>Remove</button>
                        <button type="button" className={t.ghost} disabled={act.busy} onClick={() => (a.disabledAt || confirm(`Switch off ${a.name}? They are logged out at once.`)) && toggle(a)}>
                          {a.disabledAt ? "Switch on" : "Switch off"}
                        </button>
                      </>
                    )}
                    <button type="button" className={t.ghost} onClick={() => setOpen(a.id)}>Open</button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
