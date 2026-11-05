"use client";

import { siteConfig } from "@/content/site";
import { styles } from "./Account";

const { fee } = siteConfig;

// Dormitory stay with food for Science Exhibition students; added to the same UPI payment as the fee.
export function StayOption({ checked, onChange, disabled }: { checked: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.fieldsetLegend}>Accommodation (optional)</legend>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: disabled ? "default" : "pointer" }}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18, flex: "none" }} />
        <span>
          <strong>Dormitory stay with food, 2 days: +₹{fee.stay}</strong>
          <br />
          <span style={{ opacity: 0.8 }}>
            A shared dormitory bed for both days of AVANTRA (19–20 December), with meals included. Paid together with the ₹{fee.exhibition} fee in one
            UPI payment. Once you&apos;ve paid, it can&apos;t be changed here.
          </span>
        </span>
      </label>
    </fieldset>
  );
}

export const feeTotal = (stay: boolean) => fee.exhibition + (stay ? fee.stay : 0);
