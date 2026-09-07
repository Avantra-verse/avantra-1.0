"use client";

import { motion, useReducedMotion } from "framer-motion";

const RINGS = [
  { size: 340, duration: 46, from: "rgb(123 47 247 / 0.55)" },
  { size: 520, duration: 62, from: "rgb(247 47 182 / 0.4)" },
  { size: 720, duration: 84, from: "rgb(47 247 224 / 0.3)" },
];

export default function PortalRings() {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      {/* Core glow the rings orbit around. */}
      <div
        className="absolute h-[420px] w-[420px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgb(123 47 247 / 0.32), rgb(247 47 182 / 0.14) 45%, transparent 70%)",
        }}
      />

      {RINGS.map((ring) => (
        <motion.div
          key={ring.size}
          className="absolute rounded-full border"
          style={{
            width: ring.size,
            height: ring.size,
            borderColor: ring.from,
            maskImage:
              "conic-gradient(from 0deg, transparent 0deg, black 70deg, black 200deg, transparent 300deg)",
            WebkitMaskImage:
              "conic-gradient(from 0deg, transparent 0deg, black 70deg, black 200deg, transparent 300deg)",
          }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: ring.duration, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}
