"use client";

import Link from "next/link";
import ConvergingWordmark from "@/components/hero/ConvergingWordmark";
import FilmBackdrop from "@/components/hero/FilmBackdrop";
import Reveal from "@/components/Reveal";
import MaskedReveal from "@/components/MaskedReveal";
import { siteConfig } from "@/content/site";

const facts = [
  { label: "when", value: `${siteConfig.eventWhen}, dates soon` },
  { label: "where", value: "Host school, TBA" },
  { label: "how long", value: "2 days" },
];

export default function Home() {
  return (
    <>
      <section className="relative flex min-h-[calc(100dvh-4rem)] items-end overflow-hidden">
        <FilmBackdrop />
        {/* relative: without it the absolutely positioned backdrop paints over the tagline */}
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 sm:pb-20">
          <ConvergingWordmark text={siteConfig.eventName} />

          {/*
            Rendered plainly, with no entrance animation. An `initial` hidden
            state here flashes on load: the server sends the text visible, then
            hydration hides it before animating it back.
          */}
          <div className="mt-10 max-w-sm">
            <p className="t-lead text-starlight">{siteConfig.tagline}</p>
            <div className="mt-7">
              <Link
                href="/about"
                className="inline-block border-b border-teal pb-1 text-teal transition-colors hover:text-starlight"
              >
                About AVANTRA
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-6xl px-6 pb-28">
        {/* What it is */}
        <Reveal>
          <section className="glass mt-6 grid gap-10 px-7 py-14 sm:px-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
            <p className="t-lead max-w-[60ch] text-starlight/90">{siteConfig.overview}</p>

            <dl className="flex flex-col gap-6 lg:pt-2">
              {facts.map((f) => (
                <div key={f.label} className="flex items-baseline gap-5">
                  <dt className="w-24 shrink-0 text-sm text-muted">{f.label}</dt>
                  <dd className="t-item text-starlight">{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>

        {/* Who runs it. Bare rules on the ground, the quietest section. */}
        <section className="pt-28">
          <MaskedReveal className="mb-12">
            <h2 className="t-section text-starlight">Who runs it</h2>
          </MaskedReveal>

          <dl className="flex flex-col">
            {siteConfig.partners.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.06}>
                <div className="grid gap-2 border-t border-white/10 py-8 transition-colors duration-300 hover:border-teal/40 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-10">
                  <dt className="t-item text-starlight">{p.name}</dt>
                  <dd className="t-body max-w-[58ch] text-secondary">{p.role}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </section>

        {/* Closing. Full-bleed glass with its own pool of colour behind it. */}
        <section className="relative pt-28">
          <Reveal variant="warp">
            <div className="relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 90% at 15% 110%, rgb(49 168 164 / 0.28), transparent 62%), radial-gradient(ellipse 60% 80% at 92% -10%, rgb(200 116 155 / 0.20), transparent 60%)",
                }}
              />
              <div className="glass px-7 py-20 sm:px-14">
                <MaskedReveal>
                  <p className="t-title max-w-[20ch] text-starlight">
                    Bring a project.
                  </p>
                </MaskedReveal>
                <p className="t-body mt-8 max-w-[52ch] text-secondary">
                  Registration opens with the line-up. Questions before then? Write to the team.
                </p>
                <div className="mt-10 flex flex-wrap gap-8">
                  <Link
                    href="/contact"
                    className="inline-block border-b border-teal pb-1 text-teal transition-colors hover:text-starlight"
                  >
                    Get in touch
                  </Link>
                  <Link
                    href="/venue"
                    className="inline-block border-b border-white/30 pb-1 text-starlight transition-colors hover:border-starlight"
                  >
                    Venue and prizes
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </>
  );
}
