import { siteConfig } from "@/content/site";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

export default function About() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader title="About AVANTRA" lead={siteConfig.overview} />

      <section className="pb-24">
        <h2 className="t-section mb-10 text-starlight">Who runs it</h2>
        <dl className="flex flex-col">
          {siteConfig.partners.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.07}>
              <div className="grid gap-2 border-t border-white/8 py-7 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-10">
                <dt className="t-item text-starlight">{p.name}</dt>
                <dd className="t-body max-w-[58ch] text-secondary">{p.role}</dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </section>

      <section className="pb-24">
        <h2 className="t-section mb-10 text-starlight">How the three days run</h2>
        <ol className="grid gap-px overflow-hidden border border-white/8 sm:grid-cols-3">
          {siteConfig.days.map((d, i) => (
            <li key={d.title} className="bg-white/[0.02] px-7 py-8">
              <Reveal delay={i * 0.09}>
                <p className="t-item text-starlight">{d.title}</p>
                <p className="t-body mt-3 text-secondary">{d.description}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="t-section mb-8 text-starlight">Rules</h2>
        <ul className="flex flex-col gap-4">
          {siteConfig.rules.map((r) => (
            <li key={r} className="t-body max-w-[62ch] text-secondary">
              {r}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
