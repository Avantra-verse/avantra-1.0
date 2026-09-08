"use client";

import { motion, useReducedMotion } from "framer-motion";

const PASSES = [
  { color: "#4a72a0", from: { x: -46, y: 22 }, rest: { x: 5, y: -3 }, blur: 7 },
  { color: "#c8749b", from: { x: 38, y: -18 }, rest: { x: -4, y: 3 }, blur: 6 },
  { color: "#31a8a4", from: { x: -22, y: -30 }, rest: { x: 3, y: -2 }, blur: 5 },
];

/**
 * The name and its parallel versions.
 *
 * Every layer renders the word as ordinary text, never as per-letter boxes:
 * splitting it into flex items drops kerning, changes how the tracking sets,
 * and leaves the colour passes out of register with the letters beneath them.
 */
export default function ConvergingWordmark({ text }: { text: string }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <h1 className="t-hero text-starlight">{text}</h1>;
  }

  return (
    <div className="relative select-none">
      {PASSES.map((p, i) => (
        <motion.span
          key={p.color}
          aria-hidden="true"
          initial={{ x: p.from.x, y: p.from.y, opacity: 0, filter: `blur(${p.blur}px)` }}
          animate={{
            x: [p.from.x, 0, p.rest.x],
            y: [p.from.y, 0, p.rest.y],
            opacity: [0, 0.95, 0.62],
            filter: [`blur(${p.blur}px)`, "blur(0px)", "blur(0.4px)"],
          }}
          transition={{
            duration: 1.5,
            times: [0, 0.62, 1],
            delay: i * 0.09,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="t-hero absolute inset-0 mix-blend-screen"
          style={{ color: p.color }}
        >
          {text}
        </motion.span>
      ))}

      {/* Uncovered from behind an edge, as one word, so the type is untouched. */}
      <div className="relative overflow-hidden pb-[0.08em]">
        <motion.h1
          initial={{ y: "108%" }}
          animate={{ y: "0%" }}
          transition={{ duration: 1.1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="t-hero text-starlight"
        >
          {text}
        </motion.h1>
      </div>
    </div>
  );
}
