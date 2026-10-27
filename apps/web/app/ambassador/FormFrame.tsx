"use client";

import { useRef } from "react";

// The Google Form can't tell us its height (cross-origin), so the frame is sized to page 1 per width
// (measured 2026-10-27) and the page scrolls instead of the frame. Re-measure if the form's questions change.
// Each "Next" in the form reloads the frame; bring its top back into view so nobody lands on blank space.
export default function FormFrame({ src, title, className }: { src: string; title: string; className: string }) {
  const loads = useRef(0);
  return (
    <iframe
      src={src}
      title={title}
      className={`h-[2950px] min-[400px]:h-[2760px] sm:h-[2160px] md:h-[1990px] w-full ${className}`}
      onLoad={(e) => {
        if (loads.current++ > 0) e.currentTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    />
  );
}
