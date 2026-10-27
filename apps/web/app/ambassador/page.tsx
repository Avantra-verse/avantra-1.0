import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";
import FormFrame from "./FormFrame";

// Ambassador applications are a Google Form (2026-10). The old in-app ambassador
// module (login, dashboard) is gone. We email each ambassador a 6-character referral code by hand;
// admin > Referral codes counts the students who used each one.
const FORM_EMBED =
  "https://docs.google.com/forms/d/e/1FAIpQLSegoK035MJBEmTloNMGjr9vxufw2NL7Ty2kwIO_c96dsfCgBg/viewform?embedded=true";
const FORM_LINK = "https://forms.gle/EwoYSm8iC3fWUvbP7";

export const metadata: Metadata = { title: "Ambassadors" };

// Ember card (DESIGN.md): sky border, red outer ring. Cream fill because Google's own text inside the frame is dark.
const card =
  "rounded-[26px] border-[3px] border-sky bg-starlight shadow-[0_0_0_6px_var(--color-ember),0_24px_60px_rgb(0_0_0/0.45)]";

const steps = [
  { title: "Apply", text: "Fill in the form. It takes a few minutes and needs a Google account." },
  { title: "Get your code", text: "Once we have gone through your application, we email you your own 6‑character ambassador code." },
  { title: "Bring your school", text: "Friends enter your code when they register for AVANTRA 2026. Everyone who joins with it counts towards you." },
];

export default function Ambassadors() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader
        title="Become an ambassador"
        lead="Represent AVANTRA 2026 at your school and bring your friends along."
      />

      <div className="grid items-start gap-10 sm:gap-14 xl:grid-cols-[minmax(0,1fr)_720px] xl:gap-16">
        <aside className="xl:sticky xl:top-28">
          <Reveal>
            <h2 className="t-section text-starlight">How it works</h2>
            <ol className="mt-5 flex flex-col">
              {steps.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 border-t border-starlight/15 py-4 first:border-t-0 first:pt-0 sm:py-5">
                  <span className="font-display text-3xl leading-none text-sky tabular-nums" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-lg leading-tight text-starlight">{s.title}</h3>
                    <p className="t-body mt-1.5 max-w-[46ch] text-secondary">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="t-small mt-6 max-w-[46ch] border-t border-starlight/15 pt-5 sm:mt-8 sm:pt-6 text-muted">
              Form asking for cookies or not loading? Some browsers (Brave, Helium, Safari) block Google sign-in inside other sites.{" "}
              <a
                href={FORM_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-starlight underline decoration-sky/50 underline-offset-4 transition-colors hover:text-sky"
              >
                Open it in Google Forms
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 11 11 5M6 5h5v5" />
                </svg>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </p>
          </Reveal>
        </aside>

        <FormFrame src={FORM_EMBED} title="AVANTRA 2026 ambassador application form" className={card} />
      </div>
    </div>
  );
}
