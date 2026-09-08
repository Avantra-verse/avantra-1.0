"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { siteConfig } from "@/content/site";

/**
 * The film as the hero background, tiled rather than stretched.
 *
 * The source is 9:16. Three panels side by side come to roughly 27:16, which
 * is close enough to a widescreen viewport that almost nothing is cropped,
 * where a single stretched copy loses about two thirds of the frame. Each
 * panel is offset in the timeline, so the same world runs slightly out of step
 * with itself.
 */
export default function FilmBackdrop() {
  const [failed, setFailed] = useState(false);
  const [panels, setPanels] = useState(1);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      setPanels(w < 768 ? 1 : w < 1280 ? 2 : 3);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (failed) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="flex h-full w-full">
        {Array.from({ length: panels }, (_, i) => (
          <video
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="h-full min-w-0 flex-1 object-cover"
            src={siteConfig.introVideoSrc}
            autoPlay={!reduce}
            muted
            loop={!reduce}
            playsInline
            preload="auto"
            onError={() => setFailed(true)}
            onLoadedMetadata={(e) => {
              // Stagger each copy through the timeline so the panels diverge.
              const v = e.currentTarget;
              if (v.duration && isFinite(v.duration)) {
                v.currentTime = (v.duration / (panels + 1)) * i;
              }
            }}
          />
        ))}
      </div>

      {/* Seams between the panels, so the tiling reads as deliberate. */}
      {panels > 1 && (
        <div className="absolute inset-0 flex">
          {Array.from({ length: panels - 1 }, (_, i) => (
            <div key={i} className="flex-1 border-r border-white/10" />
          ))}
          <div className="flex-1" />
        </div>
      )}

      {/* Grain, matching the film's own texture. */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.14] mix-blend-overlay">
        <filter id="backdrop-grain">
          <feTurbulence baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" type="fractalNoise" />
          <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.5 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#backdrop-grain)" />
      </svg>

      {/* Scrim holding text contrast without flattening the footage. */}
      <div className="absolute inset-0 bg-void/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/35 to-void/60" />
    </div>
  );
}
