"use client";

// The ₹299 exhibition fee by UPI, in three steps: pay the school's QR, send the UTR, see the status. The school
// checks UTRs against its bank statement (admin exports them to Excel and imports the school's answer).
// While a payment is under review the student can correct a mistyped UTR (it replaces the waiting one).
import React, { useState } from "react";
import { UpiPaymentRequest } from "@avantra/shared";
import { siteConfig } from "@/content/site";
import { api, ApiError, type LastPayment } from "@/lib/api";
import t from "@/app/staff/tools.module.css";
import { Field } from "./Account";

const { upi } = siteConfig;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const STEPS = ["Pay", "UTR", "Status"];

export function UpiFee({ paid, last, onSent }: { paid: boolean; last?: LastPayment; onSent: () => Promise<void> }) {
  const reviewing = last?.method === "UPI" && last.status === "CREATED";
  const failed = last?.method === "UPI" && last.status === "FAILED";
  const [step, setStep] = useState(paid || reviewing ? 2 : 0);
  const [utr, setUtr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = UpiPaymentRequest.safeParse({ utr });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    setError("");
    try {
      await api("/payments/upi", parsed.data);
      await onSent();
      setStep(2);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.fields.utr ?? ae.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(upi.id).catch(() => {});
    setCopied(true);
  }

  return (
    <>
      <ol className={t.steps} aria-label="Payment steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} data-done={i < step || undefined}>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 &&
        (!upi.id ? (
          <p className={t.mute}>Paying by UPI opens soon.</p>
        ) : (
          <>
            {failed && (
              <div className={`${t.result} ${t.bad}`} role="alert" style={{ marginTop: 0, marginBottom: 16 }}>
                <strong>We couldn&apos;t confirm your last payment.</strong> The school didn&apos;t find UTR <span className={t.mono}>{last.utr}</span> in its
                bank statement. Check the number in your UPI app and send it again, or pay again if the payment didn&apos;t go through.
              </div>
            )}
            <div className={t.payQr}>
              <img src={upi.qrSrc} alt={`UPI QR code to pay ${upi.payee}`} width={220} height={220} />
              <div>
                <p style={{ margin: "0 0 4px" }}>
                  Pay <strong>₹299</strong> to {upi.payee}
                </p>
                <p className={t.mono} style={{ margin: "0 0 10px", whiteSpace: "normal", wordBreak: "break-all" }}>{upi.id}</p>
                <button type="button" className={t.ghost} onClick={copy}>
                  {copied ? "Copied" : "Copy UPI ID"}
                </button>
                <ol className={t.mute} style={{ margin: "14px 0 0", paddingLeft: 20 }}>
                  <li>Scan the QR with any UPI app, or pay to the UPI ID.</li>
                  <li>Pay exactly ₹299.</li>
                  <li>Then tap Next and enter the UTR from your app.</li>
                </ol>
              </div>
            </div>
            <div className={t.stepNav}>
              <a className={t.ghost} href="/dashboard/events?event=exhibition&step=theme">Back</a>
              <button type="button" className={t.btn} onClick={() => setStep(1)}>Next</button>
            </div>
          </>
        ))}

      {step === 1 && (
        <form onSubmit={send} noValidate>
          <Field
            name="utr"
            label="UPI transaction ID (UTR)"
            inputMode="numeric"
            autoComplete="off"
            placeholder="12-digit number"
            maxLength={16}
            value={utr}
            onChange={(e) => {
              setUtr(e.target.value);
              setError("");
            }}
            error={error}
          />
          <p className={t.mute} style={{ margin: "6px 0 0" }}>
            Open the payment in your UPI app and copy the 12-digit UTR (sometimes called UPI Ref No.).
          </p>
          <div className={t.stepNav}>
            <button type="button" className={t.ghost} onClick={() => setStep(reviewing ? 2 : 0)}>Back</button>
            {utr.trim() && (
              <button type="submit" className={t.btn} disabled={busy}>
                {busy ? "Sending…" : "Done"}
              </button>
            )}
          </div>
        </form>
      )}

      {step === 2 &&
        (paid ? (
          <div className={`${t.result} ${t.ok}`} role="status" style={{ marginTop: 0 }}>
            <strong>Paid.</strong> Your Science Exhibition fee is confirmed. Next, form or join your team.
            <div className={t.stepNav}>
              <span />
              <a className={t.btn} href="/dashboard/teams">Your team</a>
            </div>
          </div>
        ) : reviewing ? (
          <>
            <div className={`${t.result} ${t.warn}`} role="status" style={{ marginTop: 0 }}>
              <strong>Payment under review.</strong> You sent UTR <span className={t.mono}>{last.utr}</span> on {when(last.createdAt)}.
              The school checks payments against its bank statement every few days. We&apos;ll email you once it&apos;s confirmed.
            </div>
            <div className={t.stepNav}>
              <button
                type="button"
                className={t.ghost}
                onClick={() => {
                  setUtr(last.utr ?? "");
                  setStep(1);
                }}
              >
                Change UTR
              </button>
              <a className={t.btn} href="/dashboard">Back to dashboard</a>
            </div>
          </>
        ) : null)}
    </>
  );
}
