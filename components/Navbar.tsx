"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    if (isHome && hash.startsWith("#")) {
      e.preventDefault();
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
      setMobileOpen(false);
    }
  };

  return (
    <header className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-[min(1100px,94vw)] pointer-events-auto">
      {/* Tech Visor Container */}
      <div
        className="relative flex items-center justify-between px-6 py-3 bg-[#07070e]/80 backdrop-blur-[14px] border border-[#9ad2fb]/30 rounded-xl shadow-[0_0_20px_rgba(34,230,255,0.15)] transition-all duration-300"
        style={{
          clipPath:
            "polygon(16px 0%, calc(100% - 16px) 0%, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0% calc(100% - 16px), 0% 16px)",
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group focus-visible:outline-none">
          <img
            src="/video/avantra-logo.png"
            alt="AVANTRA Logo"
            className="h-[38px] w-auto object-contain transition-transform group-hover:scale-105"
          />
        </Link>

        {/* Desktop Links (Hidden below 860px) */}
        <nav className="hidden min-[860px]:flex items-center gap-7">
          <a
            href={isHome ? "#about" : "/about"}
            onClick={(e) => handleNavClick(e, "#about")}
            className="text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            ABOUT
          </a>
          <a
            href={isHome ? "#dims" : "/#dims"}
            onClick={(e) => handleNavClick(e, "#dims")}
            className="text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            DIMENSIONS
          </a>
          <a
            href={isHome ? "#path" : "/#path"}
            onClick={(e) => handleNavClick(e, "#path")}
            className="text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            TIMELINE
          </a>
          <Link
            href="/venue"
            className="text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            VENUE
          </Link>
          <Link
            href="/sponsors"
            className="text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            SPONSORS
          </Link>
          <Link
            href="/contact"
            className="text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            CONTACT
          </Link>
          <Link
            href="/registration"
            className="text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-[#ff2fb5] hover:drop-shadow-[0_0_8px_rgba(255,47,181,0.6)] transition-all duration-200"
          >
            REGISTRATION
          </Link>
        </nav>

        {/* Action Button & Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          <a
            href={isHome ? "#dims" : "/#dims"}
            onClick={(e) => handleNavClick(e, "#dims")}
            className="btn-3d uppercase px-4 py-2 text-xs min-[860px]:px-5 min-[860px]:py-2.5 min-[860px]:text-xs font-bold tracking-[0.12em] text-white rounded-md bg-gradient-to-b from-[#d4000d] to-[#7a0007] border-2 border-[#9ad2fb] shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_6px_0_#4a0004,0_0_15px_rgba(212,0,13,0.5)] hover:-translate-y-1 hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_8px_0_#4a0004,0_0_25px_rgba(255,47,181,0.8)] active:translate-y-1 active:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_0_#4a0004] transition-all duration-150"
          >
            ENTER MULTIVERSE
          </a>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="min-[860px]:hidden p-2 text-[#9ad2fb] hover:text-white focus-visible:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileOpen && (
        <div className="min-[860px]:hidden mt-2 p-4 bg-[#07070e]/95 backdrop-blur-xl border border-[#9ad2fb]/30 rounded-xl flex flex-col gap-3 shadow-2xl">
          <a
            href={isHome ? "#about" : "/about"}
            onClick={(e) => handleNavClick(e, "#about")}
            className="py-2 text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-white border-b border-white/5"
          >
            ABOUT
          </a>
          <a
            href={isHome ? "#dims" : "/#dims"}
            onClick={(e) => handleNavClick(e, "#dims")}
            className="py-2 text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-white border-b border-white/5"
          >
            DIMENSIONS
          </a>
          <a
            href={isHome ? "#path" : "/#path"}
            onClick={(e) => handleNavClick(e, "#path")}
            className="py-2 text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-white border-b border-white/5"
          >
            TIMELINE
          </a>
          <Link
            href="/venue"
            onClick={() => setMobileOpen(false)}
            className="py-2 text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-white border-b border-white/5"
          >
            VENUE
          </Link>
          <Link
            href="/sponsors"
            onClick={() => setMobileOpen(false)}
            className="py-2 text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-white border-b border-white/5"
          >
            SPONSORS
          </Link>
          <Link
            href="/contact"
            onClick={() => setMobileOpen(false)}
            className="py-2 text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-white border-b border-white/5"
          >
            CONTACT
          </Link>
          <Link
            href="/registration"
            onClick={() => setMobileOpen(false)}
            className="py-2 text-sm font-semibold tracking-wider text-[#a9a7ba] hover:text-white"
          >
            REGISTRATION
          </Link>
        </div>
      )}
    </header>
  );
}
