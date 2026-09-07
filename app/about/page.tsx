import { siteConfig } from "@/content/site";
import Reveal from "@/components/Reveal";
import HoverCard from "@/components/HoverCard";

export default function About() {
  return (
    <section className="py-16 flex flex-col gap-12">
      <Reveal>
        <div>
          <h1 className="text-3xl font-bold text-rift-cyan mb-4">About AVANTRA</h1>
          <p className="text-starlight/80 max-w-2xl">{siteConfig.overview}</p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Partners</h2>
          <ul className="grid sm:grid-cols-3 gap-4">
            {siteConfig.partners.map((p, i) => (
              <li key={p.name} className={i === 0 ? "sm:col-span-3" : ""}>
                <HoverCard
                  className={
                    "rounded-lg p-5 border border-white/10 bg-gradient-to-br h-full " +
                    (i === 0
                      ? "from-rift-purple/20 via-rift-pink/10 to-transparent"
                      : "from-white/[0.04] to-transparent")
                  }
                >
                  <p className={i === 0 ? "text-xl font-semibold text-starlight" : "font-semibold text-starlight"}>
                    {p.name}
                  </p>
                  <p className="text-starlight/70 text-sm mt-1">{p.role}</p>
                </HoverCard>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Event Structure</h2>
          <ol className="flex flex-col sm:flex-row gap-6 sm:gap-4">
            {siteConfig.days.map((d, i) => (
              <li key={d.title} className="flex-1 flex sm:flex-col gap-3">
                <div className="flex sm:flex-col items-center gap-2 sm:gap-0">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-rift-purple to-rift-cyan text-void font-bold text-sm shrink-0">
                    {i + 1}
                  </span>
                  {i < siteConfig.days.length - 1 && (
                    <span className="hidden sm:block w-full h-px bg-gradient-to-r from-rift-purple/40 to-transparent mt-2" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-starlight">{d.title}</p>
                  <p className="text-starlight/70 text-sm">{d.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      <Reveal delay={0.3}>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Rules</h2>
          <ul className="flex flex-col gap-3">
            {siteConfig.rules.map((r) => (
              <li key={r} className="border-l-2 border-rift-cyan/50 pl-4 text-starlight/80">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
