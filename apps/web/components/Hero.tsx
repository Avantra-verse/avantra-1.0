"use client";

import React from "react";
import ScrubVideo from "./ScrubVideo";

export default function Hero() {
  const handlePortalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById("about");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="top" data-dimension="0" className="relative w-full">
      <ScrubVideo
        src="/video/asteroid-nebula-hero-hq.mp4"
        webmSrc="/video/asteroid-nebula-hero-hq.webm"
        poster="/video/asteroid-nebula-hero-poster.jpg"
        trackHeight="250vh"
        mode="sticky"
        overlayTint="radial-gradient(ellipse at center, rgba(7,7,14,0.3) 0%, rgba(7,7,14,0.85) 100%)"
        canvasFramesPath="/video/frames/hero"
        totalFrames={179}
      >
        {/* Centered Hero Content */}
        <div className="relative z-20 flex flex-col items-center justify-center text-center px-6 max-w-5xl mx-auto pointer-events-auto">
          {/* Main Giant AVANTRA Title */}
          <h1
            className="font-serif tracking-tight leading-none text-[#b3000a] select-none"
            style={{
              fontSize: "clamp(54px, 11vw, 170px)",
              fontFamily: "'Rozha One', Georgia, serif",
              WebkitTextStroke: "3px #9ad2fb",
              paintOrder: "stroke fill",
              textShadow: "0 0 35px rgba(255, 47, 181, 0.8), 0 0 70px rgba(138, 75, 255, 0.5)",
            }}
          >
            AVANTRA
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl md:text-2xl font-bold tracking-wider text-[#edebf5] max-w-2xl text-shadow">
            A Multiverse-themed inter-school science & innovation festival
          </p>

          {/* CTA Button */}
          <div className="mt-8">
            <a
              href="#about"
              onClick={handlePortalClick}
              className="inline-block px-8 py-4 text-sm font-extrabold tracking-[0.14em] text-white rounded-lg bg-gradient-to-b from-[#d4000d] to-[#7a0007] border-2 border-[#9ad2fb] shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_6px_0_#4a0004,0_0_20px_rgba(212,0,13,0.6)] hover:-translate-y-1 hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_8px_0_#4a0004,0_0_35px_rgba(255,47,181,0.9)] active:translate-y-1 active:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_0_#4a0004] transition-all duration-150"
            >
              ENTER PORTAL
            </a>
          </div>

          {/* Small Date Line */}
          <p className="mt-6 text-xs font-bold tracking-[0.2em] text-[#a9a7ba]">
            DECEMBER 2026 · DATES SOON
          </p>
        </div>

        {/* Bottom Bobbing Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none opacity-80">
          <span className="text-[10px] font-bold tracking-[0.25em] text-[#9ad2fb]">
            BEGIN TRAVERSAL
          </span>
          <div className="w-[1px] h-10 bg-gradient-to-b from-[#9ad2fb] to-transparent animate-bounce-line" />
        </div>
      </ScrubVideo>
    </section>
  );
}
