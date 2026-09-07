"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Scroll-triggered entrance. "rise" is the default; "warp" scales and
 * unblurs to echo the portal transition used between pages.
 */
export default function Reveal({
  children,
  delay = 0,
  variant = "rise",
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: "rise" | "warp";
}) {
  const reduce = useReducedMotion();

  const hidden =
    variant === "warp"
      ? { opacity: 0, scale: 0.94, filter: "blur(8px)" }
      : { opacity: 0, y: 28 };

  const shown =
    variant === "warp"
      ? { opacity: 1, scale: 1, filter: "blur(0px)" }
      : { opacity: 1, y: 0 };

  return (
    <motion.div
      initial={reduce ? false : hidden}
      whileInView={shown}
      viewport={{ once: true, amount: 0.25 }}
      transition={{
        duration: variant === "warp" ? 0.8 : 0.6,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
