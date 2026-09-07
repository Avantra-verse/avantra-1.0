import { siteConfig } from "@/content/site";
import Reveal from "@/components/Reveal";
import HoverCard from "@/components/HoverCard";
import PageHeader from "@/components/PageHeader";

export default function Venue() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-28">
      <PageHeader
        title="Venue and directions"
        lead="Where AVANTRA takes place, and what exhibitors and winners take home."
      />

      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <Reveal>
            <HoverCard className="panel panel-accent px-8 py-8">
              <p className="text-[11px] uppercase tracking-[0.18em] text-starlight/45">
                Host venue
              </p>
              <p className="mt-4 font-display text-3xl font-semibold text-starlight">
                {siteConfig.venue.name}
              </p>
              <p className="mt-4 leading-relaxed text-starlight/70">
                {siteConfig.venue.address}
              </p>
              <p className="mt-2 leading-relaxed text-starlight/70">
                {siteConfig.venue.directions}
              </p>
            </HoverCard>
          </Reveal>
        </section>

        <section>
          <h2 className="mb-6 font-display text-2xl font-semibold text-starlight">
            Prizes and certificates
          </h2>
          <ul className="flex flex-col gap-4">
            {siteConfig.prizes.map((p, i) => (
              <li key={p.title}>
                <Reveal delay={i * 0.08}>
                  <HoverCard className="panel px-6 py-6">
                    <p className="font-display text-lg font-semibold text-starlight">
                      {p.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-starlight/70">
                      {p.description}
                    </p>
                  </HoverCard>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
