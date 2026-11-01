"use client";

// Students tab, plus the profile page that Students, Staff and Admins open: every admin can see all of an account;
// only the super admin can fix its details, switch the fee between paid and not paid, or delete it (checked again
// in the database). Deleting needs the account's email typed in, so a stray click can't do it.
import React, { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Field, FormError, SelectField } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import x from "./people.module.css";
import { rupees, useAction, useLoad } from "./ui";

type Role = "STUDENT" | "VOLUNTEER" | "JUDGE" | "ADMIN";
type PersonRow = { id: string; name: string; email: string; phone: string | null; role: Role; superAdmin: boolean; disabledAt: string | null; createdAt: string; avantraId: string | null; schoolName: string | null; feePaid: boolean };
type Person = {
  user: { id: string; name: string; email: string; phone: string | null; role: Role; superAdmin: boolean; disabledAt: string | null; expiresAt: string | null; createdAt: string; assignedEvent: string | null };
  student: { avantraId: string; schoolName: string; grade: number; section: string | null; referralCode: string | null; guardianEmail: string | null; guardianPhone: string | null; guardianConsentAt: string; feePaidAt: string | null } | null;
  payments: { method: string; status: string; amountPaise: number; utr: string | null; note: string | null; createdAt: string }[];
  registrations: { event: string; team: string | null; isLeader: boolean | null; certificateCode: string | null }[];
  checkIns: number;
  scansDone: number;
  scoresGiven: number;
};

