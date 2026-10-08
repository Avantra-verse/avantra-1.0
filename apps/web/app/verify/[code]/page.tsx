"use client";

// Public check for a certificate. The URL is printed on every certificate (and in its QR).
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, API_URL, ApiError, apiReady } from "@/lib/api";
import { AccountShell, FormError, OpensSoon, styles } from "@/components/account/Account";

type Certificate = { code: string; name: string; school: string | null; event: string; rank: number | null; issuedAt: string };
const PLACE = ["", "First place", "Second place", "Third place"];

export default function VerifyPage() {
  const { code } = useParams<{ code: string }>();
  const [cert, setCert] = useState<Certificate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!apiReady) return;
    api<Certificate>(`/certificates/${encodeURIComponent(code)}`)
      .then(setCert)
      .catch((e: ApiError) => setError(e.status === 404 ? "No certificate with this ID. Check the code on the certificate." : e.message));
  }, [code]);

  return (
    <AccountShell tagline="Certificate check">
      {!apiReady ? (
        <OpensSoon what="Certificate checks" />
      ) : error ? (
        <>
          <h1 className={styles.heading}>Not found</h1>
          <p className={styles.subtext}>Certificate ID {code.toUpperCase()}</p>
          <FormError message={error} />
        </>
      ) : !cert ? (
        <p className={styles.subtext} role="status">Checking…</p>
      ) : (
        <div className={styles.successBox} role="status">
          <h1 className={styles.successHeading}>Valid certificate ✓</h1>
          <p className={styles.successText}>
            <strong>{cert.name}</strong>
            {cert.school && `, ${cert.school},`} took part in <strong>{cert.event}</strong> at AVANTRA 2026
            {cert.rank ? ` and won ${PLACE[cert.rank].toLowerCase()}` : ""}.
          </p>
          <p className={styles.subtext}>
            Certificate ID {cert.code} · issued {new Date(cert.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <a className={styles.link} href={`${API_URL}/certificates/${cert.code}/pdf`}>
            Open the certificate (PDF)
          </a>
        </div>
      )}
    </AccountShell>
  );
}
