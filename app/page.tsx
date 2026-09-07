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
import CountdownTimer from "@/components/CountdownTimer";
import HeroVideo from "@/components/HeroVideo";
import { siteConfig } from "@/content/site";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.12 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

const facts = [
  { label: "when", value: "December 2026" },
  { label: "where", value: siteConfig.venue.name },
  { label: "how long", value: `${siteConfig.days.length} days` },
];

export default function Home() {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const filmScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);

  return (
    <>
      <section
        ref={heroRef}
        className="relative flex min-h-[calc(100dvh-4rem)] items-end overflow-hidden"
      >
        <motion.div
          style={reduce ? undefined : { scale: filmScale }}
          className="absolute inset-0"
        >
          <HeroVideo />
        </motion.div>

        <motion.div
          variants={reduce ? undefined : container}
          initial={reduce ? false : "hidden"}
          animate="show"
          style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
          className="relative mx-auto w-full max-w-6xl px-6 pb-16 sm:pb-24"
        >
          <motion.h1
            variants={item}
            className="font-display text-[clamp(4rem,17vw,13rem)] font-extrabold leading-[0.82] tracking-[-0.03em] text-starlight"
          >
            {siteConfig.eventName}
          </motion.h1>

          <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <motion.div variants={item} className="max-w-sm">
              <p className="text-xl leading-snug text-starlight/85">
                {siteConfig.tagline}
              </p>
              <div className="mt-7 flex flex-wrap gap-6">
                <Link
                  href="/about"
                  className="border-b border-rift-cyan pb-1 text-rift-cyan transition-colors hover:text-starlight"
                >
                  Explore the event
                </Link>
                <Link
                  href="/venue"
                  className="border-b border-white/50 pb-1 text-starlight transition-colors hover:border-starlight hover:text-rift-cyan"
                >
                  Find the venue
                </Link>
              </div>
            </motion.div>

            <motion.div variants={item}>
              <CountdownTimer />
            </motion.div>
          </div>
        </motion.div>
      </section>

      <div className="mx-auto max-w-6xl px-6">
        <div className="seam" />

        <section className="grid gap-10 py-24 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <p className="max-w-[60ch] font-display text-[clamp(1.5rem,3vw,2.25rem)] font-medium leading-[1.25] tracking-[-0.01em] text-starlight">
            {siteConfig.overview}
          </p>

          <dl className="flex flex-col gap-6 lg:pt-3">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline gap-5">
                <dt className="w-24 shrink-0 text-sm text-dim">{f.label}</dt>
                <dd className="font-display text-lg text-starlight">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
