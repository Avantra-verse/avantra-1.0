"use client";

import React from "react";

interface SideNavProps {
  activeDimension: number; // 0 to 4
}

const SECTIONS = [
  { id: "top", label: "Overview", index: 0 },
  { id: "about", label: "About", index: 1 },
  { id: "dims", label: "Dimensions", index: 2 },
  { id: "path", label: "Timeline", index: 3 },
  { id: "venue", label: "Location", index: 4 },
];

export default function SideNav({ activeDimension }: SideNavProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <aside
      className="fixed left-6 top-1/2 -translate-y-1/2 z-40 hidden min-[860px]:flex flex-col items-center gap-6 px-3 py-6 bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-full shadow-[0_0_25px_rgba(0,0,0,0.5)]"
      aria-label="Section Navigation"
    >
      {SECTIONS.map((sec) => {
        const isActive = activeDimension === sec.index;
        return (
          <a
            key={sec.id}
            href={`#${sec.id}`}
            onClick={(e) => handleClick(e, sec.id)}
            className="group relative flex items-center justify-center p-2 focus-visible:outline-none"
            aria-label={`Scroll to ${sec.label}`}
          >
            {/* Indicator Dot */}
            <span
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-[#ff2fb5] shadow-[0_0_12px_#ff2fb5] scale-125"
                  : "bg-white/30 group-hover:bg-[#9ad2fb] group-hover:scale-110"
              }`}
            />

            {/* Floating Tooltip Label */}
            <span className="absolute left-10 px-3 py-1 bg-[#07070e]/90 text-xs font-bold tracking-wider text-white border border-[#9ad2fb]/40 rounded-md opacity-0 pointer-events-none -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap shadow-lg">
              {sec.label}
            </span>
          </a>
        );
      })}
    </aside>
  );
}
