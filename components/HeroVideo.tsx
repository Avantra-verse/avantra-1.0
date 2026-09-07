"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { siteConfig } from "@/content/site";

/**
 * Loops the intro film behind the hero so the multiverse motion continues
 * into the site itself. Falls back silently to the portal rings alone if the
 * file is missing or the viewer prefers reduced motion.
 */
export default function HeroVideo() {
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();

  if (failed || reduce) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <video
        className="h-full w-full object-cover opacity-80"
        src={siteConfig.introVideoSrc}
        autoPlay
        muted
        loop
        playsInline
        onError={() => setFailed(true)}
      />

      {/* Vignette only behind the copy, so the footage stays visible at the
          edges while the headline keeps its contrast. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 50% 50%, rgb(5 5 15 / 0.72), rgb(5 5 15 / 0.25) 70%, transparent 100%)",
        }}
      />
      {/* Short fade at the bottom edge so the hero meets the page cleanly. */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-void" />
    </div>
  );
}
