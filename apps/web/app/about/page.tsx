import { siteConfig } from "@/content/site";
import PageHeader from "@/components/PageHeader";
import MaskedReveal from "@/components/MaskedReveal";
import Reveal from "@/components/Reveal";

export default function About() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader title="About AVANTRA" lead={siteConfig.overview} />

      {/* Partners: bare rules on the ground, the quiet section. */}
      <section className="pb-28">
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

      {/* Rules: glass sheet, so the section reads differently again. */}
      <section>
        <MaskedReveal className="mb-12">
          <h2 className="t-section text-starlight">Rules</h2>
        </MaskedReveal>

        <Reveal>
          <div className="glass px-7 py-10 sm:px-12">
            <ul className="flex flex-col gap-4">
              {siteConfig.rules.map((r) => (
                <li key={r} className="t-body max-w-[62ch] text-secondary">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
