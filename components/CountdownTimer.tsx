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

  if (!remaining) return null;
  if (remaining.isPast) {
    return <p className="text-starlight text-xl">AVANTRA has begun!</p>;
  }

  return (
    <div className="flex gap-4">
      {UNITS.map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center">
          <motion.span
            key={remaining[key]}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-4xl font-bold bg-gradient-to-br from-rift-purple via-rift-pink to-rift-cyan bg-clip-text text-transparent"
          >
            {String(remaining[key]).padStart(2, "0")}
          </motion.span>
          <span className="text-sm text-starlight/70">{label}</span>
        </div>
      ))}
    </div>
  );
}
