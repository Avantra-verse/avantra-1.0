"use client";

import { siteConfig } from "@/content/site";
import { styles } from "./Account";

const { fee } = siteConfig;

export const feeTotal = (stay: boolean) => fee.exhibition + (stay ? fee.stay : 0);

// Dormitory stay with food for Science Exhibition students; added to the same UPI payment as the fee.
// Two big choice cards (same chips as the theme picker) so both prices are visible side by side.
export function StayOption({ checked, onChange, disabled }: { checked: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  const choice = (on: boolean, title: string, sub: string) => (
    <label className={styles.chipWrapper} style={disabled ? { cursor: "default", opacity: checked === on ? 1 : 0.5 } : undefined}>
      <input type="radio" name="stay" checked={checked === on} disabled={disabled} onChange={() => onChange(on)} className={styles.radioInput} />
      <span className={styles.chipLabel} style={{ padding: "14px 10px", gap: 4 }}>
        <strong style={{ fontSize: "1.5rem", lineHeight: 1.1 }}>₹{feeTotal(on)}</strong>
        <span style={{ fontWeight: 700 }}>{title}</span>
        <span className={styles.chipSubtext}>{sub}</span>
      </span>
    </label>
  );
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.fieldsetLegend}>Do you need a place to stay?</legend>
      <div className={styles.roleGrid}>
        {choice(false, "Exhibition only", `₹${fee.exhibition} fee`)}
        {choice(true, "With dormitory stay", `₹${fee.exhibition} fee + ₹${fee.stay} stay & food`)}
      </div>
      <p className={styles.chipSubtext} style={{ marginTop: 10 }}>
        Dormitory stay: a shared dormitory bed for both days of AVANTRA (19–20 December), with meals included. Paid together in one UPI
        payment. Once you&apos;ve paid, it can&apos;t be changed here.
      </p>
    </fieldset>
  );
}
