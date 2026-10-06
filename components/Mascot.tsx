"use client";

import React from "react";

export default function Mascot() {
  return (
    <div
      className="fixed bottom-6 right-6 z-40 pointer-events-none w-[9vw] min-w-[80px] max-w-[130px]"
      aria-hidden="true"
    >
      <img
        src="/video/planet-triangle-mascot.png"
        alt=""
        className="w-full h-auto object-contain animate-mascot-float filter drop-shadow-[0_0_18px_rgba(255,47,181,0.65)]"
      />
    </div>
  );
}
