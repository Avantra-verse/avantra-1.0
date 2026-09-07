"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import IntroSequence from "@/components/IntroSequence";
import CountdownTimer from "@/components/CountdownTimer";
import { siteConfig } from "@/content/site";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export default function Home() {
  const reduce = useReducedMotion();

  return (
    <>
      <IntroSequence onComplete={() => {}} />
      <motion.section
        variants={reduce ? undefined : container}
        initial={reduce ? false : "hidden"}
        animate="show"
        className="flex flex-col items-center text-center gap-6 py-24"
      >
        <motion.h1
          variants={item}
          className="text-5xl font-extrabold bg-gradient-to-br from-rift-purple via-rift-pink to-rift-cyan bg-clip-text text-transparent"
        >
          {siteConfig.eventName}
        </motion.h1>
        <motion.p variants={item} className="text-xl text-starlight/80 max-w-xl">
          {siteConfig.tagline}
        </motion.p>
        <motion.div variants={item}>
          <CountdownTimer />
        </motion.div>
        <motion.p variants={item} className="max-w-2xl text-starlight/70">
          {siteConfig.overview}
        </motion.p>
      </motion.section>
    </>
  );
}
