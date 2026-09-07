"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import IntroSequence from "@/components/IntroSequence";
import CountdownTimer from "@/components/CountdownTimer";
import PortalRings from "@/components/PortalRings";
import HeroVideo from "@/components/HeroVideo";
import Reveal from "@/components/Reveal";
import { siteConfig } from "@/content/site";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

const glance = [
  { label: "When", value: "December 2026" },
  { label: "Where", value: siteConfig.venue.name },
  { label: "Format", value: `${siteConfig.days.length} days of exhibits and events` },
];

export default function Home() {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);

  // Scroll-linked hero exit: content drifts up and dims while the portal
  // behind it pushes forward, so leaving the hero reads as travelling through it.
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const backdropScale = useTransform(scrollYProgress, [0, 1], [1, 1.25]);

  return (
    <>
      <IntroSequence onComplete={() => {}} />

      <section
        ref={heroRef}
        className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4"
      >
        <motion.div
          style={reduce ? undefined : { scale: backdropScale }}
          className="absolute inset-0"
        >
          <HeroVideo />
          <PortalRings />
        </motion.div>

        <motion.div
          variants={reduce ? undefined : container}
          initial={reduce ? false : "hidden"}
          animate="show"
          style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
          className="relative flex flex-col items-center text-center"
        >
          <motion.span
            variants={item}
            className="mb-6 rounded-full border border-white/12 bg-void/30 px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] text-starlight/60 backdrop-blur-sm"
          >
            December 2026
          </motion.span>

          <motion.h1
            variants={item}
            className="font-display text-[clamp(3.5rem,14vw,10rem)] font-bold leading-[0.9] tracking-tight text-starlight"
          >
            {siteConfig.eventName}
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-5 max-w-lg text-lg text-starlight/75 sm:text-xl"
          >
            {siteConfig.tagline}
          </motion.p>

          <motion.div variants={item} className="mt-10">
            <CountdownTimer />
          </motion.div>

          <motion.div variants={item} className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/about"
              className="rounded-full bg-starlight px-7 py-3 font-medium text-void transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Explore the event
            </Link>
            <Link
              href="/venue"
              className="rounded-full border border-white/25 px-7 py-3 font-medium text-starlight backdrop-blur-sm transition-colors hover:border-rift-cyan/60 hover:text-rift-cyan"
            >
              Venue and directions
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        <div className="rift-rule" />

        <section className="py-24">
          <Reveal variant="warp">
            <p className="max-w-3xl font-display text-2xl leading-relaxed text-starlight/85 sm:text-[1.75rem]">
              {siteConfig.overview}
            </p>
          </Reveal>
        </section>

        <section className="grid gap-4 pb-28 sm:grid-cols-3">
          {glance.map((g, i) => (
            <Reveal key={g.label} delay={i * 0.08}>
              <div className="panel h-full px-6 py-7">
                <p className="text-[11px] uppercase tracking-[0.18em] text-starlight/45">
                  {g.label}
                </p>
                <p className="mt-3 font-display text-xl text-starlight">{g.value}</p>
              </div>
            </Reveal>
          ))}
        </section>
      </div>
    </>
  );
}
