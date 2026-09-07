"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getTimeRemaining, type TimeRemaining } from "@/lib/countdown";
import { siteConfig } from "@/content/site";

const UNITS: { key: keyof Omit<TimeRemaining, "isPast">; label: string }[] = [
  { key: "days", label: "days" },
  { key: "hours", label: "hours" },
  { key: "minutes", label: "minutes" },
  { key: "seconds", label: "seconds" },
];

export default function CountdownTimer() {
  const [remaining, setRemaining] = useState<TimeRemaining | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(getTimeRemaining(siteConfig.eventDateISO));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Hold the row's height before the first client tick so nothing jumps.
  if (!remaining) {
    return <div className="h-[92px]" aria-hidden="true" />;
  }

  if (remaining.isPast) {
    return (
      <p className="slab inline-block px-6 py-5 t-item text-starlight">
        AVANTRA has begun.
      </p>
    );
  }

  return (
    <div className="slab inline-flex items-stretch gap-5 px-6 py-5 sm:gap-7 sm:px-8">
      {UNITS.map(({ key, label }, i) => (
        <div key={key} className="flex items-stretch gap-5 sm:gap-7">
          {i > 0 && <span aria-hidden="true" className="seam-v" />}
          <div>
            <div className="h-10 overflow-hidden sm:h-12">
              <motion.span
                key={remaining[key]}
                initial={{ y: "-100%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="block text-4xl font-bold tabular-nums leading-none text-starlight sm:text-5xl"
              >
                {String(remaining[key]).padStart(2, "0")}
              </motion.span>
            </div>
            <span className="mt-2 block text-sm text-muted">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
