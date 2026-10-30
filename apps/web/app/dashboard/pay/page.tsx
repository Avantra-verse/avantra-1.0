"use client";

import { FormError, styles } from "@/components/account/Account";
import { UpiFee } from "@/components/account/UpiFee";
import t from "../../staff/tools.module.css";
import { useDashboard } from "../data";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function PayPage() {
  const { student: s, loaded, failed, reload } = useDashboard();
  const last = s?.payments[0];
  const reviewing = last?.method === "UPI" && last.status === "CREATED";
  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={`${t.page} ${t.appPage}`}>
        <header className={t.pageHead}>
          <h1>Payment</h1>
          <p>The Science Exhibition fee is ₹299 per student, paid once by UPI to the school.</p>
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
              <UpiFee paid={!!s.feePaidAt} last={last} onSent={reload} />
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
                    <dd>₹299, once</dd>
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
