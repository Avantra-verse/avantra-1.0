import { siteConfig } from "@/content/site";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

export default function Sponsors() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader
        title="Sponsors and partners"
        lead="Sponsorship is coordinated by ARITHI. It keeps the cost to the school low and brings NIT Rourkela student clubs in to show school students what college-level science looks like up close."
      />

      <Reveal>
        <section>
          {siteConfig.sponsors.length === 0 ? (
            <div className="max-w-[52ch]">
              <p className="t-section text-starlight">
                No sponsors confirmed yet.
              </p>
              <p className="t-body mt-6 text-secondary">
                Partners join in the run-up to December. This page lists them as they sign
                on. To sponsor AVANTRA, write to ARITHI on the contact page.
              </p>
            </div>
          ) : (
            <dl className="flex flex-col">
              {siteConfig.sponsors.map((s) => (
                <div
                  key={s.name}
                  className="flex items-baseline justify-between gap-8 border-t border-white/8 py-7"
                >
                  <dt className="t-item text-starlight">
                    {s.name}
                  </dt>
                  <dd className="text-sm text-muted">{s.tier}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </Reveal>
    </div>
  );
}
