"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { siteConfig } from "@/content/site";

/**
 * The intro film keeps running behind the hero, so the multiverse motion
 * continues into the site instead of ending with the intro. Disappears
 * silently if the file is missing or the viewer prefers reduced motion.
 */
export default function HeroVideo() {
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();

  if (failed || reduce) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <video
        className="h-full w-full object-cover"
        src={siteConfig.introVideoSrc}
        autoPlay
        muted
        loop
        playsInline
        onError={() => setFailed(true)}
      />
      {/* Weighted to the bottom, where the headline sits. The film stays
          fully visible across the upper frame. */}
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/70 via-40% to-void/10" />
    </div>
  );
}
