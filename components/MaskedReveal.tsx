"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * Text rising from behind a hard edge, rather than fading in. The wrapper
 * clips, the child translates, so the line appears to be uncovered. Reads as
 * deliberate where a fade reads as generic.
 *
 * The in-view check watches the wrapper, not the moving child: the child
 * starts fully clipped by the wrapper's overflow, and IntersectionObserver
 * counts a clipped element as not visible, so it would never trigger.
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
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  if (reduce) return <div className={className}>{children}</div>;

  return (
    // Padding keeps descenders and any glow from being clipped by overflow.
    <div ref={ref} className={`overflow-hidden pb-[0.12em] ${className}`}>
      <motion.div
        initial={{ y: "110%" }}
        animate={inView ? { y: "0%" } : undefined}
        transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