const PAY_STATUS: Record<string, string> = { CREATED: "Waiting", PAID: "Paid", FAILED: "Not paid", REFUNDED: "Refunded" };
const ROLES: Record<Role, string> = { STUDENT: "Student", VOLUNTEER: "Volunteer", JUDGE: "Judge", ADMIN: "Admin" };
// Each Status filter is a test on a row.
const STATUS: Record<string, [string, (p: PersonRow) => boolean]> = {
  paid: ["Fee paid", (p) => p.role === "STUDENT" && p.feePaid],
  unpaid: ["Fee not paid", (p) => p.role === "STUDENT" && !!p.avantraId && !p.feePaid],
  noProfile: ["Profile not finished", (p) => p.role === "STUDENT" && !p.avantraId],
  off: ["Switched off", (p) => !!p.disabledAt],
};
export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
// "12 min ago", "5 h ago", then a short date.
export function joined(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return min < 1 ? "just now" : `${min} min ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function Students({ canEdit }: { canEdit: boolean }) {
  const list = useLoad<PersonRow[]>("/admin/people");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [school, setSchool] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const students = (list.data ?? []).filter((p) => p.role === "STUDENT");
  const schools = [...new Set(students.map((p) => p.schoolName).filter((v): v is string => !!v))].sort();
  // Counts on the chips follow the school and search filters, so they always match what a tap shows.
  const matching = students.filter((p) => (!school || p.schoolName === school) && (!needle || [p.name, p.email, p.phone, p.avantraId, p.schoolName].some((v) => v?.toLowerCase().includes(needle))));
  const rows = matching.filter((p) => !status || STATUS[status][1](p));
  const chips: [string, string, number][] = [["", "All", matching.length], ...Object.entries(STATUS).map(([k, [label, test]]): [string, string, number] => [k, label, matching.filter(test).length])];

  if (open) return <Profile id={open} canEdit={canEdit} backLabel="students" onClose={(changed) => { setOpen(null); if (changed) list.reload(); }} />;
  return (
    <section className={t.panel} aria-labelledby="students">
      <div className={t.panelHead}>
        <h2 id="students">Students{list.data ? ` (${students.length})` : ""}</h2>
        <button type="button" className={t.ghost} onClick={list.reload}>Refresh</button>
      </div>
      <div className={x.filters}>
        <Field name="peopleSearch" label="Search name, email, phone, AVANTRA ID or school" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField name="peopleSchool" label="School" value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">All schools</option>
          {schools.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </SelectField>
      </div>
      <div className={x.chips} role="group" aria-label="Show">
        {chips.map(([k, label, n]) => (
          <button key={k || "all"} type="button" className={x.chip} aria-pressed={status === k} onClick={() => setStatus(k)}>
            {label} <span className={x.count}>{n}</span>
          </button>
        ))}
      </div>
      <FormError message={list.error} />
      {!list.data ? (
        !list.error && <p className={t.mute} role="status">Loading students…</p>
      ) : rows.length === 0 ? (
        <div className={x.empty}>
          <strong>{students.length ? "No one matches" : "No students yet"}</strong>
          {students.length ? "Try another search, school or filter." : "Sign-ups show up here, newest first."}
        </div>
      ) : (
        <>
          <ul className={x.roster}>
            {rows.slice(0, 200).map((p) => (
              <li key={p.id}>
                <button type="button" className={`${x.row} ${p.disabledAt ? x.off : ""}`} onClick={() => setOpen(p.id)}>
                  <Avatar name={p.name} tone={p.disabledAt ? "mute" : "sky"} />
                  <span className={x.who}>
                    <span className={x.name}>{p.name}</span>
                    <span className={x.sub}>{p.email}</span>
                  </span>
                  <span className={x.who}>
                    {p.avantraId ? <span className={`${t.mono} ${x.name}`}>{p.avantraId}</span> : <span className={x.name}>No ID yet</span>}
                    <span className={x.sub}>{p.schoolName ?? "Profile not finished"}</span>
                  </span>
                  <span className={x.end}>
                    <FeeTag p={p} />
                    <span className={x.when} title={`Joined ${when(p.createdAt)}`}>{joined(p.createdAt)}</span>
                    <Chevron />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {rows.length > 200 && <p className={t.mute}>Showing the newest 200 of {rows.length}. Search to find someone else.</p>}
        </>
      )}
    </section>
  );
}

function FeeTag({ p }: { p: PersonRow }) {
  if (p.disabledAt) return <span className={t.status}>Switched off</span>;
  if (!p.avantraId) return <span className={t.status}>Unfinished</span>;
  return p.feePaid ? <span className={t.status} data-tone="ok">Paid</span> : <span className={t.status} data-tone="warn">Not paid</span>;
}

// Initials in a ring; the colour says what kind of account it is.
export function Avatar({ name, tone, big }: { name: string; tone: "sky" | "green" | "gold" | "red" | "mute"; big?: boolean }) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return <span className={`${x.avatar} ${big ? x.big : ""}`} data-tone={tone} aria-hidden="true">{letters || "?"}</span>;
}

export const toneOf = (role: Role, off: boolean) => (off ? "mute" : role === "ADMIN" ? "red" : role === "JUDGE" ? "gold" : role === "VOLUNTEER" ? "green" : "sky");

export function Chevron() {
  return (
    <svg className={x.chev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function Profile({ id, canEdit, backLabel, onClose }: { id: string; canEdit: boolean; backLabel: string; onClose: (changed: boolean) => void }) {
  const { data: p, error, reload } = useLoad<Person>(`/admin/people/${id}`);
  const act = useAction();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState("");
  const [changed, setChanged] = useState(false);

  if (!p) return error ? <FormError message={error} /> : <p className={t.mute}>Loading…</p>;
  const { user: u, student: s } = p;
  // Fee switch: super admin only, and only for UPI payers who sent a UTR (never cash at the desk). Checked again in the DB.
  const feeSwitch = canEdit && !!s && p.payments.some((x) => x.method === "UPI" && x.utr) && !p.payments.some((x) => x.method === "OFFLINE" && x.status === "PAID");
  const back = <button type="button" className={t.ghost} onClick={() => onClose(changed)}>← Back to {backLabel}</button>;

  const edit = () =>
    setForm({
      name: u.name, phone: u.phone ?? "",
      ...(feeSwitch && { feePaid: s!.feePaidAt ? "yes" : "no" }),
      ...(s && { schoolName: s.schoolName, grade: String(s.grade), section: s.section ?? "", referralCode: s.referralCode ?? "", guardianEmail: s.guardianEmail ?? "", guardianPhone: s.guardianPhone ?? "" }),
    });
  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "" }));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const feeNote = feeSwitch && form?.feePaid !== (s!.feePaidAt ? "yes" : "no")
      ? form?.feePaid === "yes" ? "\n\nThe fee will be marked PAID (their UPI payment is confirmed) and they get the fee email." : "\n\nThe fee will be marked NOT PAID: their UPI payment is marked failed, their badge locks again and they get the \"try again\" email."
      : "";
    if (!form || !confirm(`Save these changes to ${u.name}'s account?${feeNote}`)) return;
    const r = await act.run(async () => {
      try {
        return await api(`/admin/people/${id}`, form, "PATCH").then(() => true);
      } catch (err) {
        setErrors((err as ApiError).fields);
        throw err;
      }
    }, () => "Saved.");
    if (r) {
      setForm(null);
      setChanged(true);
      reload();
    }
  }

  async function setFee(paid: boolean) {
    const msg = paid
      ? `Mark ${u.name}'s fee as PAID? Their UPI payment is confirmed, their badge unlocks and they get the fee email.`
      : `Mark ${u.name}'s fee as NOT PAID? Their UPI payment is marked failed, their badge locks again and they get the "try again" email.`;
    if (!confirm(msg)) return;
    const r = await act.run(() => api(`/admin/people/${id}/fee`, { paid }).then(() => true), () => (paid ? "Fee marked paid." : "Fee marked not paid."));
    if (r) {
      setChanged(true);
      reload();
    }
  }

  async function remove() {
    if (typed.trim().toLowerCase() !== u.email.toLowerCase()) return;
    if (!confirm(`Last check: delete ${u.name} (${u.email}) for good? This can't be undone.`)) return;
    const r = await act.run(() => api(`/admin/people/${id}`, undefined, "DELETE").then(() => true));
    if (r) onClose(true);
  }

  return (
    <>
      <div className={t.panelHead}>{back}</div>
      <section className={t.panel} aria-labelledby="person">
        <div className={t.panelHead}>
          <div className={x.person}>
            <Avatar name={u.name} tone={toneOf(u.role, !!u.disabledAt)} big />
            <div>
              <h2 id="person">{u.name}</h2>
              <div className={x.tags}>
                <span className={t.status} data-tone={u.superAdmin || u.role === "ADMIN" ? "warn" : undefined}>{u.superAdmin ? "Super admin" : ROLES[u.role]}</span>
                {s && (s.feePaidAt ? <span className={t.status} data-tone="ok">Fee paid</span> : <span className={t.status} data-tone="warn">Fee not paid</span>)}
                {u.disabledAt && <span className={t.status}>Switched off</span>}
                {s && <span className={`${t.status} ${t.mono}`}>{s.avantraId}</span>}
              </div>
            </div>
          </div>
          {canEdit && !form && <button type="button" className={t.ghost} onClick={edit}>Edit details</button>}
        </div>
        {act.note && <p role="status">{act.note}</p>}
        {form ? (
          <form onSubmit={save} noValidate>
            <div className={t.formGrid}>
              <Field name="name" label="Name" value={form.name} onChange={set} error={errors.name} />
              <Field name="phone" label={s ? "Phone" : "Phone (optional)"} type="tel" value={form.phone} onChange={set} error={errors.phone} />
              {s && (
                <>
                  {feeSwitch && (
                    <SelectField name="feePaid" label="Fee (UPI with UTR)" value={form.feePaid} onChange={set} error={errors.feePaid}>
                      <option value="yes">Paid</option>
                      <option value="no">Not paid</option>
                    </SelectField>
                  )}
                  <Field name="schoolName" label="School" value={form.schoolName} onChange={set} error={errors.schoolName} />
                  <SelectField name="grade" label="Class" value={form.grade} onChange={set} error={errors.grade}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </SelectField>
                  <Field name="section" label="Section (optional)" value={form.section} onChange={set} error={errors.section} />
                  <Field name="referralCode" label="Ambassador code (optional)" value={form.referralCode} onChange={set} error={errors.referralCode} />
                  <Field name="guardianEmail" label="Parent's email (optional)" type="email" value={form.guardianEmail} onChange={set} error={errors.guardianEmail} />
                  <Field name="guardianPhone" label="Parent's phone (optional)" type="tel" value={form.guardianPhone} onChange={set} error={errors.guardianPhone} />
                </>
              )}
            </div>
            <p className={t.mute}>Email is the login, so it can&apos;t be changed here.</p>
            <FormError message={act.error} />
            <div className={t.inline}>
              <button type="submit" className={t.btn} disabled={act.busy}>{act.busy ? "Saving…" : "Save changes"}</button>
              <button type="button" className={t.ghost} disabled={act.busy} onClick={() => { setForm(null); setErrors({}); act.setError(""); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <dl className={x.facts}>
            <div><dt>Email</dt><dd>{u.email}</dd></div>
            <div><dt>Phone</dt><dd>{u.phone ?? "—"}</dd></div>
            <div><dt>Role</dt><dd>{u.superAdmin ? "Super admin" : ROLES[u.role]}{u.disabledAt && ` (switched off ${when(u.disabledAt)})`}</dd></div>
            <div><dt>Joined</dt><dd>{when(u.createdAt)}</dd></div>
            {u.expiresAt && <div><dt>Access until</dt><dd>{when(u.expiresAt)}</dd></div>}
            {u.role === "JUDGE" && <div><dt>Judges</dt><dd>{u.assignedEvent ?? "Not assigned"}</dd></div>}
            {s && (
              <>
                <div><dt>AVANTRA ID</dt><dd className={t.mono}>{s.avantraId}</dd></div>
                <div><dt>School</dt><dd>{s.schoolName}</dd></div>
                <div><dt>Class</dt><dd>{s.grade}{s.section && ` ${s.section}`}</dd></div>
                <div><dt>Ambassador code</dt><dd className={t.mono}>{s.referralCode ?? "—"}</dd></div>
                <div><dt>Parent</dt><dd>{[s.guardianEmail, s.guardianPhone].filter(Boolean).join(" · ") || "—"}</dd></div>
                <div>
                  <dt>Fee</dt>
                  <dd>
                    {s.feePaidAt ? `Paid ${when(s.feePaidAt)}` : "Not paid"}
                    {feeSwitch && (
                      <>
                        {" "}
                        <button type="button" className={t.ghost} disabled={act.busy} onClick={() => setFee(!s.feePaidAt)}>
                          {s.feePaidAt ? "Mark as not paid" : "Mark as paid"}
                        </button>
                      </>
                    )}
                  </dd>
                </div>
                <div><dt>Days through the gate</dt><dd>{p.checkIns}</dd></div>
              </>
            )}
            {u.role === "VOLUNTEER" && <div><dt>Badges scanned</dt><dd>{p.scansDone}</dd></div>}
            {u.role === "JUDGE" && <div><dt>Scores given</dt><dd>{p.scoresGiven}</dd></div>}
          </dl>
        )}
      </section>

      {s && (
        <section className={t.panel} aria-labelledby="person-events">
          <h2 id="person-events">Events and payments</h2>
          {p.registrations.length === 0 ? <p className={t.mute}>No events yet.</p> : (
            <ul className={x.events}>
              {p.registrations.map((r, i) => (
                <li key={i}>
                  <strong>{r.event}</strong>
                  <span className={t.mute}>
                    {r.team ? `Team ${r.team}${r.isLeader ? " (leader)" : ""}` : "No team"}
                    {r.certificateCode && ` · certificate ${r.certificateCode}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {p.payments.length === 0 ? <p className={t.mute}>No payments.</p> : (
            <div className={t.scroll}>
              <table className={`${t.table} ${t.stack}`}>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>How</th>
                    <th>Status</th>
                    <th className={t.num}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {p.payments.map((x, i) => (
                    <tr key={i}>
                      <td>{when(x.createdAt)}</td>
                      <td data-label="How">{x.method}{x.utr && <div className={`${t.mute} ${t.mono}`}>UTR {x.utr}</div>}{x.note && <div className={t.mute}>{x.note}</div>}</td>
                      <td data-label="Status"><span className={t.status} data-tone={x.status === "PAID" ? "ok" : x.status === "CREATED" ? "warn" : undefined}>{PAY_STATUS[x.status] ?? x.status}</span></td>
                      <td className={t.num} data-label="Amount">{rupees(x.amountPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {canEdit && !u.superAdmin && (
        <section className={`${t.panel} ${t.result} ${t.bad}`} aria-labelledby="danger">
          <h2 id="danger">Delete this account</h2>
          <p>
            Deletes {u.name}&apos;s login{s && ", profile, event registrations, team places, payments, Wall points and certificates"} for good. It can&apos;t be undone.
            {u.role !== "STUDENT" && " Staff who scanned badges or scored teams can't be deleted: switch them off instead."}
          </p>
          <Field name="confirmDelete" label={`Type ${u.email} to confirm`} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <FormError message={form ? "" : act.error} />
          <button type="button" className={t.btn} disabled={act.busy || typed.trim().toLowerCase() !== u.email.toLowerCase()} onClick={remove}>
            {act.busy ? "Deleting…" : "Delete for good"}
          </button>
        </section>
      )}
    </>
  );
}
