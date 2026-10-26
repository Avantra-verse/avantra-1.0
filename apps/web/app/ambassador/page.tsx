import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

// Ambassador applications are a Google Form (2026-10). The old in-app ambassador
// module (login, dashboard, referrals) has been removed; this is the only entry point.
const FORM_EMBED =
  "https://docs.google.com/forms/d/e/1FAIpQLSegoK035MJBEmTloNMGjr9vxufw2NL7Ty2kwIO_c96dsfCgBg/viewform?embedded=true";
const FORM_LINK = "https://forms.gle/EwoYSm8iC3fWUvbP7";

export const metadata: Metadata = { title: "Ambassadors" };

// Ember card (DESIGN.md): panel fill, sky border, red outer ring.
const card =
  "rounded-[26px] border-[3px] border-sky bg-panel shadow-[0_0_0_6px_var(--color-ember),0_24px_60px_rgb(0_0_0/0.45)]";

export default function Ambassadors() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader
        title="Become an ambassador"
        lead="Represent AVANTRA 2026 at your school. Fill in the application below."
      />

      <Reveal>
        <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-panel/70 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium text-starlight">
              Facing cookie prompts or loading issues?
            </p>
            <p className="t-body text-sm text-secondary">
              Browsers with strict shield protection (Brave, Helium, Safari) may block embedded Google forms.
            </p>
          </div>
          <a
            href={FORM_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-sky bg-ember px-5 py-2.5 font-display text-base text-starlight shadow-lg transition-all hover:bg-ember-light hover:shadow-[0_0_20px_rgba(159,212,255,0.4)]"
          >
            <span>Open in Google Forms</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <iframe
          src={FORM_EMBED}
          title="AVANTRA 2026 ambassador application form"
          className={`h-[1400px] w-full ${card}`}
          loading="lazy"
        />
        <p className="t-body mt-6 text-secondary">
          Form not loading?{" "}
          <a
            href={FORM_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky underline decoration-sky/40 underline-offset-4 transition-colors hover:text-starlight"
          >
            Open it in a new tab
          </a>
          .
        </p>
      </Reveal>
    </div>
  );
}
