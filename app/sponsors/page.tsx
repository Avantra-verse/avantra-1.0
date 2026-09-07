import { siteConfig } from "@/content/site";
import Reveal from "@/components/Reveal";
import HoverCard from "@/components/HoverCard";

export default function Sponsors() {
  return (
    <section className="py-16 flex flex-col gap-8">
      <Reveal>
        <div>
          <h1 className="text-3xl font-bold text-rift-cyan mb-4">Sponsors & Partners</h1>
          <p className="text-starlight/80 max-w-2xl">
            AVANTRA is made possible through sponsorship coordinated by ARITHI, keeping the
            cost to the school minimal while bringing NIT Rourkela student clubs in to
            showcase real college-level science to students.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        {siteConfig.sponsors.length === 0 ? (
          <div className="rounded-lg p-8 border border-white/10 bg-gradient-to-br from-rift-purple/15 via-rift-pink/10 to-transparent text-center">
            <p className="text-starlight/70">Sponsor list to be announced.</p>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-3 gap-4">
            {siteConfig.sponsors.map((s) => (
              <li key={s.name}>
                <HoverCard className="rounded-lg p-4 border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent text-center">
                  <p className="font-semibold text-starlight">{s.name}</p>
                  <p className="text-starlight/60 text-sm">{s.tier}</p>
                </HoverCard>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </section>
  );
}
