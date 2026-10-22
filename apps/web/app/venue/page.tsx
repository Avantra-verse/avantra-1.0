import type { Metadata } from "next";
import { siteConfig } from "@/content/site";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

// Ember card (DESIGN.md): panel fill, sky border, red outer ring.
const card =
  "rounded-[26px] border-[3px] border-sky bg-panel p-7 shadow-[0_0_0_6px_var(--color-ember),0_24px_60px_rgb(0_0_0/0.45)] sm:p-9";

export const metadata: Metadata = { title: "Venue" };

export default function Venue() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader
        title="Venue and directions"
        lead="AVANTRA 2026 is hosted by SSRVM IEMS. Where it takes place, and what exhibitors and winners take home."
      />

      <Reveal>
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <section className={card} aria-labelledby="venue-name">
            <h2 id="venue-name" className="t-title text-starlight">
              {siteConfig.venue.name}
            </h2>
            <p className="mt-3 font-[family-name:var(--font-display)] text-lg text-sky">December 2026, dates soon</p>
            <p className="t-body mt-6 max-w-[46ch] text-secondary">{siteConfig.venue.address}</p>
            <p className="t-body mt-2 max-w-[46ch] text-secondary">{siteConfig.venue.directions}</p>
            <a
              href={siteConfig.venue.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex min-h-12 items-center rounded-full border-[3px] border-sky bg-ember px-7 font-[family-name:var(--font-display)] text-lg text-white transition-[background-color,box-shadow] duration-200 hover:bg-ember-hot hover:shadow-[0_6px_24px_rgb(159_212_255/0.35)]"
            >
              Open in Google Maps
            </a>
          </section>

          <section className={card} aria-labelledby="prizes">
            <h2 id="prizes" className="t-section text-starlight">
              Prizes and certificates
            </h2>
            <dl className="mt-4 flex flex-col">
              {siteConfig.prizes.map((p) => (
                <div key={p.title} className="border-t border-starlight/15 py-5 first:border-t-0">
                  <dt className="font-[family-name:var(--font-display)] text-lg text-sky">{p.title}</dt>
                  <dd className="t-body mt-1 max-w-[52ch] text-secondary">{p.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </Reveal>
    </div>
  );
}
