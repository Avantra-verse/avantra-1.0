import { siteConfig } from "@/content/site";
import PageHeader from "@/components/PageHeader";
import MaskedReveal from "@/components/MaskedReveal";
import Reveal from "@/components/Reveal";

export default function Venue() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader
        title="Venue and directions"
        lead="Where AVANTRA takes place, and what exhibitors and winners take home."
      />

      <div className="grid gap-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        {/* The venue itself, stated at display scale on its own pool of light. */}
        <section className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 80% 70% at 10% 20%, rgb(49 168 164 / 0.22), transparent 65%)",
            }}
          />
          <MaskedReveal>
            <p className="t-title text-starlight">{siteConfig.venue.name}</p>
          </MaskedReveal>
          <p className="t-body mt-8 max-w-[46ch] text-secondary">
            {siteConfig.venue.address}
          </p>
          <p className="t-body mt-3 max-w-[46ch] text-secondary">
            {siteConfig.venue.directions}
          </p>
        </section>

        {/* Prizes on a glass sheet, against the open treatment beside it. */}
        <section>
          <MaskedReveal className="mb-8">
            <h2 className="t-section text-starlight">Prizes and certificates</h2>
          </MaskedReveal>

          <Reveal>
            <dl className="glass divide-y divide-white/8 px-7 sm:px-9">
              {siteConfig.prizes.map((p) => (
                <div key={p.title} className="py-7">
                  <dt className="t-item text-starlight">{p.title}</dt>
                  <dd className="t-body mt-2 max-w-[52ch] text-secondary">
                    {p.description}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
