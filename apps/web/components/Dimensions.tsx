"use client";

import React from "react";
import ScrubVideo from "./ScrubVideo";

export default function Dimensions() {
  return (
    <section id="dims" data-dimension="2" className="relative w-full">
      <ScrubVideo
        src="/video/subway-wormhole-stage-hq.mp4"
        webmSrc="/video/subway-wormhole-stage-hq.webm"
        poster="/video/subway-wormhole-stage-poster.jpg"
        trackHeight="320vh"
        mode="sticky"
        overlayTint="linear-gradient(to bottom, rgba(7,7,14,0.4) 0%, rgba(7,7,14,0.2) 50%, rgba(7,7,14,0.7) 100%)"
        canvasFramesPath="/video/frames/dimensions"
        totalFrames={509}
      >
        {/* Bottom Left Glass Card */}
        <div className="absolute bottom-12 left-6 sm:left-12 max-w-md p-6 bg-[#07070e]/80 backdrop-blur-xl border border-[#22e6ff]/40 rounded-2xl shadow-[0_0_30px_rgba(34,230,255,0.25)] pointer-events-auto">
          <span className="text-xs font-bold tracking-[0.2em] text-[#22e6ff] uppercase">
            DIMENSION 02 // WARP STAGE
          </span>
          <h3 className="mt-2 text-2xl font-extrabold text-[#edebf5]">
            Travel between dimensions
          </h3>
          <p className="mt-3 text-sm text-[#a9a7ba] leading-relaxed">
            Scroll to move through the festival. Every section of the page shifts the sky, the colour and the speed of the stars.
          </p>
        </div>
      </ScrubVideo>
    </section>
  );
}
