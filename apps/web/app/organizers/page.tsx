import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = { title: "Organising Committee" };

const TIERS = [
  {
    label: "Patrons",
    people: [
      { role: "Chief Patron", name: "Dr. Girija Shankar Das", photo: "girija", position: "Director, SSRVM IEMS Rourkela" },
      { role: "Co-Patron", name: "Dr. Khushboo Jyoti", photo: "khushboo", position: "Principal, SSRVM IEMS Rourkela" },
    ],
  },
  {
    label: "Arithi",
    people: [
      { role: "Advisory Board", name: "Adarsh Anshuman Raj", photo: "adarsh", position: "Co-founder, Arithi" },
      { role: "Advisory Board", name: "Shradha Suman Sahoo", photo: "shradha", position: "Co-founder, Arithi" },
      { role: "Advisory Board", name: "Debabrata Patra", photo: "debabrata", position: "Business Executive, Arithi" },
      { role: "Event Director", name: "Subhrajit Giri", photo: "subhrajit", position: "AVANTRA" },
    ],
  },
  {
    label: "Students",
    people: [
      { role: "Convener", name: "Abhipsa Patra", photo: "abhipsa", position: "Deputy Head Girl" },
      { role: "Joint Convener", name: "Piyush Pretam Dutta", photo: "piyush", position: "Deputy Head Boy" },
    ],
  },
];

export default function OrganizersPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader title="Organising Committee" lead="The people behind AVANTRA 2026, from SSRVM IEMS and Arithi." />

      {TIERS.map((tier, i) => (
        <Reveal key={tier.label}>
          <section aria-label={tier.label} className={i > 0 ? "mt-10 sm:mt-14" : undefined}>
            <ul className="flex flex-wrap justify-center gap-4 sm:gap-6">
              {tier.people.map((p) => (
                <li
                  key={p.name}
                  className="group relative flex w-[calc(50%-8px)] flex-col overflow-hidden rounded-2xl border-[3px] border-sky bg-panel shadow-[5px_5px_0_0_var(--color-ember)] transition-transform duration-300 hover:-translate-y-1 sm:block sm:aspect-[3/4] sm:w-48"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/organizers/${p.photo}.webp`}
                    alt={p.name}
                    width={600}
                    height={800}
                    loading="lazy"
                    className="aspect-[3/4] w-full object-cover object-top transition-transform duration-500 sm:absolute sm:inset-0 sm:aspect-auto sm:h-full group-hover:scale-105"
                  />
                  {/* Phones: caption sits below the photo so it never covers the face; sm+: overlaid card. */}
                  <div className="relative flex-1 border-t-[3px] border-sky bg-panel px-2.5 py-2 sm:absolute sm:inset-x-2 sm:bottom-2 sm:rounded-xl sm:border-2 sm:bg-panel/95">
                    <p className="font-[family-name:var(--font-display)] text-[11px] uppercase tracking-wider text-sky">{p.role}</p>
                    <h3 className="text-sm leading-tight font-bold text-starlight">{p.name}</h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-secondary">{p.position}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      ))}
    </div>
  );
}
