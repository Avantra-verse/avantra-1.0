import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/content/site";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "About, Venue & Committee",
  description:
    "Learn about AVANTRA 2026 — the multiverse-themed science fair & festival hosted by SSRVM IEMS and Arithi. Venue directions, prizes, and our organizing committee.",
};

// Card styling tokens matching the Ember design language
const card =
  "rounded-[26px] border-[3px] border-sky bg-panel p-7 shadow-[0_0_0_6px_var(--color-ember),0_24px_60px_rgb(0_0_0/0.45)] sm:p-9";

const subCard =
  "rounded-2xl border-2 border-sky/40 bg-panel/80 p-5 shadow-[3px_3px_0_0_var(--color-ember)] transition-transform duration-200 hover:-translate-y-0.5";

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
      { role: "Chief Advisor", name: "Adarsh Anshuman Raj", photo: "adarsh", position: "Co-founder, Arithi" },
      { role: "Advisor", name: "Shradha Suman Sahoo", photo: "shradha", position: "Co-founder, Arithi" },
      { role: "Advisor", name: "Debabrata Patra", photo: "debabrata", position: "Business Executive, Arithi" },
    ],
  },
  {
    label: "Event team",
    people: [
      { role: "Event Head", name: "Rohnit Raj Panigrahi", photo: "rohnit", position: "Founder, Arithi" },
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

const EXPERIENCES = [
  {
    tag: "01",
    title: "The Showcase",
    desc: "School students bring their own science, robotics, and technology projects to present to judges and fellow innovators.",
  },
  {
    tag: "02",
    title: "The Challenge Floor",
    desc: "Hands-on, fast-paced challenges, drone races, go-karting, and problem-solving puzzles where students collaborate and compete across schools.",
  },
  {
    tag: "03",
    title: "The Exchange",
    desc: "Direct interactions with college engineering teams from NIT Rourkela and industry mentors, discovering real-world STEM pathways.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 pt-24 pb-32">
      {/* Page Header */}
      <PageHeader
        title="About AVANTRA 2026"
        lead="A two-day multiverse-themed science fair and innovation festival bringing college-level science exposure to school students, hosted by SSRVM IEMS in partnership with ARITHI."
      />

      {/* Quick Jump Anchor Pills */}
      <nav aria-label="Section shortcuts" className="mt-6 mb-16 flex flex-wrap gap-2.5">
        <a
          href="#overview"
          className="inline-flex items-center rounded-full border border-sky/40 bg-panel px-4 py-1.5 text-xs font-bold tracking-wider text-sky uppercase transition-colors hover:border-sky hover:bg-white/5"
        >
          Overview
        </a>
        <a
          href="#schedule"
          className="inline-flex items-center rounded-full border border-sky/40 bg-panel px-4 py-1.5 text-xs font-bold tracking-wider text-sky uppercase transition-colors hover:border-sky hover:bg-white/5"
        >
          Schedule
        </a>
        <a
          href="#partners"
          className="inline-flex items-center rounded-full border border-sky/40 bg-panel px-4 py-1.5 text-xs font-bold tracking-wider text-sky uppercase transition-colors hover:border-sky hover:bg-white/5"
        >
          Partners
        </a>
        <a
          href="#venue"
          className="inline-flex items-center rounded-full border border-sky/40 bg-panel px-4 py-1.5 text-xs font-bold tracking-wider text-sky uppercase transition-colors hover:border-sky hover:bg-white/5"
        >
          Venue &amp; Directions
        </a>
        <a
          href="#prizes"
          className="inline-flex items-center rounded-full border border-sky/40 bg-panel px-4 py-1.5 text-xs font-bold tracking-wider text-sky uppercase transition-colors hover:border-sky hover:bg-white/5"
        >
          Prizes &amp; Awards
        </a>
        <a
          href="#committee"
          className="inline-flex items-center rounded-full border border-sky/40 bg-panel px-4 py-1.5 text-xs font-bold tracking-wider text-sky uppercase transition-colors hover:border-sky hover:bg-white/5"
        >
          Committee
        </a>
      </nav>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. OVERVIEW & MULTIVERSE EXPERIENCES */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="overview" className="scroll-mt-28">
        <Reveal>
          <div className={card}>
            <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-[0.2em] text-sky uppercase">
              The Multiverse Vision
            </span>
            <h2 className="t-title mt-2 text-starlight">A Universe of Curiosity &amp; Science</h2>
            <p className="t-body mt-4 max-w-[70ch] text-secondary text-base leading-relaxed sm:text-lg">
              {siteConfig.overview}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {EXPERIENCES.map((exp) => (
                <div key={exp.title} className={subCard}>
                  <span className="font-mono text-xs font-bold text-sky">{exp.tag} //</span>
                  <h3 className="mt-1 font-[family-name:var(--font-display)] text-base font-bold text-starlight">
                    {exp.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-secondary">{exp.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SCHEDULE & DAYS */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="schedule" className="mt-14 scroll-mt-28">
        <Reveal>
          <div>
            <h2 className="t-section text-starlight">Two-Day Event Schedule</h2>
            <p className="t-body mt-1 max-w-[60ch] text-secondary text-sm">
              Explore what happens across both days at the festival.
            </p>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {siteConfig.days.map((day, idx) => (
                <div key={day.title} className={card}>
                  <div className="flex items-center justify-between">
                    <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-wider text-sky uppercase">
                      {idx === 0 ? "19 December 2026" : "20 December 2026"}
                    </span>
                    <span className="rounded-full border border-sky/50 bg-void px-2.5 py-0.5 text-xs font-bold text-sky">
                      {day.title}
                    </span>
                  </div>
                  <h3 className="t-title mt-3 text-lg font-bold text-starlight">
                    {idx === 0 ? "Inauguration & Science Exhibition" : "Competitive Events & Grand Finale"}
                  </h3>
                  <p className="t-body mt-3 text-sm leading-relaxed text-secondary">{day.description}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. PARTNERS */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="partners" className="mt-14 scroll-mt-28">
        <Reveal>
          <div>
            <h2 className="t-section text-starlight">Partners &amp; Collaborators</h2>
            <p className="t-body mt-1 max-w-[60ch] text-secondary text-sm">
              The collaborative ecosystem powering AVANTRA 2026.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {siteConfig.partners.map((p) => (
                <div key={p.name} className={subCard}>
                  <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-sky">{p.name}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-secondary">{p.role}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. VENUE & DIRECTIONS + PRIZES */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="venue" className="mt-14 scroll-mt-28">
        <Reveal>
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
            {/* Venue Card */}
            <div className={card} aria-labelledby="venue-name">
              <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-[0.2em] text-sky uppercase">
                Location &amp; Access
              </span>
              <h2 id="venue-name" className="t-title mt-2 text-starlight">
                {siteConfig.venue.name}
              </h2>
              <p className="mt-2 font-[family-name:var(--font-display)] text-base font-bold text-sky">
                19–20 December 2026
              </p>
              <p className="t-body mt-4 text-sm text-secondary">{siteConfig.venue.address}</p>
              <p className="t-body mt-2 text-sm text-secondary">{siteConfig.venue.directions}</p>
              <a
                href={siteConfig.venue.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-11 items-center rounded-full border-[3px] border-sky bg-ember px-6 font-[family-name:var(--font-display)] text-sm font-bold text-white transition-[background-color,box-shadow] duration-200 hover:bg-ember-hot hover:shadow-[0_6px_24px_rgb(159_212_255/0.35)]"
              >
                Open in Google Maps ↗
              </a>
            </div>

            {/* Prizes Card */}
            <div id="prizes" className={`${card} scroll-mt-28`} aria-labelledby="prizes-heading">
              <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-[0.2em] text-sky uppercase">
                Honors &amp; Recognition
              </span>
              <h2 id="prizes-heading" className="t-section mt-2 text-starlight">
                Prizes &amp; Certificates
              </h2>
              <dl className="mt-4 flex flex-col">
                {siteConfig.prizes.map((p) => (
                  <div key={p.title} className="border-t border-starlight/15 py-4 first:border-t-0">
                    <dt className="font-[family-name:var(--font-display)] text-sm font-bold text-sky">{p.title}</dt>
                    <dd className="t-body mt-1 text-xs text-secondary">{p.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. ORGANISING COMMITTEE */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="committee" className="mt-16 scroll-mt-28">
        <Reveal>
          <div>
            <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-[0.2em] text-sky uppercase">
              Leadership &amp; Coordination
            </span>
            <h2 className="t-section mt-1 text-starlight">Organising Committee</h2>
            <p className="t-body mt-1 max-w-[60ch] text-secondary text-sm">
              The dedicated educators, leaders, and student coordinators behind AVANTRA 2026 from SSRVM IEMS and Arithi.
            </p>
          </div>
        </Reveal>

        {TIERS.map((tier, i) => (
          <Reveal key={tier.label}>
            <div aria-label={tier.label} className={i > 0 ? "mt-8 sm:mt-12" : "mt-8"}>
              <h3 className="mb-4 font-[family-name:var(--font-display)] text-xs font-bold tracking-widest text-sky uppercase">
                {tier.label}
              </h3>
              <ul className="flex flex-wrap justify-center gap-4 sm:justify-start sm:gap-6">
                {tier.people.map((p) => (
                  <li
                    key={p.name}
                    className="group relative flex w-[calc(50%-8px)] flex-col overflow-hidden rounded-2xl border-[3px] border-sky bg-panel shadow-[5px_5px_0_0_var(--color-ember)] transition-transform duration-300 hover:-translate-y-1 sm:block sm:aspect-[3/4] sm:w-52"
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
                    <div className="relative flex-1 border-t-[3px] border-sky bg-panel px-2.5 py-2 sm:absolute sm:inset-x-2 sm:bottom-2 sm:rounded-xl sm:border-2 sm:bg-panel/95">
                      <p className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-wider text-sky">
                        {p.role}
                      </p>
                      <h4 className="text-sm leading-tight font-bold text-starlight">{p.name}</h4>
                      <p className="mt-0.5 text-[11px] leading-snug text-secondary">{p.position}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </section>
    </div>
  );
}
