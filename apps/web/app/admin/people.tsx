"use client";

// People (super admin only; every call is checked again in the database): find any account, see all of it,
// fix its details or delete it. Deleting needs the account's email typed in, so a stray click can't do it.
import React, { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Field, FormError, SelectField } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { rupees, useAction, useLoad } from "./ui";

type Role = "STUDENT" | "VOLUNTEER" | "JUDGE" | "ADMIN";
type PersonRow = { id: string; name: string; email: string; phone: string | null; role: Role; superAdmin: boolean; disabledAt: string | null; avantraId: string | null; schoolName: string | null; feePaid: boolean };
type Person = {
  user: { id: string; name: string; email: string; phone: string | null; role: Role; superAdmin: boolean; disabledAt: string | null; expiresAt: string | null; createdAt: string; assignedEvent: string | null };
  student: { avantraId: string; schoolName: string; grade: number; section: string | null; referralCode: string | null; guardianEmail: string | null; guardianPhone: string | null; guardianConsentAt: string; feePaidAt: string | null } | null;
  payments: { method: string; status: string; amountPaise: number; utr: string | null; note: string | null; createdAt: string }[];
  registrations: { event: string; team: string | null; isLeader: boolean | null; certificateCode: string | null }[];
  checkIns: number;
  scansDone: number;
  scoresGiven: number;
};

const ROLES: Record<Role, string> = { STUDENT: "Student", VOLUNTEER: "Volunteer", JUDGE: "Judge", ADMIN: "Admin" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export function People() {
  const list = useLoad<PersonRow[]>("/admin/people");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter(
    (p) => (!role || p.role === role) && (!needle || [p.name, p.email, p.phone, p.avantraId, p.schoolName].some((v) => v?.toLowerCase().includes(needle))),
  );

  if (open) return <Profile id={open} onClose={(changed) => { setOpen(null); if (changed) list.reload(); }} />;
  return (
    <section className={t.panel} aria-labelledby="people">
      <div className={t.panelHead}>
        <h2 id="people">Everyone{list.data ? ` (${rows.length})` : ""}</h2>
        <button type="button" className={t.ghost} onClick={list.reload}>Refresh</button>
      </div>
      <div className={t.inline}>
        <Field name="peopleSearch" label="Search name, email, phone, ID or school" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField name="peopleRole" label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All</option>
          {Object.entries(ROLES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </SelectField>
      </div>
      <FormError message={list.error} />
      {list.data && (
        <div className={t.scroll}>
          <table className={`${t.table} ${t.stack}`}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>ID / school</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    <div className={t.mute}>{p.email}</div>
                  </td>
                  <td data-label="Role">
                    {p.superAdmin ? "Super admin" : ROLES[p.role]}
                    {p.disabledAt && <div className={t.mute}>switched off</div>}
                  </td>
                  <td data-label="ID / school">
                    {p.avantraId && <span className={t.mono}>{p.avantraId}</span>}
                    {p.role === "STUDENT" && <div className={t.mute}>{p.schoolName ?? "profile not finished"}{p.avantraId && (p.feePaid ? " · paid" : " · not paid")}</div>}
                  </td>
                  <td className={t.num}>
                    <button type="button" className={t.ghost} onClick={() => setOpen(p.id)}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 200 && <p className={t.mute}>Showing the newest 200. Search to find someone else.</p>}
        </div>
      )}
    </section>
  );
}

function Profile({ id, onClose }: { id: string; onClose: (changed: boolean) => void }) {
  const { data: p, error, reload } = useLoad<Person>(`/admin/people/${id}`);
  const act = useAction();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState("");
  const [changed, setChanged] = useState(false);

  if (!p) return error ? <FormError message={error} /> : <p className={t.mute}>Loading…</p>;
  const { user: u, student: s } = p;
  const back = <button type="button" className={t.ghost} onClick={() => onClose(changed)}>← Back to everyone</button>;

  const edit = () =>
    setForm({
      name: u.name, phone: u.phone ?? "",
      ...(s && { schoolName: s.schoolName, grade: String(s.grade), section: s.section ?? "", referralCode: s.referralCode ?? "", guardianEmail: s.guardianEmail ?? "", guardianPhone: s.guardianPhone ?? "" }),
    });
  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "" }));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !confirm(`Save these changes to ${u.name}'s account?`)) return;
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
          <h2 id="person">{u.name}</h2>
          {!form && <button type="button" className={t.ghost} onClick={edit}>Edit details</button>}
        </div>
        {act.note && <p role="status">{act.note}</p>}
        {form ? (
          <form onSubmit={save} noValidate>
            <div className={t.formGrid}>
              <Field name="name" label="Name" value={form.name} onChange={set} error={errors.name} />
              <Field name="phone" label={s ? "Phone" : "Phone (optional)"} type="tel" value={form.phone} onChange={set} error={errors.phone} />
              {s && (
                <>
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
          <dl className={t.facts}>
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
                <div><dt>Fee</dt><dd>{s.feePaidAt ? `Paid ${when(s.feePaidAt)}` : "Not paid"}</dd></div>
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
            <ul>
              {p.registrations.map((r, i) => (
                <li key={i}>
                  {r.event}
                  {r.team && <span className={t.mute}> · team {r.team}{r.isLeader && " (leader)"}</span>}
                  {r.certificateCode && <span className={t.mute}> · certificate {r.certificateCode}</span>}
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
                      <td data-label="Status">{x.status}</td>
                      <td className={t.num} data-label="Amount">{rupees(x.amountPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!u.superAdmin && (
        <section className={`${t.panel} ${t.result} ${t.bad}`} aria-labelledby="danger">
          <h2 id="danger">Delete this account</h2>
          <p>
            Deletes {u.name}&apos;s login{s && ", profile, event registrations, team places, payments, Wall points and certificates"} for good. It can&apos;t be undone.
            {u.role !== "STUDENT" && " Staff who scanned badges or scored teams can't be deleted: switch them off in Staff or Admins instead."}
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
