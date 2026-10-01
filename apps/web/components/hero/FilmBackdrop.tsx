"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { siteConfig } from "@/content/site";

const DRIFT_TOLERANCE = 0.12; // seconds

/**
 * The film as the hero background, tiled rather than stretched.
 *
 * The source is 9:16. Three panels side by side come to roughly 27:16, close
 * enough to a widescreen viewport that almost nothing is cropped, where a
 * single stretched copy loses about two thirds of the frame.
 *
 * Alternate panels are mirrored, so each join meets its own reflection and the
 * seam disappears. All panels are held on the same timeline; without that the
 * mirror symmetry breaks and the joins show.
 */
export default function FilmBackdrop() {
  const [failed, setFailed] = useState(false);
  const [panels, setPanels] = useState(1);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // On scroll the copies drift apart and the seams open, so the tiling
  // resolves into separate parallel versions of the same footage.
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end start"],
  });
  const spread = useTransform(scrollYProgress, [0, 1], [0, 26]);
  const spreadNeg = useTransform(spread, (v) => -v);
  const zoom = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      setPanels(w < 768 ? 1 : w < 1280 ? 2 : 3);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Browsers pause background video when a tab is hidden and do not always
  // resume. Restart and re-sync the panels when the page comes back.
  useEffect(() => {
    if (reduce) return;
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      const lead = refs.current[0];
      for (const v of refs.current) {
        if (!v) continue;
        if (lead && v !== lead) v.currentTime = lead.currentTime;
        if (v.paused) void v.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, [reduce]);

  if (failed) return null;

  // Panel 0 leads; the rest follow it, correcting whenever they drift apart.
  const handleLeadTimeUpdate = () => {
    const lead = refs.current[0];
    if (!lead) return;
    for (let i = 1; i < refs.current.length; i++) {
      const v = refs.current[i];
      if (!v) continue;
      if (Math.abs(v.currentTime - lead.currentTime) > DRIFT_TOLERANCE) {
        v.currentTime = lead.currentTime;
      }
    }
  };

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <motion.div className="flex h-full w-full" style={reduce ? undefined : { scale: zoom }}>
        {Array.from({ length: panels }, (_, i) => (
          <motion.video
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="h-full min-w-0 flex-1 object-cover"
            // Every other panel is flipped, so neighbouring edges are
            // reflections of each other and the joins vanish at rest.
            style={{
              // Slight overscale so neighbouring panels overlap. Flex widths
              // land on subpixel boundaries, and without the overlap a hairline
              // of background shows through at each join.
              scaleX: i % 2 === 1 ? -1.006 : 1.006,
              scaleY: 1.006,
              x: reduce || panels === 1 || i === 1 ? 0 : i === 0 ? spreadNeg : spread,
            }}
            src={siteConfig.introVideoSrc}
            autoPlay={!reduce}
            muted
            loop={!reduce}
            playsInline
            preload="auto"
            onError={() => setFailed(true)}
            onLoadedMetadata={(e) => {
              const lead = refs.current[0];
              e.currentTarget.currentTime = lead ? lead.currentTime : 0;
            }}
            onTimeUpdate={i === 0 ? handleLeadTimeUpdate : undefined}
          />
        ))}
      </motion.div>

      {/* Grain, matching the film's own texture. */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.14] mix-blend-overlay">
        <filter id="backdrop-grain">
          <feTurbulence baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" type="fractalNoise" />
          <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.5 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#backdrop-grain)" />
      </svg>

      {/* Scrim. Heavy enough that glass sheets and body copy stay readable
          over the footage, light enough that the film still reads. */}
      <div className="absolute inset-0 bg-void/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/35 to-void/60" />
    </div>
  );
}
