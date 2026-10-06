"use client";

import React from "react";
import ScrubVideo from "./ScrubVideo";

export default function About() {
  return (
    <section id="about" data-dimension="1" className="relative w-full py-24 px-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column Text & Glass Cards */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          <div className="space-y-4">
            <span className="text-xs font-bold tracking-[0.2em] text-[#ff2fb5] uppercase">
              DIMENSION 01 // OVERVIEW
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#edebf5] tracking-tight leading-tight">
              Bring a project. Meet other schools.
            </h2>
            <p className="text-base sm:text-lg text-[#a9a7ba] leading-relaxed">
              AVANTRA 2026 is a two-day festival where school students show the science and technology projects they have built, and take on hands-on challenges with students from other schools. The full line-up is announced soon.
            </p>
          </div>

          {/* 3 Glass Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            {/* Card 1: WHEN */}
            <div className="p-5 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl hover:border-[#ff2fb5]/50 hover:-translate-y-1 transition-all duration-300 shadow-lg">
              <span className="text-[11px] font-extrabold tracking-widest text-[#9ad2fb] uppercase">
                WHEN
              </span>
              <p className="mt-2 text-sm font-bold text-[#edebf5]">
                December 2026, dates soon
              </p>
            </div>

            {/* Card 2: WHERE */}
            <div className="p-5 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl hover:border-[#ff2fb5]/50 hover:-translate-y-1 transition-all duration-300 shadow-lg">
              <span className="text-[11px] font-extrabold tracking-widest text-[#9ad2fb] uppercase">
                WHERE
              </span>
              <p className="mt-2 text-sm font-bold text-[#edebf5]">
                Host school, TBA
              </p>
            </div>

            {/* Card 3: HOW LONG */}
            <div className="p-5 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-2xl hover:border-[#ff2fb5]/50 hover:-translate-y-1 transition-all duration-300 shadow-lg">
              <span className="text-[11px] font-extrabold tracking-widest text-[#9ad2fb] uppercase">
                HOW LONG
              </span>
              <p className="mt-2 text-sm font-bold text-[#edebf5]">
                2 days
              </p>
            </div>
          </div>
        </div>

        {/* Right Column Rotated Phone Frame Video */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-[320px] aspect-[9/16] rounded-[2.5rem] p-3 border-4 border-[#9ad2fb] bg-[#07070e] shadow-[0_0_35px_rgba(255,47,181,0.5),0_0_15px_rgba(34,230,255,0.3)] transform -rotate-3 hover:rotate-0 transition-transform duration-500 overflow-hidden">
            {/* Phone Notch/Speaker */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-[#07070e] rounded-full z-30 border border-white/10 flex items-center justify-center">
              <div className="w-8 h-1 bg-white/20 rounded-full" />
            </div>

            <ScrubVideo
              src="/video/retro-mountains-moon-portrait-hq.mp4"
              webmSrc="/video/retro-mountains-moon-portrait-hq.webm"
              poster="/video/retro-mountains-moon-portrait-poster.jpg"
              mode="inView"
              videoClassName="rounded-[2rem] object-cover"
              canvasFramesPath="/video/frames/about"
              totalFrames={68}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
