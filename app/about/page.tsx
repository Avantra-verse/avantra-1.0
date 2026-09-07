import { siteConfig } from "@/content/site";
import Reveal from "@/components/Reveal";
import HoverCard from "@/components/HoverCard";
import PageHeader from "@/components/PageHeader";

export default function About() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-28">
      <PageHeader title="About AVANTRA" lead={siteConfig.overview} />

      <section className="pb-20">
        <h2 className="mb-6 font-display text-2xl font-semibold text-starlight">
          Who is behind it
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {siteConfig.partners.map((p, i) => (
            <li key={p.name} className={i === 0 ? "sm:col-span-3" : ""}>
              <Reveal delay={i * 0.06}>
                <HoverCard
                  className={`panel h-full px-6 py-6 ${i === 0 ? "panel-accent" : ""}`}
                >
                  <p
                    className={
                      i === 0
                        ? "font-display text-2xl font-semibold text-starlight"
                        : "font-display text-lg font-semibold text-starlight"
                    }
                  >
                    {p.name}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-starlight/70">{p.role}</p>
                </HoverCard>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section className="pb-20">
        <h2 className="mb-8 font-display text-2xl font-semibold text-starlight">
          How the three days run
        </h2>
        <ol className="flex flex-col gap-8 sm:flex-row sm:gap-6">
          {siteConfig.days.map((d, i) => (
            <li key={d.title} className="flex flex-1 gap-4 sm:flex-col">
              <Reveal delay={i * 0.1}>
                <div className="flex items-center gap-3 sm:mb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rift-purple to-rift-cyan font-display font-bold text-void">
                    {i + 1}
                  </span>
                  <span
                    aria-hidden="true"
                    className="hidden h-px flex-1 bg-gradient-to-r from-rift-purple/50 to-transparent sm:block"
                  />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold text-starlight">{d.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-starlight/70">
                    {d.description}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-6 font-display text-2xl font-semibold text-starlight">Rules</h2>
        <ul className="flex flex-col gap-3">
          {siteConfig.rules.map((r) => (
            <li
              key={r}
              className="border-l-2 border-rift-cyan/50 pl-5 leading-relaxed text-starlight/75"
            >
              {r}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
