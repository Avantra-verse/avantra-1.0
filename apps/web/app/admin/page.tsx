"use client";

// Admin dashboard: numbers and exports, school approvals, the registration desk, staff accounts,
// event results and the Engagement Wall. Laptop-first, still usable on a phone at the desk.
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { CreateStaffRequest, WalkInRequest } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { Field, FormError, OpensSoon, SelectField, styles as account } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { fileUrl, rupees, Tile, useAction, useLoad } from "./ui";
import { Events } from "./events";
import { Wall } from "./wall";

const TABS = { overview: "Overview", schools: "Schools", desk: "Desk", staff: "Staff", events: "Results", wall: "Wall" } as const;
type Tab = keyof typeof TABS;

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!apiReady) return;
    getMe()
      .then((m) => (m?.role === "ADMIN" ? setMe(m) : router.replace("/admin/login")))
      .catch((e: ApiError) => setFailed(e.message));
    const saved = window.location.hash.slice(1); // #wall etc. survives a refresh
    if (saved in TABS) setTab(saved as Tab);
  }, [router]);

  function pick(k: Tab) {
    setTab(k);
    window.history.replaceState(null, "", `#${k}`);
  }

  async function logout() {
    await api("/auth/logout", {}).catch(() => {});
    router.replace("/admin/login");
  }

  return (
    <div className={account.registrationPage}>
      <div className={account.starfieldLayer} aria-hidden="true" />
      <div className={t.page}>
        {!apiReady ? (
          <div className={t.panel}>
            <OpensSoon what="Admin" />
          </div>
        ) : !me ? (
          failed ? <FormError message={failed} /> : <p className={t.mute} role="status">Loading…</p>
        ) : (
          <>
            <div className={t.head}>
              <h1 className={account.heading} style={{ fontSize: "2rem", margin: 0 }}>Admin</h1>
              <span className={t.mute}>
                {me.name} · <button type="button" className={account.link} onClick={logout}>Log out</button>
              </span>
            </div>
            <div className={t.tabs} role="tablist">
              {(Object.keys(TABS) as Tab[]).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} className={t.tab} onClick={() => pick(k)}>
                  {TABS[k]}
                </button>
              ))}
            </div>
            {tab === "overview" && <Overview />}
            {tab === "schools" && <Schools />}
            {tab === "desk" && <Desk />}
            {tab === "staff" && <Staff />}
            {tab === "events" && <Events />}
            {tab === "wall" && <Wall />}
          </>
        )}
      </div>
    </div>
  );
}

// ---- overview ----

type Stats = {
  students: { total: number; paid: number; unpaid: number; unlinkedSchool: number };
  schools: Partial<Record<"PENDING" | "APPROVED" | "REJECTED", number>>;
  fees: { onlinePaise: number; onlineCount: number; cashPaise: number; cashCount: number };
  gate: { checkedInToday: number };
  events: { id: string; name: string; capacity: number | null; registrations: number; teams: number; deskScans: number }[];
};

