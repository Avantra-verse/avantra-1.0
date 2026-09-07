import { siteConfig } from "@/content/site";
import Reveal from "@/components/Reveal";

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
          <p className="text-starlight/60 italic">Sponsor list to be announced.</p>
        ) : (
          <ul className="grid sm:grid-cols-3 gap-4">
            {siteConfig.sponsors.map((s) => (
              <li key={s.name} className="border border-rift-purple/30 rounded p-4 text-center">
                <p className="font-semibold text-starlight">{s.name}</p>
                <p className="text-starlight/60 text-sm">{s.tier}</p>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </section>
  );
}
