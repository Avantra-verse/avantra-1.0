"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Text rising from behind a hard edge, rather than fading in. The wrapper
 * clips, the child translates, so the line appears to be uncovered. Reads as
 * deliberate where a fade reads as generic.
 */
export default function MaskedReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    // Padding keeps descenders and any glow from being clipped by overflow.
    <div className={`overflow-hidden pb-[0.12em] ${className}`}>
      <motion.div
        initial={{ y: "110%" }}
        whileInView={{ y: "0%" }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
