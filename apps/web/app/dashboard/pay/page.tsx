"use client";

import { FormError, styles } from "@/components/account/Account";
import { UpiFee } from "@/components/account/UpiFee";
import t from "../../staff/tools.module.css";
import { useDashboard } from "../data";

export default function PayPage() {
  const { student: s, loaded, failed, reload } = useDashboard();
  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={`${t.page} ${t.narrow} ${t.appPage}`}>
        <section className={t.panel} aria-labelledby="pay">
          <h2 id="pay">Science Exhibition fee</h2>
          {failed ? (
            <FormError message={failed} />
          ) : !loaded ? (
            <p className={t.mute} role="status">Loading…</p>
          ) : !s ? (
            <p className={t.mute}>Only students pay the exhibition fee.</p>
          ) : (
            <UpiFee paid={!!s.feePaidAt} last={s.payments[0]} onSent={reload} />
          )}
        </section>
      </div>
    </div>
  );
}
