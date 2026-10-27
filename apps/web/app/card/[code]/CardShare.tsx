"use client";

import { useState } from "react";
import { REGISTER_PILL } from "@/components/Nav";
import { shareOrDownload } from "@/lib/share";

export function CardShare({ code, src }: { code: string; src: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const filename = `avantra-ambassador-${code}.png`;
  // Goes with the card into WhatsApp, Facebook… Instagram drops text shared with a picture, hence Copy caption.
  const text = [
    "🎟️ I'm officially an AVANTRA 2026 School Ambassador!",
    "AVANTRA is the Science & Technology Fest at SSRVM IEMS, Rourkela, on 19–20 December 2026. Come build, explore and compete with me!",
    `Register with my code ${code} 👉 https://avantra.arithi.in/registration?ref=${code}`,
    "@avantra.verse #AVANTRA2026",
  ].join("\n\n");

  async function copy() {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
  }

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
      <h1 className="t-title mb-8 text-starlight">Your Ambassador Pass</h1>
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
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 items-center rounded-full border-2 border-sky px-5 font-semibold text-starlight transition-colors hover:bg-sky/10"
        >
          {copied ? "Caption copied" : "Copy caption"}
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
      <ol className="t-small mt-8 flex max-w-[38ch] list-decimal flex-col gap-2 pl-5 text-left text-secondary">
        <li>Tap <strong className="text-starlight">Share my card</strong> and pick WhatsApp, Instagram, Facebook or any app.</li>
        <li>Posting on Instagram? Tap <strong className="text-starlight">Copy caption</strong> first, then paste it in, since Instagram drops the text.</li>
        <li>Tag <strong className="text-starlight">@avantra.verse</strong> in your story so we can reshare it!</li>
      </ol>
    </div>
  );
}
