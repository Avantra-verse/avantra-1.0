"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getTimeRemaining, type TimeRemaining } from "@/lib/countdown";
import { siteConfig } from "@/content/site";

const UNITS: { key: keyof Omit<TimeRemaining, "isPast">; label: string }[] = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
];

export default function CountdownTimer() {
  const [remaining, setRemaining] = useState<TimeRemaining | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(getTimeRemaining(siteConfig.eventDateISO));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Reserve the panel row's height before the first client tick so the hero
  // does not jump when the countdown mounts.
  if (!remaining) {
    return <div className="h-[104px] sm:h-[120px]" aria-hidden="true" />;
  }

  if (remaining.isPast) {
    return (
      <p className="panel panel-accent px-8 py-5 text-xl text-starlight">
        AVANTRA has begun.
      </p>
    );
  }

  return (
    <div className="flex gap-3 sm:gap-4">
      {UNITS.map(({ key, label }) => (
        <div
          key={key}
          className="panel flex min-w-[74px] flex-col items-center px-4 py-4 sm:min-w-[92px] sm:px-6 sm:py-5"
        >
          <div className="relative h-10 overflow-hidden sm:h-12">
            <motion.span
              key={remaining[key]}
              initial={{ y: "-100%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="block font-display text-4xl font-bold tabular-nums text-starlight sm:text-5xl"
            >
              {String(remaining[key]).padStart(2, "0")}
            </motion.span>
          </div>
          <span className="mt-2 text-[11px] uppercase tracking-[0.16em] text-starlight/50">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
