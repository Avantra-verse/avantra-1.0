import { siteConfig } from "@/content/site";
import Reveal from "@/components/Reveal";

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
          <ul className="grid sm:grid-cols-2 gap-4">
            {siteConfig.partners.map((p) => (
              <li key={p.name} className="border border-rift-purple/30 rounded p-4">
                <p className="font-semibold text-starlight">{p.name}</p>
                <p className="text-starlight/70 text-sm">{p.role}</p>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Event Structure</h2>
          <ul className="grid sm:grid-cols-3 gap-4">
            {siteConfig.days.map((d) => (
              <li key={d.title} className="border border-rift-purple/30 rounded p-4">
                <p className="font-semibold text-starlight">{d.title}</p>
                <p className="text-starlight/70 text-sm">{d.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={0.3}>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Rules</h2>
          <ul className="list-disc list-inside text-starlight/80">
            {siteConfig.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
