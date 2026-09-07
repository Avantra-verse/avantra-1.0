"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { siteConfig } from "@/content/site";

/**
 * A wide band of the event film, used once per page as real visual material.
 * Under reduced motion the video is held on its first frame rather than removed,
 * so the page keeps its image.
 */
export default function FilmBand() {
  const [failed, setFailed] = useState(false);
  const reduce = useReducedMotion();

  if (failed) return null;

  return (
    <div className="relative aspect-[21/9] w-full overflow-hidden border border-white/8">
      <video
        className="h-full w-full object-cover"
        src={siteConfig.introVideoSrc}
        autoPlay={!reduce}
        muted
        loop={!reduce}
        playsInline
        onError={() => setFailed(true)}
      />
    </div>
  );
}
