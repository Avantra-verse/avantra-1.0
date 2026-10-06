"use client";

import React from "react";
import ScrubVideo from "./ScrubVideo";

const TIMELINE_STEPS = [
  {
    step: "01",
    title: "Line-up",
    detail: "Announced soon.",
    accent: "#ffb02f",
  },
  {
    step: "02",
    title: "Registration",
    detail: "Opens with the line-up.",
    accent: "#ff2fb5",
  },
  {
    step: "03",
    title: "The festival",
    detail: "Two days in December 2026.",
    accent: "#9ad2fb",
  },
];

export default function Timeline() {
  return (
    <section id="path" data-dimension="3" className="relative w-full">
      <ScrubVideo
        src="/video/planets-gold-dust-timeline-hq.mp4"
        webmSrc="/video/planets-gold-dust-timeline-hq.webm"
        poster="/video/planets-gold-dust-timeline-poster.jpg"
        trackHeight="300vh"
        mode="sticky"
        overlayTint="radial-gradient(ellipse at center, rgba(7,7,14,0.5) 0%, rgba(7,7,14,0.88) 100%)"
        canvasFramesPath="/video/frames/timeline"
        totalFrames={655}
      >
        {/* Content Overlaid on Timeline Video */}
        <div className="relative z-20 flex flex-col items-center justify-center text-center px-6 max-w-5xl mx-auto pointer-events-auto">
          <span className="text-xs font-bold tracking-[0.25em] text-[#ffb02f] uppercase">
            DIMENSION 03 // ROADMAP
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#edebf5] tracking-tight">
            The path to AVANTRA
          </h2>

          {/* 3 Glass Timeline Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 w-full">
            {TIMELINE_STEPS.map((item) => (
              <div
                key={item.step}
                className="p-6 bg-[#07070e]/75 backdrop-blur-xl border border-white/10 rounded-2xl hover:border-[#ffb02f]/60 hover:-translate-y-2 transition-all duration-300 shadow-[0_0_25px_rgba(0,0,0,0.5)] text-left flex flex-col justify-between h-48"
              >
                <div>
                  <span
                    className="text-sm font-extrabold tracking-widest uppercase"
                    style={{ color: item.accent }}
                  >
                    PHASE {item.step}
                  </span>
                  <h3 className="mt-2 text-xl font-bold text-[#edebf5]">
                    {item.title}
                  </h3>
                </div>
                <p className="text-sm font-medium text-[#a9a7ba]">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </ScrubVideo>
    </section>
  );
}
