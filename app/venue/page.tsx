import { siteConfig } from "@/content/site";
import Reveal from "@/components/Reveal";
import HoverCard from "@/components/HoverCard";

export default function Venue() {
  return (
    <section className="py-16">
      <div className="grid lg:grid-cols-2 gap-12">
        <Reveal>
          <div>
            <h1 className="text-3xl font-bold text-rift-cyan mb-4">Venue & Directions</h1>
            <HoverCard className="rounded-lg p-6 border border-white/10 bg-gradient-to-br from-rift-cyan/10 to-transparent">
              <p className="text-starlight font-semibold text-lg">{siteConfig.venue.name}</p>
              <p className="text-starlight/70 mt-2">{siteConfig.venue.address}</p>
              <p className="text-starlight/70 mt-2">{siteConfig.venue.directions}</p>
            </HoverCard>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div>
            <h2 className="text-2xl font-semibold mb-4">Prizes & Certificates</h2>
            <ul className="flex flex-col gap-3">
              {siteConfig.prizes.map((p) => (
                <li key={p.title}>
                  <HoverCard className="rounded-lg p-4 border border-white/10 bg-gradient-to-br from-rift-pink/10 to-transparent">
                    <p className="font-semibold text-starlight">{p.title}</p>
                    <p className="text-starlight/70 text-sm mt-1">{p.description}</p>
                  </HoverCard>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
