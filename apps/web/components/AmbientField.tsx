"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

type Orb = {
  x: number;
  y: number;
  r: number;
  hue: [number, number, number];
  depth: number; // 0 far, 1 near
  drift: number;
  phase: number;
};

// Sampled from the title film: teal dominant, slate carrying the mid-tones,
// rose appearing rarely.
const INKS: [number, number, number][] = [
  [49, 168, 164],
  [49, 168, 164],
  [49, 168, 164],
  [74, 114, 160],
  [74, 114, 160],
  [200, 116, 155],
];

/**
 * A generated field of soft, layered light standing in for the film: many
 * blurred orbs at different depths, drifting slowly, with nearer ones larger
 * and brighter. Replaces the video without falling back to stock imagery.
 */
export default function AmbientField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let orbs: Orb[] = [];
    let frame = 0;
    let t = 0;

    const seed = () => {
      const count = width < 700 ? 14 : 22;
      orbs = Array.from({ length: count }, (_, i) => {
        const depth = Math.random();
        return {
          x: Math.random(),
          y: Math.random() * 0.85,
          r: (0.06 + depth * 0.22) * Math.min(width, height),
          hue: INKS[i % INKS.length],
          depth,
          drift: 0.00004 + depth * 0.00011,
          phase: Math.random() * Math.PI * 2,
        };
      });
      orbs.sort((a, b) => a.depth - b.depth);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      for (const o of orbs) {
        const wobble = Math.sin(t * 0.4 + o.phase) * 0.012;
        const cx = (o.x + wobble) * width;
        const cy = (o.y - t * o.drift * 60) * height;
        const alpha = 0.05 + o.depth * 0.13;

        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, o.r);
        const [r, gr, b] = o.hue;
        g.addColorStop(0, `rgba(${r},${gr},${b},${alpha})`);
        g.addColorStop(0.55, `rgba(${r},${gr},${b},${alpha * 0.35})`);
        g.addColorStop(1, `rgba(${r},${gr},${b},0)`);

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, o.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
    };

    const tick = () => {
      t += 1 / 60;
      for (const o of orbs) {
        o.y -= o.drift;
        if (o.y * height < -o.r) {
          o.y = 1 + o.r / height;
          o.x = Math.random();
        }
      }
      draw();
      frame = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);

    if (reduce) {
      draw();
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [reduce]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Kept quiet: this is the room the page sits in, not a feature. */}
      <canvas ref={canvasRef} className="h-full w-full opacity-70" />
      {/* Grain, matching the film's texture. Fixed, so it never repaints on scroll. */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.13] mix-blend-overlay">
        <filter id="ambient-grain">
          <feTurbulence baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" type="fractalNoise" />
          <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.5 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#ambient-grain)" />
      </svg>
    </div>
  );
}
