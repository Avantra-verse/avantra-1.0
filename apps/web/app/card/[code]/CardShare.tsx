"use client";

import { useState } from "react";
import { REGISTER_PILL } from "@/components/Nav";
import { shareOrDownload } from "@/lib/share";

export function CardShare({ code, src }: { code: string; src: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filename = `avantra-ambassador-${code}.png`;
  const text = `I'm an AVANTRA 2026 School Ambassador! Register with my code ${code}: https://avantra.arithi.in/registration?ref=${code} @avantra.verse #AVANTRA2026`;

  async function share() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      await shareOrDownload(await res.blob(), filename, text);
    } catch {
      setError("Couldn't share the card. Try Download, then share the saved picture.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-28 pb-24 text-center">
      <img
        src={src}
        alt={`Your AVANTRA 2026 ambassador card with code ${code}`}
        width={1080}
        height={1920}
        className="h-auto w-full max-w-[340px] rounded-[22px] border-[3px] border-sky shadow-[0_0_0_6px_var(--color-ember),0_24px_60px_rgb(0_0_0/0.45)]"
      />
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className={REGISTER_PILL} onClick={share} disabled={busy}>
          {busy ? "Opening…" : "Share my card"}
        </button>
        <a
          href={src}
          download={filename}
          className="inline-flex min-h-11 items-center rounded-full border-2 border-sky px-5 font-semibold text-starlight transition-colors hover:bg-sky/10"
        >
          Download
        </a>
      </div>
      {error && (
        <p className="mt-4 text-sm text-ember-hot" role="alert">
          {error}
        </p>
      )}
      <p className="t-small mt-6 max-w-[36ch] text-secondary">
        Pick Instagram, WhatsApp or any app from the share menu. On Instagram, post it to your story and tag @avantra.verse.
      </p>
    </div>
  );
}
