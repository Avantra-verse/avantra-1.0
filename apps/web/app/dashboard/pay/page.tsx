"use client";

import { FormError, styles } from "@/components/account/Account";
import { UpiFee } from "@/components/account/UpiFee";
import { feeTotal, StayOption } from "@/components/account/StayOption";
import { api, ApiError } from "@/lib/api";
import { useState } from "react";
import { siteConfig } from "@/content/site";
import t from "../../staff/tools.module.css";
import d from "../dashboard.module.css";
import { Cosmos } from "../cosmos";
import { useDashboard } from "../data";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function PayPage() {
  const { student: s, regs, loaded, failed, reload } = useDashboard();
  const last = s?.payments[0];
  const reviewing = last?.method === "UPI" && last.status === "CREATED";
  const inExhibition = regs.some((r) => r.event.slug === "exhibition");
  const stay = !!s?.accommodation && inExhibition; // same rule as private.fee_paise
  const [stayError, setStayError] = useState("");
  const [saving, setSaving] = useState(false);
  async function setStay(on: boolean) {
    setSaving(true);
    setStayError("");
    try {
      await api("/profile/accommodation", { on }, "PUT");
      await reload();
    } catch (err) {
      setStayError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={`${t.page} ${t.appPage}`}>
        <header className={`${t.pageHead} ${d.band}`}>
          <Cosmos compact />
          <h1>Payment</h1>
          <p>The Science Exhibition fee is ₹{siteConfig.fee.exhibition} per student, plus ₹{siteConfig.fee.stay} if you add dormitory accommodation with food. Paid once by UPI to the school.</p>
        </header>
        <div className={t.dashGrid}>
          <section className={t.panel} aria-label="Science Exhibition fee">
            {failed ? (
              <FormError message={failed} />
            ) : !loaded ? (
              <p className={t.mute} role="status">Loading…</p>
            ) : !s ? (
              <p className={t.mute}>Only students pay the exhibition fee.</p>
            ) : (
              <>
                {inExhibition && (
                  <div style={{ marginBottom: 20 }}>
                    <StayOption checked={stay} onChange={setStay} disabled={saving || !!s.feePaidAt || reviewing} />
                    <FormError message={stayError} />
                  </div>
                )}
                <UpiFee paid={!!s.feePaidAt} last={last} amount={feeTotal(stay)} onSent={reload} />
              </>
            )}
          </section>
          <aside>
            {s && (
              <section className={t.panel} aria-labelledby="summary">
                <div className={t.panelHead}>
                  <h2 id="summary">Summary</h2>
                  <span className={t.status} data-tone={s.feePaidAt ? "ok" : reviewing ? "warn" : undefined}>
                    {s.feePaidAt ? "Paid" : reviewing ? "Under review" : "Not paid"}
                  </span>
                </div>
                <dl className={t.facts}>
                  <div>
                    <dt>Fee</dt>
                    <dd>₹{siteConfig.fee.exhibition}, once</dd>
                  </div>
                  {stay && (
                    <div>
                      <dt>Accommodation</dt>
                      <dd>₹{siteConfig.fee.stay}, dormitory with food, 2 days</dd>
                    </div>
                  )}
                  <div>
                    <dt>Total</dt>
                    <dd>
                      <strong>₹{feeTotal(stay)}</strong>
                    </dd>
                  </div>
                  <div>
                    <dt>Paid to</dt>
                    <dd>SSRVM IEMS</dd>
                  </div>
                  {last?.utr && (
                    <div>
                      <dt>UTR</dt>
                      <dd>
                        <span className={t.mono}>{last.utr}</span>
                        <br />
                        <span className={t.mute}>sent {when(last.createdAt)}</span>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
            <section className={t.panel} aria-labelledby="utr-help">
              <h2 id="utr-help">Finding your UTR</h2>
              <p className={t.mute} style={{ marginTop: 0 }}>
                It&apos;s the 12-digit number in the payment&apos;s details in your UPI app:
              </p>
              <ul className={t.mute} style={{ margin: 0, paddingLeft: "1.2em", listStyle: "disc", display: "grid", gap: 4 }}>
                <li>Google Pay: UPI transaction ID</li>
                <li>PhonePe: UTR</li>
                <li>Paytm: UPI Ref. No.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
