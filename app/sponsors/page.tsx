import { siteConfig } from "@/content/site";
import PageHeader from "@/components/PageHeader";
import MaskedReveal from "@/components/MaskedReveal";
import Reveal from "@/components/Reveal";

export default function Sponsors() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader
        title="Sponsors and partners"
        lead="Sponsorship is coordinated by ARITHI. It keeps the cost to the school low and brings NIT Rourkela student clubs in to show school students what college-level science looks like up close."
      />

      <section className="relative">
        {siteConfig.sponsors.length === 0 ? (
          <Reveal>
            <div className="relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 90% at 20% 110%, rgb(49 168 164 / 0.24), transparent 62%), radial-gradient(ellipse 60% 80% at 90% -10%, rgb(200 116 155 / 0.18), transparent 60%)",
                }}
              />
              <div className="glass px-7 py-20 sm:px-14">
                <MaskedReveal>
                  <p className="t-title max-w-[16ch] text-starlight">
                    No sponsors confirmed yet.
                  </p>
                </MaskedReveal>
                <p className="t-body mt-8 max-w-[52ch] text-secondary">
                  Partners join in the run-up to December. This page lists them as
                  they sign on. To sponsor AVANTRA, write to ARITHI on the contact
                  page.
                </p>
              </div>
            </div>
          </Reveal>
        ) : (
          <dl className="flex flex-col">
            {siteConfig.sponsors.map((s, i) => (
              <Reveal key={s.name} delay={i * 0.06}>
                <div className="flex items-baseline justify-between gap-8 border-t border-white/10 py-7 transition-colors duration-300 hover:border-teal/40">
                  <dt className="t-item text-starlight">{s.name}</dt>
                  <dd className="text-sm text-muted">{s.tier}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
