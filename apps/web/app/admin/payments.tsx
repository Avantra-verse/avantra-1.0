"use client";

// UPI payments: students pay the school's QR and send the UTR. Download the ones waiting as Excel, the school
// marks each Paid / Not paid from its bank statement, upload the file back. Decided rows never come back;
// unchecked ones (and new tries after a failure) are in the next download.
import React, { useState } from "react";
import { api } from "@/lib/api";
import { FormError, styles as account } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { fileUrl, useAction, useLoad } from "./ui";

type Waiting = { id: string; avantraId: string; name: string; utr: string; createdAt: string };
type ImportResult = { paid: number; failed: number; already: number; unchecked: number; problems: string[] };

const base64 = (file: File) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => fail(r.error);
    r.readAsDataURL(file);
  });

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function UpiPayments() {
  const { data, error, reload } = useLoad<Waiting[]>("/admin/payments/upi");
  const act = useAction();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Only rows still waiting count, so a refresh that drops a decided row can't leave it ticked.
  const chosen = data?.filter((p) => picked.has(p.id)) ?? [];
  const tick = (id: string) => setPicked((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });

  async function decide(list: Waiting[], status: "PAID" | "FAILED") {
    if (!list.length) return;
    const who = list.length === 1 ? `${list[0].name}'s payment (UTR ${list[0].utr})` : `these ${list.length} payments`;
    const ask = status === "PAID"
      ? `Mark ${who} as paid? Only do this after finding ${list.length === 1 ? "it" : "each one"} in the bank statement. They get a "fee confirmed" email.`
      : `Mark ${who} as not paid? They get a "try again" email.`;
    if (!confirm(ask)) return;
    setResult(null);
    const r = await act.run(
      () => api<{ avantraId: string; result: string }[]>("/admin/payments/upi/decide", { decisions: list.map((p) => ({ avantraId: p.avantraId, utr: p.utr, status })) }),
      (rows) => {
        const n = (k: string) => rows.filter((d) => d.result === k).length;
        const double = rows.filter((d) => d.result === "double").map((d) => list.find((p) => p.avantraId === d.avantraId)?.name ?? d.avantraId);
        return [
          n("paid") && `${n("paid")} confirmed paid.`,
          n("failed") && `${n("failed")} marked not paid.`,
          double.length && `Already paid before, refund one of the two payments: ${double.join(", ")}.`,
          (n("already") || n("missing")) && `${n("already") + n("missing")} were already decided.`,
        ].filter(Boolean).join(" ");
      },
    );
    if (r) {
      setPicked(new Set());
      reload();
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same file can be picked again
    if (!file) return;
    setResult(null);
    const r = await act.run(async () => api<ImportResult>("/admin/payments/upi/import", { file: await base64(file) }));
    if (r) {
      setResult(r);
      reload();
    }
  }

  return (
    <>
      <section className={t.panel} aria-labelledby="upi-check">
        <div className={t.head}>
          <h2 id="upi-check">Payments for the school to check</h2>
          <button type="button" className={t.ghost} onClick={reload}>Refresh</button>
        </div>
        <ol className={t.mute}>
          <li>Download the Excel file and send it to the school.</li>
          <li>The school sets <strong>Verified</strong> to Paid or Not paid for each payment it has checked, and leaves the rest empty.</li>
          <li>Upload the file they send back. Paid students are confirmed and emailed; Not paid students are told to try again.</li>
        </ol>
        <div className={t.inline}>
          <a className={t.btn} href={fileUrl("/admin/payments/upi.xlsx")}>
            Download Excel{data ? ` (${data.length} waiting)` : ""}
          </a>
          <label className={t.ghost}>
            {act.busy ? "Uploading…" : "Upload the school's file"}
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={upload} disabled={act.busy} hidden />
          </label>
        </div>
        <FormError message={act.error} />
        {result && (
          <div className={`${t.result} ${result.problems.length ? t.warn : t.ok}`} role="status">
            {result.paid} confirmed paid, {result.failed} marked not paid, {result.unchecked} not checked yet (they stay in the next download)
            {result.already > 0 && `, ${result.already} already done in an earlier upload`}.
            {result.problems.length > 0 && (
              <>
                <br />
                These rows were skipped. Fix them in the file and upload it again:
                <ul style={{ margin: "6px 0 0" }}>
                  {result.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      <section className={t.panel} aria-labelledby="upi-waiting">
        <h2 id="upi-waiting">Waiting</h2>
        <p className={t.mute}>Found payments in the bank statement yourself? Tick them and mark them here instead of waiting for the Excel file.</p>
        <FormError message={error} />
        {act.note && <p role="status">{act.note}</p>}
        {!data ? null : data.length === 0 ? (
          <p className={t.mute}>No payments waiting to be checked.</p>
        ) : (
          <>
          <div className={t.inline} style={{ marginBottom: 12 }}>
            <button type="button" className={t.btn} disabled={act.busy || !chosen.length} onClick={() => decide(chosen, "PAID")}>Mark {chosen.length || ""} paid</button>
            <button type="button" className={t.ghost} disabled={act.busy || !chosen.length} onClick={() => decide(chosen, "FAILED")}>Mark {chosen.length || ""} not paid</button>
            {chosen.length > 0 && <button type="button" className={account.link} onClick={() => setPicked(new Set())}>Clear</button>}
          </div>
          <div className={t.scroll}>
            <table className={`${t.table} ${t.stack}`}>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" aria-label="Tick all" checked={chosen.length === data.length} onChange={(e) => setPicked(new Set(e.target.checked ? data.map((p) => p.id) : []))} />
                  </th>
                  <th>Student</th>
                  <th>UTR</th>
                  <th>Sent</th>
                  <th>Checked by hand</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input type="checkbox" aria-label={`Tick ${p.name}`} checked={picked.has(p.id)} onChange={() => tick(p.id)} />
                    </td>
                    <td>
                      {p.name}
                      <div className={`${t.mute} ${t.mono}`}>{p.avantraId}</div>
                    </td>
                    <td className={t.mono} data-label="UTR">{p.utr}</td>
                    <td data-label="Sent">{when(p.createdAt)}</td>
                    <td data-label="Checked by hand">
                      <div className={t.inline}>
                        <button type="button" className={t.btn} disabled={act.busy} onClick={() => decide([p], "PAID")}>Paid</button>
                        <button type="button" className={t.ghost} disabled={act.busy} onClick={() => decide([p], "FAILED")}>Not paid</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </>
  );
}
