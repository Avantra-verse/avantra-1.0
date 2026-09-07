import { siteConfig } from "@/content/site";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

export default function Venue() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader
        title="Venue and directions"
        lead="Where AVANTRA takes place, and what exhibitors and winners take home."
      />

      <Reveal>
        <div className="grid gap-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <section>
            <p className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-[-0.02em] text-starlight">
              {siteConfig.venue.name}
            </p>
            <p className="mt-8 max-w-[46ch] leading-relaxed text-starlight/70">
              {siteConfig.venue.address}
            </p>
            <p className="mt-3 max-w-[46ch] leading-relaxed text-starlight/70">
              {siteConfig.venue.directions}
            </p>
          </section>

          <section>
            <h2 className="mb-8 font-display text-2xl font-semibold text-starlight">
              Prizes and certificates
            </h2>
            <dl className="flex flex-col">
              {siteConfig.prizes.map((p) => (
                <div key={p.title} className="border-t border-white/8 py-6">
                  <dt className="font-display text-lg font-semibold text-starlight">
                    {p.title}
                  </dt>
                  <dd className="mt-2 max-w-[52ch] leading-relaxed text-starlight/70">
                    {p.description}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </Reveal>
    </div>
  );
}
