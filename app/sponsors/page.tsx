import { siteConfig } from "@/content/site";
import Reveal from "@/components/Reveal";
import HoverCard from "@/components/HoverCard";
import PageHeader from "@/components/PageHeader";

export default function Sponsors() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-28">
      <PageHeader
        title="Sponsors and partners"
        lead="AVANTRA is made possible through sponsorship coordinated by ARITHI, keeping the cost to the school minimal while bringing NIT Rourkela student clubs in to showcase real college-level science to students."
      />

      <section>
        {siteConfig.sponsors.length === 0 ? (
          <Reveal>
            <div className="panel panel-accent px-8 py-16 text-center">
              <p className="font-display text-2xl text-starlight">
                Sponsor list to be announced
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-starlight/60">
                Partners join in the run-up to the event. This page updates as they are
                confirmed.
              </p>
            </div>
          </Reveal>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-3">
            {siteConfig.sponsors.map((s, i) => (
              <li key={s.name}>
                <Reveal delay={i * 0.06}>
                  <HoverCard className="panel h-full px-6 py-8 text-center">
                    <p className="font-display text-lg font-semibold text-starlight">
                      {s.name}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-starlight/50">
                      {s.tier}
                    </p>
                  </HoverCard>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
