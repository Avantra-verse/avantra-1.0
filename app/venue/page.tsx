import { siteConfig } from "@/content/site";
import Reveal from "@/components/Reveal";

export default function Venue() {
  return (
    <section className="py-16 flex flex-col gap-12">
      <Reveal>
        <div>
          <h1 className="text-3xl font-bold text-rift-cyan mb-4">Venue & Directions</h1>
          <p className="text-starlight font-semibold">{siteConfig.venue.name}</p>
          <p className="text-starlight/70">{siteConfig.venue.address}</p>
          <p className="text-starlight/70 mt-2">{siteConfig.venue.directions}</p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Prizes & Certificates</h2>
          <ul className="grid sm:grid-cols-2 gap-4">
            {siteConfig.prizes.map((p) => (
              <li key={p.title} className="border border-rift-purple/30 rounded p-4">
                <p className="font-semibold text-starlight">{p.title}</p>
                <p className="text-starlight/70 text-sm">{p.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
