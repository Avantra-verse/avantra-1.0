"use client";

import React from "react";
import Link from "next/link";
import ScrubVideo from "./ScrubVideo";

export default function Location() {
  return (
    <section id="venue" data-dimension="4" className="relative w-full py-24 px-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column Text & Button */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <span className="text-xs font-bold tracking-[0.2em] text-[#9ad2fb] uppercase">
            DIMENSION 04 // LOCATION & ORGANIZER
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#edebf5] tracking-tight leading-tight">
            Host school to be announced
          </h2>
          <p className="text-base sm:text-lg text-[#a9a7ba] leading-relaxed">
            ARITHI INNOVATION & TECHNOLOGIES PRIVATE LIMITED is the event partner, running the festival, its events and registration.
          </p>

          <div className="pt-4">
            <Link
              href="/contact"
              className="inline-block px-7 py-3.5 text-xs font-extrabold tracking-[0.14em] text-white rounded-lg bg-gradient-to-b from-[#d4000d] to-[#7a0007] border-2 border-[#9ad2fb] shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_6px_0_#4a0004,0_0_20px_rgba(212,0,13,0.5)] hover:-translate-y-1 hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_8px_0_#4a0004,0_0_35px_rgba(255,47,181,0.8)] active:translate-y-1 active:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_0_#4a0004] transition-all duration-150"
            >
              GET IN TOUCH
            </Link>
          </div>
        </div>

        {/* Right Column Nebula Cube + Neon Hex Tunnel Phone Frame */}
        <div className="lg:col-span-6 flex flex-col sm:flex-row items-center justify-center gap-6">
          {/* Nebula Cube Image */}
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden border-2 border-[#9ad2fb] shadow-[0_0_25px_rgba(154,210,251,0.4)] group">
            <img
              src="/video/nebula-cube.png"
              alt="Floating Nebula Cube"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>

          {/* Phone Frame 2 with Neon Hex Tunnel Video */}
          <div className="relative w-full max-w-[220px] aspect-[9/16] rounded-[2rem] p-2.5 border-3 border-[#9ad2fb] bg-[#07070e] shadow-[0_0_30px_rgba(255,47,181,0.5),0_0_15px_rgba(34,230,255,0.3)] transform rotate-2 hover:rotate-0 transition-transform duration-500 overflow-hidden">
            {/* Phone Speaker */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-3 bg-[#07070e] rounded-full z-30 border border-white/10 flex items-center justify-center">
              <div className="w-6 h-0.5 bg-white/20 rounded-full" />
            </div>

            <ScrubVideo
              src="/video/neon-hex-tunnel-portrait-hq.mp4"
              webmSrc="/video/neon-hex-tunnel-portrait-hq.webm"
              poster="/video/neon-hex-tunnel-portrait-poster.jpg"
              mode="inView"
              videoClassName="rounded-[1.5rem] object-cover"
              canvasFramesPath="/video/frames/location"
              totalFrames={115}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
