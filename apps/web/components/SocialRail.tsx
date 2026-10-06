"use client";

import React from "react";
import Link from "next/link";

export default function SocialRail() {
  return (
    <aside
      className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden min-[860px]:flex flex-col items-center gap-6 px-3 py-6 bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-full shadow-[0_0_25px_rgba(0,0,0,0.5)]"
      aria-label="Quick Links Sidebar"
    >
      <Link
        href="/contact"
        className="group relative flex items-center justify-center p-2 focus-visible:outline-none"
        aria-label="Contact Page"
      >
        <span className="text-[10px] font-bold tracking-widest text-[#a9a7ba] [writing-mode:vertical-lr] rotate-180 group-hover:text-[#ff2fb5] transition-colors duration-200">
          CONTACT
        </span>
      </Link>

      <div className="w-4 h-[1px] bg-white/10" />

      <Link
        href="/sponsors"
        className="group relative flex items-center justify-center p-2 focus-visible:outline-none"
        aria-label="Sponsors Page"
      >
        <span className="text-[10px] font-bold tracking-widest text-[#a9a7ba] [writing-mode:vertical-lr] rotate-180 group-hover:text-[#ff2fb5] transition-colors duration-200">
          SPONSORS
        </span>
      </Link>

      <div className="w-4 h-[1px] bg-white/10" />

      <Link
        href="/about"
        className="group relative flex items-center justify-center p-2 focus-visible:outline-none"
        aria-label="About Page"
      >
        <span className="text-[10px] font-bold tracking-widest text-[#a9a7ba] [writing-mode:vertical-lr] rotate-180 group-hover:text-[#ff2fb5] transition-colors duration-200">
          INFO
        </span>
      </Link>
    </aside>
  );
}
