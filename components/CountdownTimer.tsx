"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { getTimeRemaining, type TimeRemaining } from "@/lib/countdown";
import { siteConfig } from "@/content/site";

type UnitKey = keyof Omit<TimeRemaining, "isPast">;

const UNITS: { key: UnitKey; label: string }[] = [
  { key: "days", label: "days" },
  { key: "hours", label: "hours" },
  { key: "minutes", label: "minutes" },
  { key: "seconds", label: "seconds" },
];

/**
 * The live countdown, shown in the navigation bar so it is on screen on every
 * page. Digits are stable elements that always render: they are never keyed,
 * clipped or translated, so no stalled animation can leave them out of view.
 * The glitch is a transient class over an already visible digit.
 */
export default function CountdownTimer() {
  const [remaining, setRemaining] = useState<TimeRemaining | null>(null);
  const [flashing, setFlashing] = useState<Record<string, boolean>>({});
  const previous = useRef<TimeRemaining | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const tick = () => {
      const next = getTimeRemaining(siteConfig.eventDateISO);

      // Flag only the units that actually changed, so the glitch fires on the
      // value rather than on a remount.
      const prev = previous.current;
      if (prev) {
        const changed: Record<string, boolean> = {};
        for (const { key } of UNITS) {
          if (prev[key] !== next[key]) changed[key] = true;
        }
        if (Object.keys(changed).length > 0) {
          setFlashing(changed);
          window.setTimeout(() => setFlashing({}), 260);
        }
      }

      previous.current = next;
      setRemaining(next);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Hold the row's width before the first client tick so the nav does not jump.
  if (!remaining) {
    return <div className="h-6 w-44" aria-hidden="true" />;
  }

  if (remaining.isPast) {
    return <span className="text-sm text-teal">AVANTRA has begun</span>;
  }

  return (
    <div
      role="group"
      aria-label={`Time remaining until AVANTRA: ${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes`}
      className="flex items-baseline gap-2.5"
    >
      <span aria-hidden="true" className="text-xs text-muted">
        opens in
      </span>

      <span aria-hidden="true" className="flex items-baseline gap-2 tabular-nums">
        {UNITS.map(({ key, label }) => (
          <span key={key} className="flex items-baseline">
            <span
              className={`text-sm font-semibold tracking-tight text-starlight ${
                !reduce && flashing[key] ? "glitch-tick" : ""
              }`}
            >
              {String(remaining[key]).padStart(2, "0")}
            </span>
            <span className="ml-px text-[10px] text-muted">{label.charAt(0)}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
