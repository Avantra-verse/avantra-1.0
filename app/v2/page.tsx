"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import CountdownTimer from "@/components/CountdownTimer";
import ConvergingWordmark from "@/components/hero/ConvergingWordmark";
import FilmBackdrop from "@/components/hero/FilmBackdrop";
import Reveal from "@/components/Reveal";
import { siteConfig } from "@/content/site";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 1.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

const facts = [
  { label: "when", value: "December 2026" },
  { label: "where", value: siteConfig.venue.name },
  { label: "how long", value: `${siteConfig.days.length} days` },
];

export default function HomeVariantTwo() {
  const reduce = useReducedMotion();

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[calc(100dvh-4rem)] items-end overflow-hidden">
        <FilmBackdrop />

        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 sm:pb-20">
          <ConvergingWordmark text={siteConfig.eventName} />

          <motion.div
            variants={reduce ? undefined : container}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between"
          >
            <motion.div variants={item} className="max-w-sm">
              <p className="t-lead text-starlight">{siteConfig.tagline}</p>
              <div className="mt-7">
                <Link
                  href="/about"
                  className="border-b border-teal pb-1 text-teal transition-colors hover:text-starlight"
                >
                  See the three days
                </Link>
              </div>
            </motion.div>

            <motion.div variants={item}>
              <CountdownTimer />
            </motion.div>
          </motion.div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6">
        <div className="seam" />

        {/* What it is */}
        <section className="grid gap-10 py-24 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <p className="t-lead max-w-[60ch] text-secondary">{siteConfig.overview}</p>

          <dl className="flex flex-col gap-6 lg:pt-3">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline gap-5">
                <dt className="w-24 shrink-0 text-sm text-muted">{f.label}</dt>
                <dd className="t-item text-starlight">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="seam" />

        {/* The three days. A real sequence, so it is numbered. */}
        <section className="py-24">
          <h2 className="t-section mb-12 text-starlight">Three days</h2>
          <ol className="grid gap-px overflow-hidden border border-white/8 sm:grid-cols-3">
            {siteConfig.days.map((d, i) => (
              <li key={d.title} className="bg-white/[0.02] px-7 py-9">
                <Reveal delay={i * 0.09}>
                  <span className="t-small block text-teal">{String(i + 1).padStart(2, "0")}</span>
                  <p className="t-item mt-3 text-starlight">{d.title}</p>
                  <p className="t-body mt-3 text-secondary">{d.description}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <div className="seam" />

        {/* Who runs it */}
        <section className="py-24">
          <h2 className="t-section mb-12 text-starlight">Who runs it</h2>
          <dl className="flex flex-col">
            {siteConfig.partners.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.06}>
                <div className="grid gap-2 border-t border-white/8 py-7 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-10">
                  <dt className="t-item text-starlight">{p.name}</dt>
                  <dd className="t-body max-w-[58ch] text-secondary">{p.role}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </section>

        <div className="seam" />

        {/* Closing */}
        <section className="py-28">
          <Reveal>
            <p className="t-title max-w-[20ch] text-starlight">
              Bring a project, or bring a school.
            </p>
            <p className="t-body mt-8 max-w-[52ch] text-secondary">
              Exhibition space, sponsorship and school delegations are all
              coordinated by ARITHI.
            </p>
            <div className="mt-8 flex flex-wrap gap-8">
              <Link
                href="/contact"
                className="border-b border-teal pb-1 text-teal transition-colors hover:text-starlight"
              >
                Get in touch
              </Link>
              <Link
                href="/venue"
                className="border-b border-white/30 pb-1 text-starlight transition-colors hover:border-starlight"
              >
                Venue and prizes
              </Link>
            </div>
          </Reveal>
        </section>
      </div>
    </>
  );
}
