"use client";

// The student dashboard's own multiverse: nine planets (one per exhibition universe) orbiting the doorway in a tilted
// 3D system. Planets behind the doorway are drawn in the back layer, smaller and dimmer; in front, the front layer.
// The doorway is the light source, so each planet's shadow turns away from it. The chosen universe gets a halo.
// Positions are set straight on the DOM each frame (no React renders); under reduced motion it is one still frame.
import React, { useEffect, useRef } from "react";
import { EXHIBITION_TOPICS } from "@avantra/shared";
import d from "./dashboard.module.css";

// One hue per universe, in the order of EXHIBITION_TOPICS.
const HUES = ["#9fd4ff", "#ff5560", "#f2c14e", "#c4a1ff", "#5fd3c6", "#ff8fc7", "#5fd38d", "#ff9f5a", "#e8d9a8"];
const ORBITS = [
  { rx: 150, ry: 46, period: 38 },
  { rx: 240, ry: 74, period: 62 },
  { rx: 340, ry: 104, period: 96 },
];
// [orbit, radius, start angle (turns), feature]
const PLANETS: [number, number, number, "ring" | "moon" | null][] = [
  [0, 8, 0.15, null], [0, 6, 0.65, null],
  [1, 12, 0.3, "ring"], [1, 7, 0.62, "moon"], [1, 9, 0.95, null],
  [2, 14, 0.08, "ring"], [2, 9, 0.36, null], [2, 10, 0.58, "moon"], [2, 7, 0.82, null],
];
const TILT = -9; // degrees

// Same stars on the server and in the browser (no Math.random), so hydration matches.
function stars(n: number, w: number, h: number, seed: number) {
  let x = seed;
  const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () => ({ cx: (r() - 0.5) * w, cy: (r() - 0.5) * h, r: r() < 0.85 ? 0.9 : 1.6, o: 0.3 + r() * 0.6 }));
}
const STARS = stars(80, 900, 420, 7);
const half = (rx: number, ry: number, back: boolean) => (back ? `M ${-rx} 0 A ${rx} ${ry} 0 0 1 ${rx} 0` : `M ${rx} 0 A ${rx} ${ry} 0 0 1 ${-rx} 0`);

function Planet({ i, back, mine }: { i: number; back: boolean; mine: boolean }) {
  const [, r, , feature] = PLANETS[i];
  const size = mine ? r + 4 : r;
  return (
    <g data-planet={i} data-layer={back ? "back" : "front"} style={{ display: "none" }}>
      <title>{EXHIBITION_TOPICS[i]}{mine ? " (your universe)" : ""}</title>
      {mine && <circle r={size + 8} className={d.mine} />}
      {feature === "ring" && <ellipse rx={size * 1.9} ry={size * 0.45} fill="none" stroke={HUES[i]} strokeOpacity="0.5" strokeWidth="2" transform="rotate(-16)" />}
      <circle r={size} fill={`url(#base${i})`} />
      {/* Shadow on the side away from the doorway; rotated toward it every frame. */}
      <g data-shade>
        <circle r={size} fill="url(#shade)" />
      </g>
      {feature === "moon" && <circle data-moon r={2.2} fill="#d9cbb8" />}
    </g>
  );
}

export function Cosmos({ chosen, compact, children }: { chosen?: string | null; compact?: boolean; children?: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const pick = chosen ? EXHIBITION_TOPICS.indexOf(chosen as (typeof EXHIBITION_TOPICS)[number]) : -1;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const nodes = PLANETS.map((_, i) => ({
      back: el.querySelector<SVGGElement>(`[data-planet="${i}"][data-layer="back"]`)!,
      front: el.querySelector<SVGGElement>(`[data-planet="${i}"][data-layer="front"]`)!,
    }));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const secs = still ? 0 : (now - t0) / 1000;
      PLANETS.forEach(([orbit, , start], i) => {
        const o = ORBITS[orbit];
        const a = (start + secs / o.period) * Math.PI * 2;
        const x = o.rx * Math.cos(a);
        const y = o.ry * Math.sin(a);
        const behind = y < 0;
        const depth = Math.sin(a); // -1 far, 1 near
        const s = 0.8 + 0.2 * depth;
        const show = behind ? nodes[i].back : nodes[i].front;
        const hide = behind ? nodes[i].front : nodes[i].back;
        hide.style.display = "none";
        show.style.display = "";
        show.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`);
        show.style.opacity = (0.62 + 0.38 * (depth + 1) / 2).toFixed(2);
        // Point the lit side at the doorway (the centre).
        const toward = (Math.atan2(-y, -x) * 180) / Math.PI;
        show.querySelector("[data-shade]")?.setAttribute("transform", `rotate(${toward.toFixed(1)})`);
        const moon = show.querySelector("[data-moon]");
        if (moon) {
          const m = secs * 1.4 + i;
          moon.setAttribute("cx", (Math.cos(m) * (PLANETS[i][1] + 7)).toFixed(1));
          moon.setAttribute("cy", (Math.sin(m) * (PLANETS[i][1] + 7) * 0.4).toFixed(1));
        }
      });
      if (!still) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  const layer = (back: boolean) => (
    <svg className={`${d.orbits} ${back ? d.back : d.front}`} viewBox="-450 -210 900 420" aria-hidden="true">
      {back && (
        <defs>
          {HUES.map((c, i) => (
            <radialGradient key={c} id={`base${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c} />
              <stop offset="100%" stopColor={c} stopOpacity="0.75" />
            </radialGradient>
          ))}
          {/* Lit toward +x (rotated to face the doorway), dark on the far side. */}
          <linearGradient id="shade" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="30%" stopColor="#0b0d14" stopOpacity="0" />
            <stop offset="62%" stopColor="#0b0d14" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0b0d14" stopOpacity="0.92" />
          </linearGradient>
        </defs>
      )}
      {back &&
        STARS.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#f4ead9" opacity={s.o} className={i % 9 === 0 ? d.twinkle : undefined} style={{ animationDelay: `${(i % 7) * 0.6}s` }} />
        ))}
      <g transform={`rotate(${TILT})`}>
        {ORBITS.map((o) => (
          <path key={o.rx} d={half(o.rx, o.ry, back)} className={back ? d.orbitBack : d.orbitFront} />
        ))}
        {PLANETS.map((_, i) => (
          <Planet key={i} i={i} back={back} mine={i === pick} />
        ))}
      </g>
    </svg>
  );

  return (
    <div ref={root} className={`${d.system} ${compact ? d.systemCompact : ""}`}>
      {layer(true)}
      <div className={d.core}>{compact ? <span className={d.miniPortal} aria-hidden="true" /> : children}</div>
      {layer(false)}
    </div>
  );
}
