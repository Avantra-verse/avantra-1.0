"use client";

// UPI payments: students pay the school's QR and send the UTR. Download the ones waiting as Excel, the school
// marks each Paid / Not paid from its bank statement, upload the file back. Decided rows never come back;
// unchecked ones (and new tries after a failure) are in the next download.
import React, { useState } from "react";
import { api } from "@/lib/api";
import { FormError } from "@/components/account/Account";
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
        <FormError message={error} />
        {!data ? null : data.length === 0 ? (
          <p className={t.mute}>No payments waiting to be checked.</p>
        ) : (
          <div className={t.scroll}>
            <table className={`${t.table} ${t.stack}`}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>UTR</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      <div className={`${t.mute} ${t.mono}`}>{p.avantraId}</div>
                    </td>
                    <td className={t.mono} data-label="UTR">{p.utr}</td>
                    <td data-label="Sent">{when(p.createdAt)}</td>
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
