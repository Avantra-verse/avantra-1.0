"use client";

import React, { useEffect, useState } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export default function ScrollSuspendedString() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { scrollYProgress } = useScroll();

  // Smooth physical spring smoothing for the scroll value
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 18,
    mass: 0.8,
  });

  // MODEL 1 (Cyber Computer on String - drops on the right margin)
  // Appears during Science & Tech Showcases (~0.12 to ~0.52 of scroll)
  const computerY = useTransform(
    smoothProgress,
    [0, 0.12, 0.28, 0.48, 0.6],
    [-450, 140, 220, 140, -450]
  );
  const computerOpacity = useTransform(
    smoothProgress,
    [0, 0.08, 0.14, 0.46, 0.58],
    [0, 0.2, 1, 1, 0]
  );
  const computerRotate = useTransform(
    smoothProgress,
    [0.12, 0.25, 0.38, 0.5],
    [-6, 4, -4, 5]
  );

  // MODEL 2 (Electric Circuit Board on String - drops on the left margin)
  // Appears during Fun & Interactive Events (~0.50 to ~0.95 of scroll)
  const circuitY = useTransform(
    smoothProgress,
    [0.45, 0.55, 0.72, 0.88, 0.98],
    [-450, 150, 240, 160, -450]
  );
  const circuitOpacity = useTransform(
    smoothProgress,
    [0.44, 0.52, 0.58, 0.86, 0.96],
    [0, 0.3, 1, 1, 0]
  );
  const circuitRotate = useTransform(
    smoothProgress,
    [0.52, 0.68, 0.8, 0.92],
    [5, -5, 4, -4]
  );

  if (!mounted) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      aria-hidden="true"
    >
      {/* ======================================================== */}
      {/* SUSPENDED MODEL 1: CYBER COMPUTER (Right Margin)        */}
      {/* ======================================================== */}
      <motion.div
        style={{
          y: computerY,
          opacity: computerOpacity,
        }}
        className="absolute top-0 right-3 sm:right-8 md:right-14 flex flex-col items-center"
      >
        {/* Taut Cyber Suspension String from Ceiling */}
        <div className="relative w-[3px] h-[340px] bg-gradient-to-b from-sky via-[#00f2fe] to-sky shadow-[0_0_12px_#00f2fe]">
          {/* Subtle string bead nodes */}
          <div className="absolute top-1/4 -left-[3px] w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#00f2fe]" />
          <div className="absolute top-2/3 -left-[3px] w-2 h-2 rounded-full bg-[#00f2fe] shadow-[0_0_8px_#00f2fe]" />
        </div>

        {/* Hanging 3D Computer Terminal with Natural Pendulum Sway */}
        <motion.div
          style={{ rotate: computerRotate }}
          animate={{
            rotate: [2, -2, 2],
            y: [0, 4, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 4.5,
            ease: "easeInOut",
          }}
          className="relative -mt-2 w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)] drop-shadow-[0_0_20px_rgba(0,242,254,0.35)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/events/hanging-computer.jpg"
            alt=""
            className="w-full h-full object-contain rounded-2xl"
          />
          {/* Glow label badge */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] tracking-wider uppercase font-[family-name:var(--font-display)] bg-void/90 border border-sky/50 text-[#00f2fe] shadow-[0_0_10px_rgba(0,242,254,0.3)] whitespace-nowrap">
            Terminal 01 // Online
          </div>
        </motion.div>
      </motion.div>

      {/* ======================================================== */}
      {/* SUSPENDED MODEL 2: ELECTRIC CIRCUIT BOARD (Left Margin) */}
      {/* ======================================================== */}
      <motion.div
        style={{
          y: circuitY,
          opacity: circuitOpacity,
        }}
        className="absolute top-0 left-3 sm:left-8 md:left-14 flex flex-col items-center"
      >
        {/* Taut Cyber Suspension String from Ceiling */}
        <div className="relative w-[3px] h-[340px] bg-gradient-to-b from-[#ff5560] via-[#00f2fe] to-sky shadow-[0_0_12px_#00f2fe]">
          <div className="absolute top-1/3 -left-[3px] w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#ff5560]" />
          <div className="absolute top-3/4 -left-[3px] w-2 h-2 rounded-full bg-[#00f2fe] shadow-[0_0_8px_#00f2fe]" />
        </div>

        {/* Hanging 3D Electric Circuit PCB with Natural Pendulum Sway */}
        <motion.div
          style={{ rotate: circuitRotate }}
          animate={{
            rotate: [-3, 3, -3],
            y: [0, 5, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 4.8,
            ease: "easeInOut",
          }}
          className="relative -mt-2 w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)] drop-shadow-[0_0_20px_rgba(0,242,254,0.35)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/events/hanging-circuit.jpg"
            alt=""
            className="w-full h-full object-contain rounded-2xl"
          />
          {/* Glow label badge */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] tracking-wider uppercase font-[family-name:var(--font-display)] bg-void/90 border border-sky/50 text-[#00f2fe] shadow-[0_0_10px_rgba(0,242,254,0.3)] whitespace-nowrap">
            Neural Core PCB // 4.2
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
