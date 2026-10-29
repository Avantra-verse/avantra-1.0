"use client";

// The ₹299 exhibition fee by UPI: pay the school's QR in any UPI app, send the UTR, and wait while the school
// checks it against its bank statement (admin exports it to Excel and imports the school's answer).
import React, { useState } from "react";
import { UpiPaymentRequest } from "@avantra/shared";
import { siteConfig } from "@/content/site";
import { api, ApiError, type LastPayment } from "@/lib/api";
import t from "@/app/staff/tools.module.css";
import { Field } from "./Account";

const { upi } = siteConfig;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function UpiFee({ last, onSent }: { last?: LastPayment; onSent: () => Promise<void> }) {
  const [utr, setUtr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (last?.method === "UPI" && last.status === "CREATED") {
    return (
      <div className={`${t.result} ${t.warn}`} role="status">
        <strong>Payment under review.</strong> You sent UTR <span className={t.mono}>{last.utr}</span> on {when(last.createdAt)}.
        The school checks payments against its bank statement every few days. We&apos;ll email you once it&apos;s confirmed.
      </div>
    );
  }
  if (!upi.id) return <p className={t.mute}>Paying by UPI opens soon.</p>;
  const failed = last?.method === "UPI" && last.status === "FAILED";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = UpiPaymentRequest.safeParse({ utr });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    setError("");
    try {
      await api("/payments/upi", parsed.data);
      await onSent();
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
      {failed && (
        <div className={`${t.result} ${t.bad}`} role="alert">
          <strong>We couldn&apos;t confirm your last payment.</strong> The school didn&apos;t find UTR <span className={t.mono}>{last.utr}</span> in its
          bank statement. Check the number in your UPI app and send it again, or pay again if the payment didn&apos;t go through.
        </div>
      )}
      <div className={t.inline} style={{ alignItems: "flex-start", gap: 24, marginTop: 16 }}>
        <img src={upi.qrSrc} alt={`UPI QR code to pay ${upi.payee}`} width={200} height={200} style={{ borderRadius: 12, background: "#fff", maxWidth: "100%", height: "auto" }} />
        <div>
          <p style={{ margin: "0 0 4px" }}>
            Pay <strong>₹299</strong> to {upi.payee}
          </p>
          <p className={t.mono} style={{ margin: "0 0 12px", wordBreak: "break-all" }}>
            {upi.id}{" "}
            <button type="button" className={t.ghost} onClick={copy}>
              {copied ? "Copied" : "Copy UPI ID"}
            </button>
          </p>
          <ol className={t.mute} style={{ margin: 0, paddingLeft: 20 }}>
            <li>Scan the QR with any UPI app, or pay to the UPI ID.</li>
            <li>Pay exactly ₹299.</li>
            <li>Open the payment details in your app and copy the 12-digit UTR (sometimes called UPI Ref No.).</li>
          </ol>
        </div>
      </div>
      <form className={t.inline} onSubmit={send} noValidate style={{ marginTop: 16 }}>
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
        <button type="submit" className={t.btn} disabled={busy}>
          {busy ? "Sending…" : "I've paid, send UTR"}
        </button>
      </form>
    </>
  );
}