function Overview() {
  const { data: s, error, reload } = useLoad<Stats>("/admin/stats");
  if (!s) return error ? <FormError message={error} /> : <p className={t.mute}>Loading…</p>;
  return (
    <>
      <section className={t.panel} aria-labelledby="numbers">
        <div className={t.head}>
          <h2 id="numbers">Today</h2>
          <button type="button" className={t.ghost} onClick={reload}>Refresh</button>
        </div>
        <div className={t.tiles}>
          <Tile value={s.students.total} label="students" />
          <Tile value={s.students.paid} label="fee paid" />
          <Tile value={s.gate.checkedInToday} label="through the gate today" />
          <Tile value={s.schools.PENDING ?? 0} label="schools waiting for approval" />
          <Tile value={s.students.unlinkedSchool} label="students with an unlisted school" />
          <Tile value={rupees(s.fees.onlinePaise)} label={`online (${s.fees.onlineCount})`} />
          <Tile value={rupees(s.fees.cashPaise)} label={`cash at desk (${s.fees.cashCount})`} />
        </div>
      </section>
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

// ---- schools ----

type School = {
  id: string;
  name: string;
  city: string;
  address: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  coordinator: { name: string; email: string; phone: string | null };
  _count: { students: number };
};
type Unlinked = { userId: string; avantraId: string; otherSchoolName: string | null; grade: number; feePaidAt: string | null; user: { name: string; email: string } };

function Schools() {
  const [status, setStatus] = useState("PENDING");
  const schools = useLoad<School[]>(`/admin/schools${status ? `?status=${status}` : ""}`);
  const approved = useLoad<School[]>("/admin/schools?status=APPROVED");
  const unlinked = useLoad<Unlinked[]>("/admin/students/unlinked");
  const act = useAction();
  const [pick, setPick] = useState<Record<string, string>>({});

  const decide = (s: School, d: "approve" | "reject") =>
    act.run(
      () => api(`/admin/schools/${s.id}/${d}`, {}),
      () => `${s.name} ${d === "approve" ? "approved" : "rejected"}. The coordinator has been emailed.`,
    ).then(() => {
      schools.reload();
      approved.reload();
    });

  const link = (u: Unlinked) =>
    act.run(
      () => api(`/admin/students/${u.userId}/link`, { schoolId: pick[u.userId] }),
      () => `${u.user.name} linked.`,
    ).then(() => unlinked.reload());

  return (
    <>
      <section className={t.panel} aria-labelledby="schools">
        <div className={t.head}>
          <h2 id="schools">Schools</h2>
          <select className={t.select} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Show">
            <option value="PENDING">Waiting for approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="">All</option>
          </select>
        </div>
        <FormError message={act.error || schools.error} />
        {act.note && <p className={t.mute} role="status">{act.note}</p>}
        {!schools.data ? null : schools.data.length === 0 ? (
          <p className={t.mute}>Nothing here.</p>
        ) : (
          <div className={t.scroll}>
            <table className={`${t.table} ${t.stack}`}>
              <thead>
                <tr>
                  <th>School</th>
                  <th>Coordinator</th>
                  <th className={t.num}>Students</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {schools.data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      <div className={t.mute}>{s.city} · {s.address}</div>
                    </td>
                    <td>
                      {s.coordinator.name}
                      <div className={t.mute}>{s.coordinator.email}{s.coordinator.phone && ` · ${s.coordinator.phone}`}</div>
                    </td>
                    <td className={t.num} data-label="Students">{s._count.students}</td>
                    <td className={t.num}>
                      {s.status === "PENDING" ? (
                        <div className={t.inline} style={{ justifyContent: "flex-end" }}>
                          <button type="button" className={t.btn} disabled={act.busy} onClick={() => decide(s, "approve")}>Approve</button>
                          <button type="button" className={t.ghost} disabled={act.busy} onClick={() => confirm(`Reject ${s.name}?`) && decide(s, "reject")}>Reject</button>
                        </div>
                      ) : (
                        <span className={`${t.pill} ${s.status === "APPROVED" ? t.on : t.off}`}>{s.status.toLowerCase()}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={t.panel} aria-labelledby="unlinked">
        <h2 id="unlinked">Students who typed their school</h2>
        <p className={t.mute}>Link them to an approved school so they count for it on the Wall and appear on the coordinator&apos;s list.</p>
        <FormError message={unlinked.error} />
        {!unlinked.data ? null : unlinked.data.length === 0 ? (
          <p className={t.mute}>None.</p>
        ) : (
          <div className={t.scroll}>
            <table className={`${t.table} ${t.stack}`}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Typed school</th>
                  <th>Link to</th>
                </tr>
              </thead>
              <tbody>
                {unlinked.data.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      {u.user.name} <span className={t.mute}>· Class {u.grade}</span>
                      <div className={`${t.mute} ${t.mono}`}>{u.avantraId}</div>
                    </td>
                    <td data-label="Typed school">{u.otherSchoolName}</td>
                    <td>
                      <div className={t.inline}>
                        <select className={t.select} value={pick[u.userId] ?? ""} onChange={(e) => setPick((p) => ({ ...p, [u.userId]: e.target.value }))} aria-label={`School for ${u.user.name}`}>
                          <option value="">Pick a school…</option>
                          {approved.data?.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}, {s.city}</option>
                          ))}
                        </select>
                        <button type="button" className={t.btn} disabled={act.busy || !pick[u.userId]} onClick={() => link(u)}>Link</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// ---- registration desk ----

function Desk() {
  return (
    <>
      <MarkPaid />
      <WalkIn />
    </>
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
      (r) => `${r.name} (${r.avantraId}): ₹199 cash recorded. A receipt email is on its way.`,
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
        <button type="submit" className={t.btn} disabled={act.busy} style={{ marginBottom: 4 }}>Mark ₹199 paid</button>
      </form>
      <FormError message={act.error} />
      {act.note && <p role="status">{act.note}</p>}
    </section>
  );
}

const emptyWalkIn = { name: "", email: "", phone: "", grade: "", section: "", schoolId: "", otherSchoolName: "", guardianEmail: "", guardianPhone: "", note: "" };

function WalkIn() {
  const schools = useLoad<{ id: string; name: string; city: string }[]>("/schools");
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
    const other = form.schoolId === "__others";
    const blank = (v: string) => v.trim() || undefined;
    const parsed = WalkInRequest.safeParse({
      name: form.name,
      email: form.email,
      phone: form.phone,
      grade: form.grade ? Number(form.grade) : undefined,
      section: blank(form.section),
      schoolId: other ? undefined : blank(form.schoolId),
      otherSchoolName: other ? blank(form.otherSchoolName) : undefined,
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
      <p className={t.mute}>Creates the account, profile and ₹199 payment in one go. They set a password later with &ldquo;Forgot password&rdquo;.</p>
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
          <SelectField name="schoolId" label="School" value={form.schoolId} onChange={set} error={errors.schoolId}>
            <option value="">Pick…</option>
            {schools.data?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}, {s.city}</option>
            ))}
            <option value="__others">Others (type it)</option>
          </SelectField>
          {form.schoolId === "__others" && (
            <Field name="otherSchoolName" label="School name" value={form.otherSchoolName} onChange={set} error={errors.otherSchoolName} />
          )}
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
          {act.busy ? "Registering…" : "Register and record ₹199 cash"}
        </button>
      </form>
    </section>
  );
}

// ---- staff ----

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: "VOLUNTEER" | "JUDGE";
  expiresAt: string | null;
  disabledAt: string | null;
  assignedEvent: { id: string; name: string } | null;
};

function Staff() {
  const list = useLoad<StaffRow[]>("/admin/staff");
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
        <h2 id="staff-list">Volunteers and judges</h2>
        <FormError message={list.error} />
        {!list.data ? null : list.data.length === 0 ? (
          <p className={t.mute}>No one yet.</p>
        ) : (
          <div className={t.scroll}>
            <table className={`${t.table} ${t.stack}`}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Event</th>
                  <th className={t.hideSmall}>Access until</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      <div className={t.mute}>{s.email}</div>
                    </td>
                    <td>{s.role === "JUDGE" ? "Judge" : "Volunteer"}</td>
                    <td>
                      {s.role === "JUDGE" ? (
                        <select className={t.select} value={s.assignedEvent?.id ?? ""} disabled={act.busy} onChange={(e) => assign(s, e.target.value)} aria-label={`Event for ${s.name}`}>
                          {!s.assignedEvent && <option value="">Not assigned</option>}
                          {events.data?.map((e) => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={t.mute}>All</span>
                      )}
                    </td>
                    <td className={`${t.mute} ${t.hideSmall}`}>{s.expiresAt && new Date(s.expiresAt).toLocaleDateString("en-IN")}</td>
                    <td className={t.num}>
                      <button type="button" className={t.ghost} disabled={act.busy} onClick={() => (s.disabledAt || confirm(`Disable ${s.name}? They are logged out at once.`)) && toggle(s)}>
                        {s.disabledAt ? "Enable" : "Disable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
