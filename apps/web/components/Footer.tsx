"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/about" || pathname === "/contact") return null;
  return (
    <footer className="relative z-30 border-t border-[#9ad2fb]/20 bg-[#07070e] py-16 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-8 text-center md:text-left">
        {/* Logo & Tagline */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <Link href="/" className="inline-block focus-visible:outline-none">
            <img
              src="/images/avantra-logo.png"
              alt="AVANTRA 2026 Logo"
              className="h-[42px] w-auto object-contain"
            />
          </Link>
          <p className="text-sm font-medium text-[#a9a7ba] max-w-sm">
            A Multiverse-themed inter-school science & innovation festival
          </p>
          <p className="text-xs font-bold tracking-widest text-[#9ad2fb]">
            DECEMBER 2026
          </p>
        </div>

        {/* Links Navigation */}
        <nav className="flex flex-wrap justify-center gap-8 text-sm font-bold tracking-wider text-[#a9a7ba]">
          <Link
            href="/about"
            className="hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            ABOUT
          </Link>
          <Link
            href="/venue"
            className="hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            VENUE
          </Link>
          <Link
            href="/sponsors"
            className="hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            SPONSORS
          </Link>
          <Link
            href="/contact"
            className="hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            CONTACT
          </Link>
          <Link
            href="/registration"
            className="hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            REGISTRATION
          </Link>
        </nav>
      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-[#85839a] gap-4">
        <p>© 2026 AVANTRA Festival. All rights reserved.</p>
        <p>Arithi Innovation & Technologies Private Limited</p>
      </div>
    </footer>
  );
}
