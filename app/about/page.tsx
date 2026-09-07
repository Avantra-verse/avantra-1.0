import { siteConfig } from "@/content/site";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

export default function About() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader title="About AVANTRA" lead={siteConfig.overview} />

      <Reveal>
        <section className="pb-24">
          <h2 className="mb-10 font-display text-2xl font-semibold text-starlight">
            Who runs it
          </h2>
          <dl className="flex flex-col">
            {siteConfig.partners.map((p) => (
              <div
                key={p.name}
                className="grid gap-2 border-t border-white/8 py-7 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-10"
              >
                <dt className="font-display text-xl font-semibold text-starlight">
                  {p.name}
                </dt>
                <dd className="max-w-[58ch] leading-relaxed text-starlight/70">{p.role}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Reveal>

      <Reveal>
        <section className="pb-24">
          <h2 className="mb-10 font-display text-2xl font-semibold text-starlight">
            How the three days run
          </h2>
          <ol className="grid gap-px overflow-hidden border border-white/8 sm:grid-cols-3">
            {siteConfig.days.map((d) => (
              <li key={d.title} className="bg-white/[0.02] px-7 py-8">
                <p className="font-display text-lg font-semibold text-starlight">{d.title}</p>
                <p className="mt-3 leading-relaxed text-starlight/70">{d.description}</p>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <Reveal>
        <section>
          <h2 className="mb-8 font-display text-2xl font-semibold text-starlight">Rules</h2>
          <ul className="flex flex-col gap-4">
            {siteConfig.rules.map((r) => (
              <li key={r} className="max-w-[62ch] leading-relaxed text-starlight/75">
                {r}
              </li>
            ))}
          </ul>
        </section>
      </Reveal>
    </div>
  );
}
