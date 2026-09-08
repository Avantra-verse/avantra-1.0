"use client";

import { motion, useReducedMotion } from "framer-motion";

const PASSES = [
  { color: "#4a72a0", from: { x: -46, y: 22 }, blur: 7 },
  { color: "#c8749b", from: { x: 38, y: -18 }, blur: 6 },
  { color: "#31a8a4", from: { x: -22, y: -30 }, blur: 5 },
];

/**
 * The multiverse as divergence: the same word existing several times over,
 * each version arriving from a different place and settling into register.
 * The white pass sits on top; the coloured passes stay slightly out of line.
 */
export default function ConvergingWordmark({ text }: { text: string }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative select-none">
      {/* Off-register passes. Hidden from assistive tech, the real text is below. */}
      {!reduce &&
        PASSES.map((p, i) => (
          <motion.span
            key={p.color}
            aria-hidden="true"
            initial={{ x: p.from.x, y: p.from.y, opacity: 0, filter: `blur(${p.blur}px)` }}
            animate={{
              x: [p.from.x, 0, i === 2 ? 2 : i === 1 ? -3 : 4],
              y: [p.from.y, 0, i === 1 ? 2 : -2],
              opacity: [0, 0.9, 0.55],
              filter: [`blur(${p.blur}px)`, "blur(0px)", "blur(0.4px)"],
            }}
            transition={{
              duration: 1.9,
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

      <motion.h1
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="t-hero relative text-starlight"
      >
        {text}
      </motion.h1>
    </div>
  );
}
