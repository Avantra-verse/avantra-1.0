"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { siteConfig } from "@/content/site";

/**
 * The title film shown at its native portrait ratio rather than cropped into
 * a landscape band. Nothing is cut off. Disappears silently if the file is
 * missing; under reduced motion it holds on the first frame instead of looping.
 */
export default function FilmPanel() {
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();

  if (failed) return null;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-[300px] lg:max-w-[340px]"
    >
      <div className="relative aspect-[9/16] w-full overflow-hidden border border-white/10">
        <video
          className="h-full w-full object-cover"
          src={siteConfig.introVideoSrc}
          autoPlay={!reduce}
          muted
          loop={!reduce}
          playsInline
          onError={() => setFailed(true)}
        />
        {/* Sits the film into the page rather than pasting it on top. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-void/25" />
      </div>

      {/* A single hairline tying the panel to the page's rule system. */}
      <div className="seam mt-4" />
    </motion.div>
  );
}
