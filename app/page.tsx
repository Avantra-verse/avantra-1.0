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
import DepthField from "@/components/hero/DepthField";
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
  const fieldScale = useTransform(scrollYProgress, [0, 1], [1, 1.14]);

  return (
    <>
      <section
        ref={heroRef}
        className="relative flex min-h-[calc(100dvh-4rem)] items-end overflow-hidden"
      >
        <motion.div
          style={reduce ? undefined : { scale: fieldScale }}
          className="absolute inset-0"
        >
          <DepthField />
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
            className="t-hero text-starlight"
          >
            {siteConfig.eventName}
          </motion.h1>

          <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <motion.div variants={item} className="max-w-sm">
              <p className="t-lead text-secondary">
                {siteConfig.tagline}
              </p>
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
          </div>
        </motion.div>
      </section>

      <div className="mx-auto max-w-6xl px-6">
        <div className="seam" />

        <section className="grid gap-10 py-24 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <p className="t-lead max-w-[60ch] text-secondary">
            {siteConfig.overview}
          </p>

          <dl className="flex flex-col gap-6 lg:pt-3">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline gap-5">
                <dt className="w-24 shrink-0 text-sm text-muted">{f.label}</dt>
                <dd className="t-item text-starlight">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
